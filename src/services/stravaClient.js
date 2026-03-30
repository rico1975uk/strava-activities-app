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

function findFirstIndexAtOrAfter(timeStream, second) {
  for (let i = 0; i < timeStream.length; i++) {
    if (timeStream[i] >= second) return i;
  }
  return timeStream.length - 1;
}

function findLastIndexAtOrBefore(timeStream, second) {
  for (let i = timeStream.length - 1; i >= 0; i--) {
    if (timeStream[i] <= second) return i;
  }
  return 0;
}

function calculateLapDescentFromStreams(laps, altitudeStream, timeStream) {
  if (!Array.isArray(laps) || !laps.length) return [];
  if (!Array.isArray(altitudeStream) || !Array.isArray(timeStream)) {
    return laps.map(() => null);
  }
  if (!altitudeStream.length || !timeStream.length) {
    return laps.map(() => null);
  }

  // Strava lap objects do not reliably include start/end stream indices.
  // Reconstruct each lap's time window from cumulative elapsed_time.
  let lapStartSecond = 0;
  return laps.map((lap) => {
    const lapElapsed = Math.max(Number(lap.elapsed_time || lap.moving_time || 0), 0);
    const lapEndSecond = lapStartSecond + lapElapsed;

    let startIndex = findFirstIndexAtOrAfter(timeStream, lapStartSecond);
    let endIndex = findLastIndexAtOrBefore(timeStream, lapEndSecond);

    // Keep a valid window even when stream sampling and lap boundaries are sparse.
    if (endIndex < startIndex) endIndex = startIndex;
    startIndex = Math.max(0, Math.min(startIndex, altitudeStream.length - 1));
    endIndex = Math.max(0, Math.min(endIndex, altitudeStream.length - 1));

    const descent = calculateDescent(altitudeStream, startIndex, endIndex);
    lapStartSecond = lapEndSecond;
    return descent;
  });
}

function mapLap(lap, elevationLossM) {
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
  const [rawLaps, streamData] = await Promise.all([
    stravaFetchJson(`/activities/${activityId}/laps`, { accessToken }),
    stravaFetchJson(`/activities/${activityId}/streams?keys=altitude,time`, { accessToken })
  ]);

  const altitudeStream = streamData?.find(s => s.type === "altitude")?.data ?? null;
  const timeStream = streamData?.find(s => s.type === "time")?.data ?? null;
  const lapDescent = calculateLapDescentFromStreams(rawLaps, altitudeStream, timeStream);

  return rawLaps.map((lap, i) => mapLap(lap, lapDescent[i]));
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