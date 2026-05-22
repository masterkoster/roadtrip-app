import { useEffect, useRef, useState } from 'react';
import type { VehicleType } from './VehicleIcon';
import OrderBookDialog from './OrderBookDialog';

interface StorySegment {
  id: number;
  title: string;
  content: string;
  orderIndex: number;
  waypointId: number | null;
}

interface Waypoint {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  orderIndex: number;
}

interface Photo {
  id: number;
  url: string;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  caption: string | null;
}

interface TripInfo {
  id: number;
  title: string;
  description: string | null;
  distance: number | null;
  duration: number | null;
  startDate: string | null;
  endDate: string | null;
  vehicle: string;
}

interface PrintStoryViewProps {
  trip: TripInfo;
  segments: StorySegment[];
  waypoints: Waypoint[];
  photos: Photo[];
  vehicle: VehicleType;
  onClose: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return m + ' min';
  if (m === 0) return h + ' hr';
  return h + ' hr ' + m + ' min';
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imgTag(url: string, cls?: string): string {
  return '<img src="' + esc(url) + '" alt=""' + (cls ? ' class="' + cls + '"' : '') + ' />';
}

function page(
  title: string,
  css: string,
  body: string,
): string {
  return [
    '<!DOCTYPE html>',
    '<html><head><title>' + esc(title) + '</title>',
    '<style>',
    '@page { size: 8.5in 11in; margin: 0; }',
    '* { margin: 0; padding: 0; box-sizing: border-box; }',
    'body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; }',
    '.page { page-break-after: always; width: 8.5in; height: 11in; overflow: hidden; position: relative; }',
    css,
    '</style></head><body>',
    body,
    '</body></html>',
  ].join('\n');
}

export default function PrintStoryView({ trip, segments, waypoints, photos, vehicle, onClose }: PrintStoryViewProps) {
  const printFrame = useRef<HTMLIFrameElement>(null);
  const [showOrder, setShowOrder] = useState(false);

  useEffect(() => {
    const iframe = printFrame.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const coverPhoto = photos[0]?.url || null;

    const coverParts: string[] = [];
    coverParts.push('<div class="page cover' + (coverPhoto ? ' has-image' : '') + '">');
    if (coverPhoto) {
      coverParts.push(imgTag(coverPhoto, 'cover-img'));
      coverParts.push('<div class="cover-overlay"></div>');
    }
    coverParts.push('<div class="cover-content">');
    coverParts.push('<div class="cover-label">A Road Trip Story</div>');
    coverParts.push('<h1 class="cover-title">' + esc(trip.title) + '</h1>');
    if (trip.description) {
      coverParts.push('<p class="cover-desc">' + esc(trip.description) + '</p>');
    }
    coverParts.push('<div class="cover-meta">');
    if (trip.startDate) coverParts.push(fmtDate(trip.startDate));
    if (trip.endDate) coverParts.push(' &mdash; ' + fmtDate(trip.endDate));
    coverParts.push('</div>');
    coverParts.push('<div class="cover-stats">');
    if (trip.distance != null) coverParts.push('<span>' + trip.distance.toFixed(0) + ' km</span>');
    if (trip.duration != null) coverParts.push('<span>' + formatDuration(trip.duration) + '</span>');
    coverParts.push('<span>' + waypoints.length + ' stops</span>');
    coverParts.push('</div></div></div>');
    const coverHtml = coverParts.join('');

    const contentParts: string[] = [];
    segments.forEach((seg, idx) => {
      const wp = waypoints.find(w => w.id === seg.waypointId);
      const wpPhotos = photos.filter(p => {
        if (p.latitude == null || p.longitude == null || !wp) return false;
        const dlat = p.latitude - wp.latitude;
        const dlng = p.longitude - wp.longitude;
        return Math.sqrt(dlat * dlat + dlng * dlng) < 1;
      });

      contentParts.push('<div class="page content-page"><div class="page-grid"><div class="page-photo">');
      if (wpPhotos[0]) {
        contentParts.push(imgTag(wpPhotos[0].url));
        if (wpPhotos.length > 1) {
          contentParts.push('<div class="photo-strip">');
          wpPhotos.slice(1, 4).forEach(p => contentParts.push(imgTag(p.thumbnailUrl || p.url)));
          contentParts.push('</div>');
        }
      } else {
        contentParts.push('<div class="photo-placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>');
      }
      contentParts.push('</div><div class="page-text">');
      contentParts.push('<div class="page-label">Stop ' + (idx + 1) + ' of ' + segments.length + '</div>');
      contentParts.push('<h2 class="page-title">' + esc(wp?.name || seg.title) + '</h2>');
      if (seg.title !== wp?.name) {
        contentParts.push('<div class="page-subtitle">' + esc(seg.title) + '</div>');
      }
      contentParts.push('<div class="page-body">' + seg.content.replace(/\n/g, '<br/>') + '</div>');
      if (wpPhotos.length > 1) {
        contentParts.push('<div class="page-photos-inline">');
        wpPhotos.slice(1).forEach(p => contentParts.push(imgTag(p.thumbnailUrl || p.url)));
        contentParts.push('</div>');
      }
      contentParts.push('</div></div></div>');
    });
    const contentHtml = contentParts.join('');

    const photoParts: string[] = [];
    if (photos.length > 0) {
      photoParts.push('<div class="page photo-page"><div class="photo-grid">');
      photos.slice(0, 6).forEach(p => photoParts.push(imgTag(p.thumbnailUrl || p.url)));
      photoParts.push('</div></div>');
    }
    const photoHtml = photoParts.join('');

    const endStats: string[] = [];
    if (trip.distance != null) {
      endStats.push('<div class="end-stat"><div class="end-stat-value">' + trip.distance.toFixed(0) + '</div><div class="end-stat-label">km travelled</div></div>');
    }
    if (trip.duration != null) {
      endStats.push('<div class="end-stat"><div class="end-stat-value">' + formatDuration(trip.duration) + '</div><div class="end-stat-label">time on road</div></div>');
    }
    endStats.push('<div class="end-stat"><div class="end-stat-value">' + waypoints.length + '</div><div class="end-stat-label">stops</div></div>');
    endStats.push('<div class="end-stat"><div class="end-stat-value">' + segments.length + '</div><div class="end-stat-label">chapters</div></div>');
    const endHtml = '<div class="page end-page"><div class="end-title">The End</div><p class="end-sub">Every journey tells a story.</p><div class="end-stats">' + endStats.join('') + '</div></div>';

    const css = [
      '.cover { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: #0f172a; color: white; }',
      '.cover.has-image { background: #000; }',
      '.cover-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }',
      '.cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3)); }',
      '.cover-content { position: relative; z-index: 1; padding: 60px; }',
      '.cover-label { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; opacity: 0.6; margin-bottom: 16px; }',
      '.cover-title { font-size: 42px; font-weight: bold; margin-bottom: 12px; line-height: 1.2; }',
      '.cover-desc { font-size: 16px; opacity: 0.8; font-style: italic; max-width: 500px; margin: 0 auto 16px; }',
      '.cover-meta { font-size: 12px; opacity: 0.5; }',
      '.cover-stats { margin-top: 20px; display: flex; gap: 20px; font-size: 11px; opacity: 0.6; }',
      '.content-page { background: #fafaf9; }',
      '.page-grid { display: flex; height: 100%; }',
      '.page-photo { width: 55%; height: 100%; overflow: hidden; position: relative; }',
      '.page-photo img { width: 100%; height: 100%; object-fit: cover; }',
      '.photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f5f0eb; }',
      '.photo-strip { position: absolute; bottom: 12px; left: 12px; right: 12px; display: flex; gap: 6px; }',
      '.photo-strip img { width: 70px; height: 52px; object-fit: cover; border-radius: 4px; border: 2px solid rgba(255,255,255,0.8); }',
      '.page-text { width: 45%; padding: 40px 36px; overflow-y: auto; display: flex; flex-direction: column; justify-content: center; }',
      '.page-label { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #b8860b; margin-bottom: 8px; }',
      '.page-title { font-size: 26px; font-weight: bold; color: #1a1a1a; margin-bottom: 6px; line-height: 1.3; }',
      '.page-subtitle { font-size: 14px; color: #b8860b; font-style: italic; margin-bottom: 16px; }',
      '.page-body { font-size: 13px; line-height: 1.7; color: #444; }',
      '.page-photos-inline { display: flex; gap: 6px; margin-top: 16px; }',
      '.page-photos-inline img { width: 70px; height: 52px; object-fit: cover; border-radius: 3px; }',
      '.photo-page { padding: 40px; background: #0f172a; }',
      '.photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; height: 100%; }',
      '.photo-grid img { width: 100%; height: 100%; object-fit: cover; }',
      '.end-page { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, #faf5ef, #f5e6d0); }',
      '.end-title { font-size: 36px; font-weight: bold; color: #1a1a1a; margin-bottom: 8px; }',
      '.end-sub { font-size: 14px; color: #888; font-style: italic; margin-bottom: 24px; }',
      '.end-stats { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }',
      '.end-stat { padding: 12px 20px; background: rgba(255,255,255,0.7); border-radius: 8px; text-align: center; }',
      '.end-stat-value { font-size: 20px; font-weight: bold; color: #1a1a1a; }',
      '.end-stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-top: 2px; }',
    ].join('');

    const html = page(trip.title, css, coverHtml + contentHtml + photoHtml + endHtml);

    doc.open();
    doc.write(html);
    doc.close();

    const timer = setTimeout(() => {
      iframe.contentWindow?.print();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="text-4xl mb-3">🖨️</div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Print Storybook</h3>
        <p className="text-sm text-gray-500 mb-4">Your storybook will open in a print preview. Choose "Save as PDF" or send to your printer.</p>
        <iframe ref={printFrame} className="hidden" title="Print frame" />
        <div className="flex gap-2 justify-center">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Cancel</button>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button onClick={() => setShowOrder(true)}
            className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-200">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Order Photo Book
          </button>
        </div>
      </div>
    </div>

    {showOrder && (
      <OrderBookDialog
        pageCount={segments.length + 1}
        photoCount={photos.length}
        tripTitle={trip.title}
        tripId={trip.id}
        onClose={() => setShowOrder(false)}
      />
    )}
    </>
  );
}
