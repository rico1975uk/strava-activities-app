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

function calculateDescent(altitudeStream, startIndex, endIndex) {
  if (!altitudeStream || altitudeStream.length === 0) return null;
  const slice = altitudeStream.slice(startIndex, endIndex + 1);
  let descent = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff < 0) descent += diff;
  }
  return Math.round(Math.abs(descent) * 10) / 10;
}

function mapLap(lap, altitudeStream) {
  return {
    lap_number: lap.lap_index,
    distance_m: lap.distance,
    moving_time_s: lap.moving_time,
    average_heart_rate_bpm: lap.average_heartrate ?? null,
    average_pace: formatPace(lap.average_speed),
    elevation_gain_m: lap.total_elevation_gain,
    elevation_loss_m: calculateDescent(altitudeStream, lap.start_index, lap.end_index)
  };
}

async function getActivityLaps(activityId, { accessToken } = {}) {
  const [rawLaps, streamData] = await Promise.all([
    stravaFetchJson(`/activities/${activityId}/laps`, { accessToken }),
    stravaFetchJson(`/activities/${activityId}/streams?keys=altitude`, { accessToken })
  ]);

  const altitudeStream = streamData?.find(s => s.type === "altitude")?.data ?? null;

  return rawLaps.map(lap => mapLap(lap, altitudeStream));
}

async function getRecentActivities({ perPage = 5, accessToken } = {}) {
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