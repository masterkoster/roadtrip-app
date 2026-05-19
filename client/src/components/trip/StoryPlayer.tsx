import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import api from '../../api/client';
import VehicleIcon, { type VehicleType } from './VehicleIcon';

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

interface TrackPoint {
  latitude: number;
  longitude: number;
}

interface StoryPlayerProps {
  tripId: number;
  segments: StorySegment[];
  waypoints: Waypoint[];
  photos: Photo[];
  trackPoints: TrackPoint[];
  vehicle: VehicleType;
  onClose: () => void;
}

type Speed = 1 | 2 | 4;

const MAP_STYLE = 'https://tiles.versatiles.org/assets/styles/eclipse/style.json';
const WAYPOINT_PAUSE_MS = 5000;
const SEGMENT_FLY_MS = 3000;

export default function StoryPlayer({ tripId, segments, waypoints, photos, trackPoints, vehicle, onClose }: StoryPlayerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSegment = segments[currentIdx];
  const currentWaypoint = waypoints.find(w => w.id === currentSegment?.waypointId);
  const isLastSegment = currentIdx >= segments.length - 1;

  const waypointPhotos = photos.filter(p => {
    if (!currentWaypoint || p.latitude == null || p.longitude == null) return false;
    const dlat = p.latitude - currentWaypoint.latitude;
    const dlng = p.longitude - currentWaypoint.longitude;
    return Math.sqrt(dlat * dlat + dlng * dlng) < 1;
  }).slice(0, 5);

  const saveEdit = useCallback(async () => {
    if (!currentSegment || !editContent.trim()) return;
    try {
      await api.put(`/guides/${currentSegment.id}`, { segments: [{ ...currentSegment, content: editContent }] });
      currentSegment.content = editContent;
      setEditing(false);
    } catch { /* silent */ }
  }, [currentSegment, editContent]);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= segments.length) return;
    setCurrentIdx(idx);
    setEditContent(segments[idx].content);

    const wp = waypoints.find(w => w.id === segments[idx].waypointId);
    if (wp && map.current) {
      map.current.flyTo({
        center: [wp.longitude, wp.latitude],
        zoom: 10,
        pitch: 55,
        bearing: idx * 15,
        duration: SEGMENT_FLY_MS,
      });
    }
  }, [segments, waypoints]);

  const next = useCallback(() => {
    if (!isLastSegment) goTo(currentIdx + 1);
  }, [currentIdx, isLastSegment, goTo]);

  const prev = useCallback(() => {
    if (currentIdx > 0) goTo(currentIdx - 1);
  }, [currentIdx, goTo]);

  const togglePlay = () => setPlaying(p => !p);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const center: [number, number] = [-98.5, 39.8];
    if (currentWaypoint) {
      center[0] = currentWaypoint.longitude;
      center[1] = currentWaypoint.latitude;
    }

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center,
      zoom: 5,
      pitch: 40,
      attributionControl: false,
      dragRotate: false,
    });

    m.on('load', () => {
      try { m.dragRotate?.disable(); m.touchZoomRotate?.disableRotation(); } catch {}

      // Route line
      if (trackPoints.length > 1) {
        const coords: [number, number][] = trackPoints.map(p => [p.longitude, p.latitude]);
        m.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
        });
        m.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#00b4ff', 'line-width': 8, 'line-opacity': 0.2, 'line-blur': 6 },
        });
        m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#00b4ff', 'line-width': 3, 'line-opacity': 0.7 },
        });
      }

      // Waypoint markers
      waypoints.forEach((wp, i) => {
        const el = document.createElement('div');
        el.style.cssText = `width:36px;height:36px;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;`;
        el.textContent = String(i + 1);
        new maplibregl.Marker({ element: el })
          .setLngLat([wp.longitude, wp.latitude])
          .addTo(m);
      });

      // Fly to first waypoint
      if (currentWaypoint) {
        m.flyTo({ center: [currentWaypoint.longitude, currentWaypoint.latitude], zoom: 10, pitch: 55, duration: 2000 });
      }
    });

    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (playing && !isLastSegment && !editing) {
      timerRef.current = setTimeout(() => {
        next();
      }, WAYPOINT_PAUSE_MS / speed);
    } else if (playing && isLastSegment) {
      // Wait a bit then show "The End"
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, currentIdx, speed, isLastSegment, next, editing]);

  // Initial edit content
  useEffect(() => {
    if (currentSegment) {
      setEditContent(currentSegment.content);
    }
  }, [currentSegment?.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Map fullscreen */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Overlay gradient */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/30" />

      {/* Exit button */}
      <button onClick={onClose} className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors pointer-events-auto">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      {/* Segment counter top-right */}
      <div className="absolute top-4 right-4 z-10 bg-black/30 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm font-medium pointer-events-auto">
        {currentIdx + 1} / {segments.length}
      </div>

      {/* Vehicle icon + waypoint name */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none">
        <div className="text-white/90 drop-shadow-lg">
          <VehicleIcon type={vehicle} size={48} />
        </div>
        {currentWaypoint && (
          <h2 className="text-white text-lg font-bold drop-shadow-lg text-center px-4">
            {currentWaypoint.name}
          </h2>
        )}
      </div>

      {/* Story panel - bottom */}
      <div className="absolute bottom-20 left-4 right-4 z-10 pointer-events-auto max-w-3xl mx-auto">
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
          {currentSegment && (
            <>
              <h3 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-1">
                {currentSegment.title}
              </h3>
              {editing ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full bg-black/30 text-white text-sm rounded-lg p-3 border border-white/20 focus:border-roadtrip-400 focus:outline-none resize-none min-h-[120px]"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="px-4 py-1.5 bg-roadtrip-600 hover:bg-roadtrip-700 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
                    <button onClick={() => setEditing(false)} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="text-white/95 text-sm leading-relaxed max-h-[120px] overflow-y-auto scrollbar-thin">
                    {currentSegment.content}
                  </p>
                  <button onClick={() => { setEditing(true); setEditContent(currentSegment.content); }}
                    className="absolute top-0 right-0 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Photos strip */}
      {waypointPhotos.length > 0 && (
        <div className="absolute bottom-44 left-4 right-4 z-10 pointer-events-auto max-w-3xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {waypointPhotos.map(p => (
              <img key={p.id} src={p.thumbnailUrl || p.url} alt={p.caption || ''}
                className="h-16 w-24 rounded-xl object-cover shrink-0 ring-1 ring-white/20 shadow-lg cursor-pointer hover:ring-roadtrip-400 transition-all"
                onClick={() => window.open(p.url, '_blank')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
        <div className="max-w-3xl mx-auto px-4 pb-6 pt-12">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-3 justify-center">
            {segments.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIdx ? 'w-8 bg-roadtrip-400' : 'w-1.5 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button onClick={prev} disabled={currentIdx === 0}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            <button onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
              {playing ? (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-white ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
            </button>

            <button onClick={next} disabled={isLastSegment}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Speed toggle */}
            <button onClick={() => setSpeed(s => s === 4 ? 1 : s === 1 ? 2 : 4 as Speed)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                speed > 1 ? 'bg-roadtrip-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}>
              {speed}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
