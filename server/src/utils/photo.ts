import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

export function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export async function processPhoto(inputPath: string, filename: string): Promise<{ url: string; thumbnailUrl: string }> {
  ensureUploadsDir();

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const dateStr = Date.now().toString(36);
  const uniqueName = `${baseName}-${dateStr}`;

  const fullUrl = `/uploads/${uniqueName}${ext}`;
  const thumbUrl = `/uploads/${uniqueName}_thumb${ext}`;

  const fullPath = path.join(UPLOADS_DIR, `${uniqueName}${ext}`);
  const thumbPath = path.join(UPLOADS_DIR, `${uniqueName}_thumb${ext}`);

  // Resize original if too large (max 2000px)
  await sharp(inputPath)
    .resize({ width: 2000, withoutEnlargement: true })
    .toFile(fullPath);

  // Create thumbnail (300px)
  await sharp(inputPath)
    .resize({ width: 300, height: 300, fit: 'cover' })
    .toFile(thumbPath);

  return { url: fullUrl, thumbnailUrl: thumbUrl };
}
