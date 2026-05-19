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
