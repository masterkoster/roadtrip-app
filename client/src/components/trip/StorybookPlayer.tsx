import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import toast from 'react-hot-toast';
import api from '../../api/client';
import VehicleIcon, { type VehicleType } from './VehicleIcon';
import GlobeView from './GlobeView';
import PrintStoryView from './PrintStoryView';

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

interface StorybookPlayerProps {
  tripId: number;
  segments: StorySegment[];
  waypoints: Waypoint[];
  photos: Photo[];
  trackPoints: TrackPoint[];
  vehicle: VehicleType;
  trip: TripInfo;
  guideId?: number;
  readOnly?: boolean;
  allowShare?: boolean;
  soundtrackUrl?: string | null;
  onClose: () => void;
}

type Speed = 1 | 2 | 4;

const MAP_STYLE = 'https://tiles.versatiles.org/assets/styles/eclipse/style.json';
const SLIDE_PAUSE_MS = 7000;

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function StorybookPlayer({
  tripId,
  segments,
  waypoints,
  photos,
  trackPoints,
  vehicle,
  trip,
  guideId,
  readOnly = false,
  allowShare = false,
  soundtrackUrl,
  onClose,
}: StorybookPlayerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [viewMode, setViewMode] = useState<'story' | 'map' | 'globe'>('story');
  const [showPrint, setShowPrint] = useState(false);
  const styleInjected = useRef(false);
  const slideRef = useRef(currentSlide);

  const totalSlides = segments.length + 2;
  const isCover = currentSlide === 0;
  const isTheEnd = currentSlide === totalSlides - 1;
  const segmentIdx = currentSlide - 1;
  const currentSegment = isCover || isTheEnd ? null : segments[segmentIdx];
  const currentWaypoint = currentSegment
    ? waypoints.find(w => w.id === currentSegment.waypointId)
    : null;

  const waypointPhotos = useMemo(() => {
    if (!currentWaypoint) return [] as Photo[];
    return photos.filter(p => {
      if (p.latitude == null || p.longitude == null) return false;
      const dlat = p.latitude - currentWaypoint.latitude;
      const dlng = p.longitude - currentWaypoint.longitude;
      return Math.sqrt(dlat * dlat + dlng * dlng) < 1;
    }).slice(0, 6);
  }, [currentWaypoint, photos]);

  const coverPhoto = photos[0]?.url || null;

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= totalSlides) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentSlide(idx);
      setEditContent(segments[idx - 1]?.content || '');
      setAnimating(false);
    }, 250);
  }, [segments, totalSlides]);

  const next = useCallback(() => {
    if (currentSlide < totalSlides - 1) goTo(currentSlide + 1);
  }, [currentSlide, totalSlides, goTo]);

  const prev = useCallback(() => {
    if (currentSlide > 0) goTo(currentSlide - 1);
  }, [currentSlide, goTo]);

  useEffect(() => {
    if (!soundtrackUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      audioRef.current.volume = 0.35;
    }
    audioRef.current.src = soundtrackUrl;
    audioRef.current.play().catch(() => {});
    return () => {
      audioRef.current?.pause();
    };
  }, [soundtrackUrl]);

  const goToRef = useRef(goTo);
  useEffect(() => { goToRef.current = goTo; }, [goTo]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (playingRef.current && !editing && slideRef.current < totalSlides - 1) {
      timerRef.current = setTimeout(() => {
        if (playingRef.current) {
          goToRef.current(slideRef.current + 1);
        }
      }, SLIDE_PAUSE_MS / speed);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, editing, currentSlide, totalSlides, speed, segments]);

  useEffect(() => {
    if (readOnly) setEditing(false);
  }, [readOnly, currentSegment?.id]);

  useEffect(() => {
    if (!mapContainer.current || map.current || !currentWaypoint) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [currentWaypoint.longitude, currentWaypoint.latitude],
      zoom: 7,
      pitch: 55,
      attributionControl: false,
    });

    if (!styleInjected.current) {
      const s = document.createElement('style');
      s.id = 'storybook-map-styles';
      s.textContent = `
        @keyframes pulse-marker { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
        .pulse-dot { animation:pulse-marker 2s ease-out infinite; }
      `;
      document.head.appendChild(s);
      styleInjected.current = true;
    }

    m.on('load', () => {
      try { m.dragRotate?.disable(); m.touchZoomRotate?.disableRotation(); } catch {}

      const waypointOrder = [...waypoints].sort((a, b) => a.orderIndex - b.orderIndex);

      if (trackPoints.length > 1) {
        const segIdx = waypointOrder.findIndex(w => w.id === currentWaypoint.id);

        const segmentCount = Math.max(1, waypoints.length - 1);
        const ptsPerSeg = Math.max(1, Math.floor(trackPoints.length / segmentCount));
        const visibleCount = segIdx >= 0 ? Math.min((segIdx + 1) * ptsPerSeg, trackPoints.length) : trackPoints.length;

        const visibleCoords: [number, number][] = trackPoints.slice(0, visibleCount).map(p => [p.longitude, p.latitude]);
        const fullCoords: [number, number][] = trackPoints.map(p => [p.longitude, p.latitude]);

        m.addSource('route-full', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: fullCoords } },
        });
        m.addSource('route-traveled', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: visibleCoords } },
        });

        m.addLayer({
          id: 'route-future',
          type: 'line',
          source: 'route-full',
          paint: { 'line-color': '#6b7280', 'line-width': 2, 'line-opacity': 0.2, 'line-dasharray': [2, 4] },
        });
        m.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route-traveled',
          paint: { 'line-color': '#f59e0b', 'line-width': 8, 'line-opacity': 0.2, 'line-blur': 6 },
        });
        m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-traveled',
          paint: { 'line-color': '#f59e0b', 'line-width': 3, 'line-opacity': 0.8 },
        });
      }
      waypointOrder.forEach((wp, i) => {
        const isCurrent = wp.id === currentWaypoint.id;
        const isPast = wp.orderIndex < currentWaypoint.orderIndex;

        if (isCurrent) {
          const container = document.createElement('div');
          container.style.cssText = 'width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;';
          const pulse = document.createElement('div');
          pulse.className = 'pulse-dot';
          pulse.style.cssText = 'position:absolute;inset:-4px;border-radius:50%;border:3px solid #f59e0b;';
          container.appendChild(pulse);
          const inner = document.createElement('div');
          inner.style.cssText = 'width:36px;height:36px;background:#f59e0b;border:3px solid white;border-radius:50%;box-shadow:0 0 24px rgba(245,158,11,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;font-family:sans-serif;position:relative;z-index:1;';
          inner.textContent = String(i + 1);
          container.appendChild(inner);
          new maplibregl.Marker({ element: container }).setLngLat([wp.longitude, wp.latitude]).addTo(m);
        } else {
          const el = document.createElement('div');
          const color = isPast ? '#d97706' : '#6b7280';
          const size = isPast ? 28 : 24;
          el.style.cssText = `width:${size}px;height:${size}px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;font-family:sans-serif;opacity:${isPast ? 0.8 : 0.4};`;
          el.textContent = String(i + 1);
          new maplibregl.Marker({ element: el }).setLngLat([wp.longitude, wp.latitude]).addTo(m);
        }
      });
    });

    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWaypoint?.id]);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { slideRef.current = currentSlide; }, [currentSlide]);

  useEffect(() => {
    if (viewMode === 'map' && map.current) {
      map.current.resize();
    }
  }, [viewMode]);

  useEffect(() => {
    if (!map.current || !currentWaypoint || isCover || isTheEnd) return;
    map.current.flyTo({
      center: [currentWaypoint.longitude, currentWaypoint.latitude],
      zoom: 9,
      pitch: 55,
      bearing: currentSlide * 12,
      duration: 2200,
    });
  }, [currentWaypoint, currentSlide, isCover, isTheEnd]);

  const togglePlay = () => setPlaying(p => { playingRef.current = !p; return !p; });

  const saveEdit = useCallback(async () => {
    if (!currentSegment || !guideId || readOnly) return;
    const content = editContent.trim();
    if (!content) return;
    try {
      const updated = segments.map((seg, idx) => ({
        title: seg.title,
        content: seg.id === currentSegment.id ? content : seg.content,
        waypointId: seg.waypointId,
        orderIndex: idx,
      }));
      await api.put(`/guides/${guideId}`, { segments: updated });
      currentSegment.content = content;
      setEditing(false);
      toast.success('Story updated');
    } catch {
      toast.error('Failed to save');
    }
  }, [currentSegment, editContent, segments, guideId, readOnly]);

  const shareStory = useCallback(async () => {
    try {
      const { data } = await api.post(`/stories/${tripId}/share`);
      const url = `${window.location.origin}/story/${data.token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch {
      toast.error('Unable to create share link');
    }
  }, [tripId]);

  return (
    <><div className="fixed inset-0 z-50 bg-[#faf6ef]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-amber-50 via-transparent to-amber-100/60" />

      <div className="absolute inset-0 flex flex-col" style={{ paddingBottom: '56px' }}>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative min-h-0">
          <div className="relative w-full max-w-6xl h-full min-h-0 max-h-[920px] bg-white rounded-[2.2rem] shadow-2xl border border-amber-200/40 overflow-hidden flex flex-col">
            <div className="absolute inset-3 rounded-[1.6rem] border border-amber-200/40 pointer-events-none" />

            {isCover && (
              <div className="flex-1 flex flex-col relative overflow-hidden rounded-[2.2rem]">
                {coverPhoto ? (
                  <div className="absolute inset-0">
                    <img src={coverPhoto} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-800 to-amber-900" />
                )}
                <div className="absolute top-6 left-0 right-0 text-center">
                  <div className="text-[10px] uppercase tracking-[0.45em] text-white/50">A Road Trip Story</div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center relative">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)] mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{trip.title}</h1>
                  {trip.description && (
                    <p className="text-sm sm:text-base text-white/80 max-w-lg leading-relaxed italic drop-shadow-lg" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{trip.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-5 text-xs text-white/60">
                    {trip.startDate && <span>{fmtDate(trip.startDate)}</span>}
                    {trip.endDate && <span>– {fmtDate(trip.endDate)}</span>}
                  </div>
                  <div className="mt-5"><VehicleIcon type={vehicle} size={44} /></div>
                </div>
                <div className="px-6 pb-6 space-y-3 relative">
                  <div className="flex items-center justify-center gap-5 text-[10px] text-white/70 bg-white/10 backdrop-blur-md rounded-2xl py-2.5 px-4">
                    {trip.distance != null && <span className="flex items-center gap-1.5">📏 <strong className="text-white/90">{trip.distance.toFixed(0)} km</strong></span>}
                    {trip.duration != null && <span className="flex items-center gap-1.5">⏱️ <strong className="text-white/90">{formatDuration(trip.duration)}</strong></span>}
                    <span className="flex items-center gap-1.5">📍 <strong className="text-white/90">{waypoints.length} stops</strong></span>
                    <span className="flex items-center gap-1.5">📷 <strong className="text-white/90">{photos.length} photos</strong></span>
                  </div>
                  <button onClick={() => { playingRef.current = true; setPlaying(true); goTo(1); }}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/30">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    Begin story
                  </button>
                </div>
              </div>
            )}

            {currentSegment && currentWaypoint && (
              <div className={`flex-1 flex flex-col lg:flex-row transition-all duration-300 min-h-0 ${animating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
                <div className={`relative ${viewMode !== 'story' ? 'flex-1' : 'lg:w-[75%] h-[42%] lg:h-full'} bg-gray-900 overflow-hidden`}>
                  <div ref={mapContainer}
                    className={`absolute inset-0 transition-opacity duration-500 ${viewMode === 'map' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
                  {viewMode === 'globe' && (
                    <GlobeView
                      trackPoints={trackPoints}
                      waypoints={waypoints}
                      currentWaypointId={currentWaypoint.id}
                      className="absolute inset-0"
                    />
                  )}
                  {viewMode === 'globe' && (
                    <>
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10 text-white">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300/70 mb-1">Stop {currentSlide - 1} of {segments.length}</div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold drop-shadow-lg" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentWaypoint.name}</h2>
                        {currentSegment.title !== currentWaypoint.name && (
                          <div className="text-sm text-amber-200/70 italic mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentSegment.title}</div>
                        )}
                        <p className="text-sm sm:text-base text-white/80 max-w-2xl mt-3 leading-relaxed whitespace-pre-line line-clamp-3">{currentSegment.content}</p>
                      </div>
                      <button onClick={() => setViewMode('story')}
                        className="absolute top-4 left-4 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs rounded-xl px-3 py-1.5 flex items-center gap-1.5 transition-all border border-white/20">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Photos
                      </button>
                    </>
                  )}
                  {viewMode === 'map' && (
                    <>
                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10 text-white">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300/70 mb-1">Stop {currentSlide - 1} of {segments.length}</div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold drop-shadow-lg" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentWaypoint.name}</h2>
                        {currentSegment.title !== currentWaypoint.name && (
                          <div className="text-sm text-amber-200/70 italic mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentSegment.title}</div>
                        )}
                        <p className="text-sm sm:text-base text-white/80 max-w-2xl mt-3 leading-relaxed whitespace-pre-line line-clamp-3">{currentSegment.content}</p>
                      </div>
                      {!editing && waypointPhotos.length > 0 && (
                        <div className="absolute top-4 right-4 flex gap-1.5">
                          {waypointPhotos.slice(0, 3).map(photo => (
                            <img key={photo.id} src={photo.thumbnailUrl || photo.url} alt=""
                              className="w-14 h-14 rounded-xl object-cover ring-2 ring-white/30 shadow-lg cursor-pointer hover:ring-white/60 transition-all"
                              onClick={() => window.open(photo.url, '_blank')}
                            />
                          ))}
                        </div>
                      )}
                      <button onClick={() => setViewMode('story')}
                        className="absolute top-4 left-4 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs rounded-xl px-3 py-1.5 flex items-center gap-1.5 transition-all border border-white/20">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Photos
                      </button>
                    </>
                  )}
                  <div className={`absolute inset-0 transition-opacity duration-500 ${viewMode === 'story' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    {waypointPhotos.length > 0 ? (
                      <img src={waypointPhotos[0].url} alt="" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 via-amber-50 to-amber-200">
                        <svg className="w-24 h-24 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.28em] text-white/80 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      Stop {currentSlide - 1} of {segments.length}
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold drop-shadow-lg" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentWaypoint.name}</h2>
                      {currentSegment.title !== currentWaypoint.name && (
                        <div className="text-xs sm:text-sm text-white/80 italic mt-0.5 drop-shadow" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{currentSegment.title}</div>
                      )}
                    </div>
                    <div className="absolute top-3 right-3 flex gap-1.5">
                      <button onClick={() => setViewMode('map')}
                        className="z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs rounded-full px-3 py-1.5 flex items-center gap-1.5 transition-all border border-white/30 shadow-lg">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                        2D
                      </button>
                      <button onClick={() => setViewMode('globe')}
                        className="z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs rounded-full px-3 py-1.5 flex items-center gap-1.5 transition-all border border-white/30 shadow-lg">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                        3D
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`${viewMode !== 'story' ? 'hidden' : 'flex-1'} flex flex-col p-5 lg:p-8 bg-white overflow-y-auto`}>
                  {editing ? (
                    <div className="space-y-2 flex-1 flex flex-col">
                      <textarea
                        className="w-full bg-gray-50 text-gray-700 text-sm rounded-xl p-3 border border-gray-200 focus:border-amber-400 focus:outline-none resize-none min-h-[140px] flex-1"
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors">Save</button>
                        <button onClick={() => setEditing(false)} className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 group relative">
                      <p className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line">{currentSegment.content}</p>
                      {!readOnly && guideId && (
                        <button onClick={() => { setEditing(true); setEditContent(currentSegment.content); }}
                          className="absolute top-0 right-0 p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      )}
                    </div>
                  )}

                  {waypointPhotos.length > 1 && !editing && (
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                      {waypointPhotos.slice(1).map(photo => (
                        <div key={photo.id} className="shrink-0 bg-white pb-1.5 rounded-lg shadow-sm border border-gray-100 overflow-hidden w-24">
                          <img src={photo.thumbnailUrl || photo.url} alt={photo.caption || ''}
                            className="w-24 h-16 object-cover cursor-pointer"
                            onClick={() => window.open(photo.url, '_blank')}
                          />
                          {photo.caption && <p className="text-[9px] text-gray-400 truncate px-1.5 pt-0.5">{photo.caption}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isTheEnd && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-amber-50 via-white to-amber-100/50">
                <div className="text-5xl mb-4">🏁</div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>The End</h2>
                <p className="text-base text-gray-500 italic max-w-md mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Every journey tells a story. Thanks for coming along.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto mb-6 text-gray-900">
                  {trip.distance != null && (
                    <div className="bg-white/85 rounded-xl p-3 border border-amber-100">
                      <div className="text-lg font-bold">{trip.distance.toFixed(0)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">km travelled</div>
                    </div>
                  )}
                  {trip.duration != null && (
                    <div className="bg-white/85 rounded-xl p-3 border border-amber-100">
                      <div className="text-lg font-bold">{formatDuration(trip.duration)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">time on road</div>
                    </div>
                  )}
                  <div className="bg-white/85 rounded-xl p-3 border border-amber-100">
                    <div className="text-lg font-bold">{waypoints.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">stops</div>
                  </div>
                  <div className="bg-white/85 rounded-xl p-3 border border-amber-100">
                    <div className="text-lg font-bold">{segments.length}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">chapters</div>
                  </div>
                </div>
                {photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap justify-center max-w-md mb-6">
                    {photos.slice(0, 4).map(photo => (
                      <img key={photo.id} src={photo.thumbnailUrl || photo.url} alt=""
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-sm ring-2 ring-white" />
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setShowPrint(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 rounded-xl text-sm font-semibold transition-all shadow-md border border-amber-200">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print Story
                  </button>
                  {allowShare && !readOnly && (
                    <button onClick={shareStory}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-200">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      Share This Story
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="absolute bottom-4 right-6 text-xs text-amber-700/60 font-medium z-10">{currentSlide + 1} / {totalSlides}</div>
          </div>
        </div>
      </div>

      <button onClick={onClose} className="absolute top-4 left-4 z-20 w-10 h-10 bg-white/80 hover:bg-white backdrop-blur-sm rounded-xl flex items-center justify-center transition-all shadow-sm border border-amber-200/30">
        <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      <div className="absolute bottom-0 left-0 right-0 z-50 bg-white border-t border-amber-200/30 px-4 py-3 flex items-center justify-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <button onClick={prev} disabled={currentSlide === 0}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === currentSlide ? 'w-6 bg-amber-500' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`} />
          ))}
        </div>

        <button onClick={next} disabled={currentSlide === totalSlides - 1}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button onClick={togglePlay}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-100 hover:bg-amber-200 transition-colors">
          {playing ? (
            <svg className="w-4 h-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
          ) : (
            <svg className="w-4 h-4 text-amber-700 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
          )}
        </button>

        <button onClick={() => setSpeed(s => (s === 4 ? 1 : s === 1 ? 2 : 4))}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${speed > 1 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {speed}x
        </button>

        <button onClick={() => setShowPrint(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors ml-1" title="Print storybook">
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
        </button>
      </div>
    </div>

    {showPrint && (
      <PrintStoryView
        trip={trip}
        segments={segments}
        waypoints={waypoints}
        photos={photos}
        vehicle={vehicle}
        onClose={() => setShowPrint(false)}
      />
    )}
  </>
  );
}
