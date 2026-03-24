const express = require("express");
const { getRecentActivities } = require("../services/stravaClient");
const {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  persistRefreshToken
} = require("../services/stravaOAuth");

const router = express.Router();

function setSessionToken(req, tokenResponse) {
  req.session.strava = {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: tokenResponse.expires_at,
    athlete: tokenResponse.athlete
  };
}

async function getAccessToken() {
  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;
  if (!refreshToken) return null;

  const tokenResponse = await refreshAccessToken(refreshToken);
  await persistRefreshToken(tokenResponse.refresh_token);
  return tokenResponse.access_token;
}

router.get("/", (req, res) => {
  res.redirect("/activities");
});

router.get("/auth/strava", (req, res) => {
  const state = Math.random().toString(16).slice(2);
  req.session.oauthState = state;
  res.redirect(buildAuthorizeUrl({ state }));
});

router.get("/auth/strava/callback", async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      const err = new Error(`Strava authorization error: ${error}`);
      err.status = 400;
      throw err;
    }

    if (!code) {
      const err = new Error("Missing Strava OAuth 'code' in callback.");
      err.status = 400;
      throw err;
    }

    if (req.session.oauthState && state !== req.session.oauthState) {
      const err = new Error("Invalid OAuth state.");
      err.status = 400;
      throw err;
    }

    const tokenResponse = await exchangeCodeForToken(String(code));
    await persistRefreshToken(tokenResponse.refresh_token);
    setSessionToken(req, tokenResponse);
    delete req.session.oauthState;

    res.redirect("/activities");
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/activities");
  });
});

router.get("/health", (req, res) => {
  res.json({ ok: true });
});

router.get("/api/activities", async (req, res, next) => {
  try {
    const perPage = Math.min(Number(req.query.per_page || 10), 50);
    const accessToken = await getAccessToken();
    const activities = await getRecentActivities({ perPage, accessToken });

    res.set('Cache-Control', 'no-store');
    res.json({
      count: activities.length,
      activities
    });
  } catch (err) {
    next(err);
  }
});

router.get("/activities", async (req, res, next) => {
  try {
    const accessToken = await getAccessToken();
    const isAuthed = Boolean(accessToken);
    const activities = isAuthed
      ? await getRecentActivities({ perPage: 10, accessToken })
      : [];

    res.render("activities", { activities, isAuthed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;