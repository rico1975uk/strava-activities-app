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

function formatPace(averageSpeedMs) {
  if (!averageSpeedMs || averageSpeedMs <= 0) return null;
  const secondsPerKm = 1000 / averageSpeedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}/km`;
}

function mapLap(lap) {
  const elevationHigh =
    lap.elevation_high ?? lap.elev_high ?? lap.elevHigh ?? null;
  const elevationLow =
    lap.elevation_low ?? lap.elev_low ?? lap.elevLow ?? null;

  const hasBothElevations =
    elevationHigh !== null &&
    elevationHigh !== undefined &&
    elevationLow !== null &&
    elevationLow !== undefined &&
    !Number.isNaN(Number(elevationHigh)) &&
    !Number.isNaN(Number(elevationLow));

  const elevationLossM = hasBothElevations
    ? Math.round((Number(elevationHigh) - Number(elevationLow)) * 10) / 10
    : null;

  return {
    lap_number: lap.lap_index,
    distance_m: lap.distance,
    moving_time_s: lap.moving_time,
    average_heart_rate_bpm: lap.average_heartrate ?? null,
    average_pace: formatPace(lap.average_speed),
    elevation_gain_m: lap.total_elevation_gain,
    elevation_loss_m: elevationLossM
  };
}

async function getActivityLaps(activityId, { accessToken } = {}) {
  const rawLaps = await stravaFetchJson(`/activities/${activityId}/laps`, {
    accessToken
  });
  if (rawLaps.length > 0) console.log(JSON.stringify(rawLaps[0], null, 2));
return rawLaps.map(mapLap);
  return rawLaps.map(mapLap);
}

async function getRecentActivities({ perPage = 10, accessToken } = {}) {
  const query = new URLSearchParams({ per_page: String(perPage) });
  const activities = await stravaFetchJson(
    `/athlete/activities?${query.toString()}`,
    { accessToken }
  );

  const activitiesWithLaps = await Promise.all(
    activities.map(async (activity) => {
      const laps = await getActivityLaps(activity.id, { accessToken });
      return { ...activity, laps };
    })
  );

  return activitiesWithLaps;
}

module.exports = {
  getRecentActivities
};