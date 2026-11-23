# Campus Connect

Campus Connect is an events app with a Flask/Supabase API and a static frontend.

## Local setup

### Backend

```sh
cd backend
python -m venv venv
source venv/bin/activate
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env
pip install -r requirements.txt
python app.py
```

The API runs on `http://localhost:5000`.

### Frontend

```sh
cd frontend
npm run dev
```

The development server listens on `http://localhost:3000` and connects to the
backend at `http://localhost:5000` by default. To build the Vercel static site:

```sh
npm run build
```

## Deploy the backend to Render

The repository root includes `render.yaml`. Push this repository to a Git host,
then create a Blueprint in Render from the repository. Render deploys the
`backend` directory using Gunicorn. Set `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, and `FRONTEND_ORIGINS` when prompted. Set
`FRONTEND_ORIGINS` to the final Vercel origin, such as
`https://your-campus-connect.vercel.app`.

## Deploy the frontend to Vercel

Create a Vercel project from the same Git repository and set **Root Directory**
to `frontend`. Vercel reads `frontend/vercel.json`; its build command creates the
static site in `dist`. Add the environment variable `API_BASE_URL` with the
Render service URL, for example `https://campus-connect-api.onrender.com`, then
deploy. After Vercel gives you its production URL, add that exact origin to
Render's `FRONTEND_ORIGINS` and redeploy the backend.

## User ID behavior

This app currently has no authentication. The browser stores a user UUID that
the person supplies and sends it to the API for registration operations. This
is a development flow, not a verified identity; the backend endpoints are
unauthenticated as requested.

See [backend/README.md](backend/README.md) for the API routes and database
requirements.
