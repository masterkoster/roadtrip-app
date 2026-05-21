const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';

export interface SnappedPoint {
  latitude: number;
  longitude: number;
}

export interface MatchResult {
  snapped: SnappedPoint[];
  originalCount: number;
  confidence: number;
}

export interface RouteLeg {
  distance: number;
  duration: number;
  summary: string;
  geometry: { coordinates: number[][] };
}

export interface RouteResult {
  legs: RouteLeg[];
  totalDistance: number;
  totalDuration: number;
  geometry: { coordinates: number[][] };
}

interface OSRMMatching {
  confidence?: number;
  geometry?: {
    coordinates: number[][];
  };
}

interface OSRMResponse {
  code: string;
  matchings?: OSRMMatching[];
}

interface OSRMRouteResponse {
  code: string;
  routes?: {
    legs: {
      distance: number;
      duration: number;
      summary: string;
    }[];
    geometry: {
      coordinates: number[][];
    };
    distance: number;
    duration: number;
  }[];
}

export async function matchToRoads(
  coordinates: { latitude: number; longitude: number }[]
): Promise<MatchResult> {
  if (coordinates.length < 2) {
    return { snapped: coordinates, originalCount: coordinates.length, confidence: 0 };
  }

  const coordStr = coordinates
    .map((c) => `${c.longitude},${c.latitude}`)
    .join(';');

  const url = `${OSRM_BASE}/match/v1/driving/${coordStr}?geometries=geojson&overview=full&gaps=ignore&tidy=true`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OSRM match failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OSRMResponse;

  if (data.code !== 'Ok' || !data.matchings || data.matchings.length === 0) {
    throw new Error(`OSRM match returned: ${data.code || 'empty'}`);
  }

  const snapped: SnappedPoint[] = [];
  let totalConfidence = 0;

  for (const matching of data.matchings) {
    totalConfidence += matching.confidence || 0;
    if (matching.geometry?.coordinates) {
      for (const coord of matching.geometry.coordinates) {
        snapped.push({ longitude: coord[0], latitude: coord[1] });
      }
    }
  }

  const confidence = data.matchings.length > 0
    ? totalConfidence / data.matchings.length
    : 0;

  if (snapped.length < 2) {
    return { snapped: coordinates, originalCount: coordinates.length, confidence: 0 };
  }

  return { snapped, originalCount: coordinates.length, confidence: Math.round(confidence * 100) / 100 };
}

export async function routeBetweenWaypoints(
  waypoints: { latitude: number; longitude: number }[]
): Promise<RouteResult | null> {
  if (waypoints.length < 2) return null;

  const coordStr = waypoints
    .map((w) => `${w.longitude},${w.latitude}`)
    .join(';');

  const url = `${OSRM_BASE}/route/v1/driving/${coordStr}?geometries=geojson&overview=full&steps=false&alternatives=false`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OSRM route failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as OSRMRouteResponse;

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(`OSRM route returned: ${data.code || 'empty'}`);
  }

  const route = data.routes[0];

  return {
    legs: (route.legs || []).map((leg) => ({
      distance: leg.distance,
      duration: leg.duration,
      summary: leg.summary,
      geometry: { coordinates: [] },
    })),
    totalDistance: route.distance,
    totalDuration: route.duration,
    geometry: {
      coordinates: route.geometry.coordinates || [],
    },
  };
}
