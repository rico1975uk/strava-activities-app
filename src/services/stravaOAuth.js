const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing ${name}. Set it in your .env file.`);
    err.status = 500;
    throw err;
  }
  return v;
}

function getOAuthConfig() {
  return {
    clientId: requireEnv("STRAVA_CLIENT_ID"),
    clientSecret: requireEnv("STRAVA_CLIENT_SECRET"),
    redirectUri: requireEnv("STRAVA_REDIRECT_URI")
  };
}

function buildAuthorizeUrl({ state } = {}) {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all"
  });
  if (state) params.set("state", state);
  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const { clientId, clientSecret } = getOAuthConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code"
  });

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `Strava token exchange failed (${res.status} ${res.statusText})${text ? `: ${text}` : ""}`
    );
    err.status = 502;
    throw err;
  }

  return await res.json();
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getOAuthConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `Strava token refresh failed (${res.status} ${res.statusText})${text ? `: ${text}` : ""}`
    );
    err.status = 502;
    throw err;
  }

  return await res.json();
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken
};

