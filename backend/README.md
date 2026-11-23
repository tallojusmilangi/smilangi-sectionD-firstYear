# Campus Connect API

Flask JSON API backed by the Supabase tables shown in `database.png`.

## Run it

The existing `.env` file should define `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
Do not commit `.env` or put a Supabase secret/service-role key in a client app.

```sh
pip install -r requirements.txt
python app.py
```

The server listens on `http://127.0.0.1:5000` by default. Set `FLASK_DEBUG=true`
only for local development.

## Deploy on Render

The repository root contains `render.yaml`; it configures a Render web service
with `backend` as its root directory. Push this repository to a Git provider,
then create a Blueprint in Render from that repository. Add these environment
variables when Render prompts for them:

- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY`: your Supabase publishable key
- `FRONTEND_ORIGINS`: the frontend origin(s), comma-separated, for example
  `https://your-app.vercel.app`

Do not upload `.env`. The API allows browser requests from
`http://localhost:3000` by default during local frontend development. Set
`FRONTEND_ORIGINS` in Render to the deployed Vercel origin; include preview
origins only if you want those deployments to call the API.

Render installs `requirements.txt` and starts the app with Gunicorn bound to
Render's `$PORT`.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/events` | Browse events. Optional `status`, `limit` (1–100), and `offset` query parameters. |
| `GET` | `/api/events/<id>` | Return one event by UUID. |
| `POST` | `/api/registrations` | Create a registration. JSON body: `{"user_id":"<uuid>","event_id":"<uuid>"}`. Returns `201`; duplicate or full event returns `409`. |
| `GET` | `/api/me/registrations?user_id=<uuid>` | List a user's registrations and event details. |
| `GET` | `/api/events/<id>/registrations` | List registrations and attendee email addresses for an event. |

Responses use JSON. Errors include an `error` string. The event attendee endpoint
is public in this version because the requested API has no authentication or
authorization; the diagram's “owning organizer only” restriction is therefore
not enforced. The `/api/me` route likewise trusts its `user_id` query parameter,
and callers can request another user's registrations.

## Database expectations

The Supabase `public` schema needs these tables and foreign keys:

- `users`: `id uuid` primary key, `email text`, `role text`
- `events`: `id uuid` primary key, `organizer_id uuid` referencing `users.id`, `title text`, `capacity int4`, `status text`
- `registrations`: `id uuid` primary key, `user_id uuid` referencing `users.id`, `event_id uuid` referencing `events.id`, `created_at timestamptz`

UUID primary keys should have a database default (for example `gen_random_uuid()`),
and `registrations(user_id, event_id)` should have a unique constraint so duplicate
registrations remain prevented under concurrent requests. Ensure the `anon` role
has the table grants and RLS policies needed for these operations in Supabase.
Because this API intentionally has no authorization, any public policy needed to
make these endpoints work also permits the corresponding anonymous database
access; the API does not add ownership checks.
