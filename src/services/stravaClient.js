const STRAVA_API_BASE = "https://www.strava.com/api/v3";

function requireAccessToken() {
  const token = process.env.STRAVA_ACCESS_TOKEN;
  if (!token) {
    const err = new Error(
      "Missing access token. Log in via /auth/strava or set STRAVA_ACCESS_TOKEN in your .env."
    );
    err.status = 500;
    throw err;
  }
  return token;
}

async function stravaFetchJson(path, { accessToken } = {}) {
  const token = accessToken || requireAccessToken();

  const res = await fetch(`${STRAVA_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `Strava API error (${res.status} ${res.statusText})${text ? `: ${text}` : ""}`
    );
    err.status = 502;
    throw err;
  }

  return await res.json();
}

async function getRecentActivities({ perPage = 10, accessToken } = {}) {
  const query = new URLSearchParams({ per_page: String(perPage) });
  return await stravaFetchJson(`/athlete/activities?${query.toString()}`, {
    accessToken
  });
}

module.exports = {
  getRecentActivities
};

