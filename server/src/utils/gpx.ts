import { parseStringPromise } from 'xml2js';

export interface TrackPoint {
  latitude: number;
  longitude: number;
  elevation: number | null;
  timestamp: string | null;
}

export async function parseGpx(xmlContent: string): Promise<TrackPoint[]> {
  const parsed = await parseStringPromise(xmlContent, {
    trim: true,
    explicitArray: false,
  });

  const gpx = parsed.gpx;
  if (!gpx) throw new Error('Invalid GPX file: missing gpx element');

  const points: TrackPoint[] = [];

  const trk = gpx.trk;
  if (trk) {
    const trksegs = trk.trkseg;
    if (trksegs) {
      const segments = Array.isArray(trksegs) ? trksegs : [trksegs];
      for (const seg of segments) {
        const trkpts = seg.trkpt;
        if (!trkpts) continue;
        const ptArray = Array.isArray(trkpts) ? trkpts : [trkpts];
        for (const pt of ptArray) {
          points.push({
            latitude: parseFloat(pt.$.lat),
            longitude: parseFloat(pt.$.lon),
            elevation: pt.ele ? parseFloat(pt.ele) : null,
            timestamp: pt.time || null,
          });
        }
      }
    }
  }

  const wpt = gpx.wpt;
  if (wpt) {
    // Waypoints could be added separately if needed
  }

  return points;
}
