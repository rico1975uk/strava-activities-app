# Strava Activities App (starter)

Simple Node.js + Express starter that calls the Strava API and displays your recent running activities.

## What you get

- `GET /activities`: server-rendered HTML list (EJS)
- `GET /api/activities`: raw JSON from Strava (limited fields depend on your token scopes)
- `GET /health`: basic health check

## Setup

1. Install dependencies

```bash
cd strava-activities-app
npm install
```

2. Create your `.env`

- Copy `.env.template` (or `.env.example`) to `.env`
- Set:
  - `SESSION_SECRET`
  - `STRAVA_CLIENT_ID`
  - `STRAVA_CLIENT_SECRET`
  - `STRAVA_REDIRECT_URI` (default is `http://localhost:3000/auth/strava/callback`)

3. Run

```bash
npm run dev
```

Open `http://localhost:3000/activities`.

## OAuth flow

- Visit `http://localhost:3000/auth/strava` to log in.
- After authorization, Strava redirects to `STRAVA_REDIRECT_URI` and the app exchanges the code for tokens.
- Tokens are stored in the server session (dev-only approach).

## Notes

- This starter uses Node 18+ built-in `fetch`.
- For production, replace the in-memory session store and cookie settings (HTTPS `secure: true`) and store refresh tokens securely.

