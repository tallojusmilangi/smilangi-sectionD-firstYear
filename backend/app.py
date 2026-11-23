"""Unauthenticated JSON API for the Campus Connect events database."""

import os
from uuid import UUID

from dotenv import load_dotenv
from flask_cors import CORS
from flask import Flask, jsonify, request
from postgrest import APIError
from supabase import Client, create_client

load_dotenv()

app = Flask(__name__)
allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env")

supabase: Client = create_client(supabase_url, supabase_key)


def valid_uuid(value):
    """Return a normalized UUID string, or None for invalid input."""
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def db_error(error):
    """Convert common Postgres errors to useful API responses."""
    code = getattr(error, "code", None)
    if code == "23505":  # unique_violation
        return jsonify(error="A registration for this user and event already exists."), 409
    if code == "23503":  # foreign_key_violation
        return jsonify(error="The referenced user or event does not exist."), 404
    app.logger.exception("Supabase request failed", exc_info=error)
    return jsonify(error="Database request failed."), 500


@app.get("/")
def index():
    return jsonify(
        name="Campus Connect API",
        endpoints=[
            "GET /api/events",
            "GET /api/events/<id>",
            "POST /api/registrations",
            "GET /api/me/registrations?user_id=<uuid>",
            "GET /api/events/<id>/registrations",
        ],
    )


@app.get("/api/events")
def list_events():
    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 100)
        offset = max(int(request.args.get("offset", 0)), 0)
    except ValueError:
        return jsonify(error="limit and offset must be integers."), 400

    try:
        query = supabase.table("events").select("*")
        status = request.args.get("status")
        if status:
            query = query.eq("status", status)
        result = query.order("title").range(offset, offset + limit - 1).execute()
        return jsonify(data=result.data, limit=limit, offset=offset)
    except APIError as error:
        return db_error(error)


@app.get("/api/events/<event_id>")
def get_event(event_id):
    event_uuid = valid_uuid(event_id)
    if not event_uuid:
        return jsonify(error="id must be a valid UUID."), 400

    try:
        result = (
            supabase.table("events")
            .select("*")
            .eq("id", event_uuid)
            .limit(1)
            .execute()
        )
        if not result.data:
            return jsonify(error="Event not found."), 404
        return jsonify(data=result.data[0])
    except APIError as error:
        return db_error(error)


@app.post("/api/registrations")
def create_registration():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Request body must be a JSON object."), 400

    user_id = valid_uuid(payload.get("user_id"))
    event_id = valid_uuid(payload.get("event_id"))
    if not user_id or not event_id:
        return jsonify(error="user_id and event_id must be valid UUIDs."), 400

    try:
        event_result = (
            supabase.table("events")
            .select("id, capacity")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not event_result.data:
            return jsonify(error="Event not found."), 404

        event = event_result.data[0]
        capacity = event.get("capacity")
        if capacity is not None:
            count_result = (
                supabase.table("registrations")
                .select("id", count="exact")
                .eq("event_id", event_id)
                .execute()
            )
            if (count_result.count or 0) >= int(capacity):
                return jsonify(error="This event has reached capacity."), 409

        existing = (
            supabase.table("registrations")
            .select("id")
            .eq("user_id", user_id)
            .eq("event_id", event_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            return jsonify(error="A registration for this user and event already exists."), 409

        result = (
            supabase.table("registrations")
            .insert({"user_id": user_id, "event_id": event_id})
            .select("id, user_id, event_id, created_at")
            .execute()
        )
        return jsonify(data=result.data[0]), 201
    except APIError as error:
        return db_error(error)


@app.get("/api/me/registrations")
def list_user_registrations():
    # With authentication deliberately omitted, the caller supplies user_id.
    user_id = valid_uuid(request.args.get("user_id"))
    if not user_id:
        return jsonify(error="Provide a valid user_id query parameter."), 400

    try:
        result = (
            supabase.table("registrations")
            .select("id, user_id, event_id, created_at, events(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return jsonify(data=result.data)
    except APIError as error:
        return db_error(error)


@app.get("/api/events/<event_id>/registrations")
def list_event_registrations(event_id):
    event_uuid = valid_uuid(event_id)
    if not event_uuid:
        return jsonify(error="id must be a valid UUID."), 400

    try:
        event_result = (
            supabase.table("events")
            .select("id")
            .eq("id", event_uuid)
            .limit(1)
            .execute()
        )
        if not event_result.data:
            return jsonify(error="Event not found."), 404

        result = (
            supabase.table("registrations")
            .select("id, user_id, event_id, created_at, users(email)")
            .eq("event_id", event_uuid)
            .order("created_at")
            .execute()
        )
        return jsonify(data=result.data)
    except APIError as error:
        return db_error(error)


if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
