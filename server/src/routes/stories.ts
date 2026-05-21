import { Router, Response } from 'express';
import { db, schema } from '../db';
import { and, eq, inArray } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'roadtrip-dev-secret-change-in-production';

async function loadStory(tripId: number, guideId?: number) {
  const [trip] = await db.select()
    .from(schema.trips)
    .where(eq(schema.trips.id, tripId))
    .limit(1);

  if (!trip) return null;

  let guide;
  if (guideId) {
    const guides = await db.select()
      .from(schema.guides)
      .where(and(eq(schema.guides.id, guideId), eq(schema.guides.tripId, tripId)))
      .limit(1);
    if (guides.length === 0) return null;
    guide = guides[0];
  } else {
    const guides = await db.select()
      .from(schema.guides)
      .where(eq(schema.guides.tripId, tripId))
      .orderBy(schema.guides.createdAt)
      .limit(1);
    if (guides.length === 0) return null;
    guide = guides[0];
  }

  const segments = await db.select()
    .from(schema.guideSegments)
    .where(eq(schema.guideSegments.guideId, guide.id))
    .orderBy(schema.guideSegments.orderIndex);

  const wpIds = segments
    .map(s => s.waypointId)
    .filter((id): id is number => id != null);

  let waypoints: any[] = [];
  if (wpIds.length > 0) {
    waypoints = await db.select()
      .from(schema.waypoints)
      .where(inArray(schema.waypoints.id, wpIds))
      .orderBy(schema.waypoints.orderIndex);
  }

  const photos = await db.select({
    id: schema.photos.id,
    url: schema.photos.url,
    thumbnailUrl: schema.photos.thumbnailUrl,
    latitude: schema.photos.latitude,
    longitude: schema.photos.longitude,
    caption: schema.photos.caption,
  }).from(schema.photos)
    .where(eq(schema.photos.tripId, tripId))
    .orderBy(schema.photos.createdAt);

  const trackPoints = await db.select({
    latitude: schema.trackPoints.latitude,
    longitude: schema.trackPoints.longitude,
  }).from(schema.trackPoints)
    .where(eq(schema.trackPoints.tripId, tripId))
    .orderBy(schema.trackPoints.id);

  let participants: Array<{ id: number; name: string; vehicleType: string; colorHex: string }> = [];
  try {
    participants = await db.select({
      id: schema.tripParticipants.id,
      name: schema.tripParticipants.name,
      vehicleType: schema.tripParticipants.vehicleType,
      colorHex: schema.tripParticipants.colorHex,
    }).from(schema.tripParticipants)
      .where(eq(schema.tripParticipants.tripId, tripId))
      .orderBy(schema.tripParticipants.id);
  } catch {}

  let settingsRow: { defaultMode: string; highlightWaypointIds: string | null; soundtrackUrl: string | null } | undefined;
  try {
    const [row] = await db.select({
      defaultMode: schema.storySettings.defaultMode,
      highlightWaypointIds: schema.storySettings.highlightWaypointIds,
      soundtrackUrl: schema.storySettings.soundtrackUrl,
    })
      .from(schema.storySettings)
      .where(eq(schema.storySettings.tripId, tripId))
      .limit(1);
    settingsRow = row;
  } catch {}

  let settings: any = undefined;
  if (settingsRow) {
    let highlightIds: number[] = [];
    if (settingsRow.highlightWaypointIds) {
      try {
        const parsed = JSON.parse(settingsRow.highlightWaypointIds) as number[];
        if (Array.isArray(parsed)) highlightIds = parsed;
      } catch {}
    }
    settings = {
      defaultMode: (settingsRow.defaultMode as 'storybook' | 'animated') || 'storybook',
      highlights: highlightIds.map(id => ({ waypointId: id })),
      soundtrackUrl: settingsRow.soundtrackUrl,
    };
  }

  return {
    trip: {
      id: trip.id,
      title: trip.title,
      description: trip.description,
      distance: trip.distance,
      duration: trip.duration,
      startDate: trip.startDate,
      endDate: trip.endDate,
      vehicle: trip.vehicle,
    },
    guide,
    segments,
    waypoints,
    photos,
    trackPoints,
    participants,
    settings,
  };
}

// Public: fetch story via signed share token
router.get('/share/:token', async (req, res: Response) => {
  try {
    const payload = jwt.verify(req.params.token, JWT_SECRET) as { tripId: number; guideId: number };
    const story = await loadStory(payload.tripId, payload.guideId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    return res.json(story);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired link' });
  }
});

// Authenticated: create share token
router.post('/:tripId/share', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const story = await loadStory(tripId);
    if (!story) return res.status(404).json({ error: 'No guide found for this trip' });
    const token = jwt.sign({ tripId: story.trip.id, guideId: story.guide.id }, JWT_SECRET, { expiresIn: '90d' });
    return res.json({ token });
  } catch (err) {
    console.error('Share link error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stories/:tripId — returns guide + segments + waypoints + trip info
router.get('/:tripId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const story = await loadStory(tripId);
    if (!story) return res.status(404).json({ error: 'No guide found for this trip' });
    return res.json(story);
  } catch (err) {
    console.error('Story fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
