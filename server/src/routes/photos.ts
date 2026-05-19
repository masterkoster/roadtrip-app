import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { processPhoto } from '../utils/photo';

const router = Router();
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const toISO = (v: any) => v ? new Date(v).toISOString() : null;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now().toString(36) + '-' + Math.round(Math.random() * 1e9).toString(36);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|heic/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) return cb(null, true);
    cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  },
});

router.post('/:tripId', authMiddleware, upload.array('photos', 20), async (req: AuthRequest, res: Response) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const [trip] = await db.select()
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, req.userId!)))
      .limit(1);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const photos = [];
    for (const file of files) {
      const { url, thumbnailUrl } = await processPhoto(file.path, file.originalname);
      const latitude = req.body.latitude ? parseFloat(req.body.latitude) : null;
      const longitude = req.body.longitude ? parseFloat(req.body.longitude) : null;

      const [photo] = await db.insert(schema.photos).values({
        tripId,
        userId: req.userId!,
        url,
        thumbnailUrl,
        latitude,
        longitude,
        takenAt: toISO(req.body.takenAt),
        caption: req.body.caption || null,
      }).returning();

      photos.push(photo);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }

    return res.status(201).json(photos);
  } catch (err) {
    console.error('Upload photos error:', err);
    return res.status(500).json({ error: 'Failed to upload photos' });
  }
});

router.put('/:tripId/:photoId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const photoId = parseInt(req.params.photoId);
    const [photo] = await db.select()
      .from(schema.photos)
      .where(and(eq(schema.photos.id, photoId), eq(schema.photos.userId, req.userId!)))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const { caption, latitude, longitude } = req.body;
    const [updated] = await db.update(schema.photos)
      .set({
        caption: caption ?? photo.caption,
        latitude: latitude != null ? latitude : photo.latitude,
        longitude: longitude != null ? longitude : photo.longitude,
      })
      .where(eq(schema.photos.id, photoId))
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error('Update photo error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:tripId/:photoId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const photoId = parseInt(req.params.photoId);
    const [photo] = await db.select()
      .from(schema.photos)
      .where(and(eq(schema.photos.id, photoId), eq(schema.photos.userId, req.userId!)))
      .limit(1);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const fullPath = path.join(UPLOADS_DIR, path.basename(photo.url));
    const thumbPath = path.join(UPLOADS_DIR, path.basename(photo.thumbnailUrl || ''));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

    await db.delete(schema.photos).where(eq(schema.photos.id, photoId));
    return res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete photo error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
