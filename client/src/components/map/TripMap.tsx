import { useEffect, useRef, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';

const MAP_STYLES = {
  colorful: 'https://tiles.openfreemap.org/styles/liberty',
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

type MapStyle = keyof typeof MAP_STYLES;

interface TrackPoint { latitude: number; longitude: number; elevation?: number | null; timestamp?: string | null; }
interface Waypoint { id?: number; name: string; description?: string | null; latitude: number; longitude: number; }
interface Photo { id?: number; url: string; thumbnailUrl?: string | null; latitude: number | null; longitude: number | null; caption?: string | null; }

interface TripMapProps {
  trackPoints: TrackPoint[];
  waypoints?: Waypoint[];
  photos?: Photo[];
  animated?: boolean;
  className?: string;
  interactive?: boolean;
  onMapLoaded?: () => void;
  onMapClick?: (lngLat: { lat: number; lng: number }) => void;
  mapStyle?: MapStyle;
  routeGeometry?: [number, number][];
  tripId?: number;
  legGeometries?: { fromId: number; toId: number; coordinates: [number, number][] }[];
  onRouteWaypointDrop?: (lngLat: { lat: number; lng: number }, between: { fromId: number; toId: number }) => void;
  flyToBounds?: [number, number][] | null;
  mapRef?: React.MutableRefObject<any>;
}

export default function TripMap({
  trackPoints, waypoints = [], photos = [], animated = true,
  className = '', interactive = true, onMapLoaded, onMapClick, mapStyle = 'colorful',
  routeGeometry, tripId, legGeometries, onRouteWaypointDrop, flyToBounds, mapRef: mapRefProp,
}: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const legGeometriesRef = useRef(legGeometries);
  const waypointsRef = useRef(waypoints);
  const onRouteWaypointDropRef = useRef(onRouteWaypointDrop);
  const tripIdRef = useRef(tripId);
  const onMapClickRef = useRef(onMapClick);
  legGeometriesRef.current = legGeometries;
  waypointsRef.current = waypoints;
  onRouteWaypointDropRef.current = onRouteWaypointDrop;
  tripIdRef.current = tripId;
  onMapClickRef.current = onMapClick;

  const colors = useMemo(() => ({
    route: '#00b4ff', routeGlow: '#00b4ff', routeGlowOuter: '#0044ff',
    start: '#22c55e', end: '#ff4444', waypoint: '#f59e0b',
  }), []);

  // Create map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    const hasData = trackPoints.length > 0;
    let center: [number, number] = [-98.5, 39.8];
    let zoom = 3.5;
    if (hasData) {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      trackPoints.forEach(p => {
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLng) minLng = p.longitude;
        if (p.longitude > maxLng) maxLng = p.longitude;
      });
      center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
      const maxDiff = Math.max(maxLat - minLat, maxLng - minLng);
      zoom = maxDiff > 0 ? Math.max(4, Math.min(15, Math.log2(360 / maxDiff))) : 12;
    }

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[mapStyle] || MAP_STYLES.colorful,
      center, zoom,
      attributionControl: true,
      interactive,
    });
    if (interactive) m.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current = m;
    if (mapRefProp) mapRefProp.current = m;

    m.on('load', () => {
      try { m.dragRotate?.disable(); m.touchZoomRotate?.disableRotation(); } catch {}
      // Add empty route source and layers so they exist for later updates
      const emptyGeo = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [] as [number, number][] } };
      m.addSource('route-full', { type: 'geojson', data: emptyGeo });
      m.addLayer({ id: 'route-glow-outer', type: 'line', source: 'route-full', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.routeGlowOuter, 'line-width': 14, 'line-opacity': 0.12, 'line-blur': 8 } });
      m.addLayer({ id: 'route-glow', type: 'line', source: 'route-full', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.routeGlow, 'line-width': 8, 'line-opacity': 0.25, 'line-blur': 4 } });
      m.addLayer({ id: 'route-line', type: 'line', source: 'route-full', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colors.route, 'line-width': 6, 'line-opacity': 0.9 } });
      m.addLayer({ id: 'route-outline', type: 'line', source: 'route-full', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,0.15)', 'line-width': 5, 'line-opacity': 0.3, 'line-dasharray': [0.5, 2] } });
      setReady(true);
      onMapLoaded?.();
    });

    // Route line right-click → insert stop here
    m.on('contextmenu', (e) => {
      const lg = legGeometriesRef.current;
      if (lg && lg.length > 0 && m) {
        const features = m.queryRenderedFeatures(e.point, { layers: ['route-line'] });
        if (features.length > 0) {
          e.originalEvent.preventDefault();
          const clicked = findClickedLeg(e.lngLat, lg, waypointsRef.current);
          if (clicked) {
            onRouteWaypointDropRef.current?.(
              { lat: e.lngLat.lat, lng: e.lngLat.lng },
              { fromId: clicked.fromId, toId: clicked.toId }
            );
          }
        }
      }
    });

    // Route line click → drag-to-insert
    m.on('click', (e) => {
      const lg = legGeometriesRef.current;
      if (lg && lg.length > 0 && m) {
        const features = m.queryRenderedFeatures(e.point, { layers: ['route-line'] });
        if (features.length > 0) {
          const clicked = findClickedLeg(e.lngLat, lg, waypointsRef.current);
          if (clicked) {
            const el = document.createElement('div');
            el.innerHTML = `<div style="width:32px;height:32px;background:#00b4ff;border:3px solid white;border-radius:50%;box-shadow:0 2px 16px rgba(0,180,255,0.6);display:flex;align-items:center;justify-content:center;cursor:grab;animation:pulse 1.5s infinite;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 4v16m8-8H4"/></svg>
            </div>
            <style>@keyframes pulse { 0%,100% { box-shadow: 0 2px 16px rgba(0,180,255,0.6); } 50% { box-shadow: 0 2px 24px rgba(0,180,255,1); } }</style>`;
            const marker = new maplibregl.Marker({ element: el.firstChild as HTMLElement, draggable: true })
              .setLngLat([e.lngLat.lng, e.lngLat.lat])
              .addTo(m);
            try { m.removeLayer('route-preview-layer'); } catch {}
            try { m.removeSource('route-preview'); } catch {}
            m.addSource('route-preview', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [clicked.fromCoord, [e.lngLat.lng, e.lngLat.lat], clicked.toCoord] } },
            });
            m.addLayer({ id: 'route-preview-layer', type: 'line', source: 'route-preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#00b4ff', 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [2, 3] } });
            marker.on('drag', () => updateDragPreview(marker, clicked, m, tripIdRef.current));
            marker.on('dragend', () => {
              const pos = marker.getLngLat();
              marker.remove();
              try { m.removeLayer('route-preview-layer'); } catch {}
              try { m.removeSource('route-preview'); } catch {}
              onRouteWaypointDropRef.current?.({ lat: pos.lat, lng: pos.lng }, { fromId: clicked.fromId, toId: clicked.toId });
            });
            return;
          }
        }
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
  }, []); // Only mount once

  // Update route geometry data in-place (re-applied when map becomes ready)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const hasRoute = routeGeometry && routeGeometry.length >= 2;
    const coords: [number, number][] = hasRoute
      ? routeGeometry.map(c => [c[0], c[1]] as [number, number])
      : trackPoints.map(p => [p.longitude, p.latitude] as [number, number]);
    if (coords.length < 2) return;
    try {
      const src = m.getSource('route-full') as maplibregl.GeoJSONSource;
      if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
    } catch {}
  }, [routeGeometry, trackPoints, ready]);

  // Update waypoint markers (re-applied when map becomes ready)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];
    waypoints.forEach((wp, i) => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:28px;height:28px;background:${colors.waypoint};border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;cursor:pointer;">${i + 1}</div>`;
      const mk = new maplibregl.Marker({ element: el.firstChild as HTMLElement })
        .setLngLat([wp.longitude, wp.latitude])
        .setPopup(new maplibregl.Popup().setHTML(`<strong style="font-size:13px">${wp.name}</strong>${wp.description ? `<br/><span style="color:#666;font-size:12px">${wp.description}</span>` : ''}`))
        .addTo(m);
      markersRef.current.push(mk);
    });
    // Fit bounds on first data load only
    if (waypoints.length >= 2 && !(window as any)._mapBoundsFitted) {
      (window as any)._mapBoundsFitted = true;
      const bounds = new maplibregl.LngLatBounds();
      waypoints.forEach(wp => bounds.extend([wp.longitude, wp.latitude]));
      m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1500 });
    }
  }, [waypoints, colors.waypoint, ready]);

  // Fly to bounds (day click)
  useEffect(() => {
    const m = map.current;
    if (!m || !flyToBounds || flyToBounds.length < 2 || flyToBounds[0].length < 2) return;
    const bounds = new maplibregl.LngLatBounds();
    flyToBounds.forEach(c => bounds.extend(c as [number, number]));
    m.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 1200 });
  }, [flyToBounds]);

  return <div ref={mapContainer} className={`w-full h-full ${className}`} />;
}

function findClickedLeg(lngLat: { lat: number; lng: number }, legGeometries: { fromId: number; toId: number; coordinates: [number, number][] }[], waypoints: Waypoint[]): { fromId: number; toId: number; fromCoord: [number, number]; toCoord: [number, number] } | null {
  let best: { fromId: number; toId: number; fromCoord: [number, number]; toCoord: [number, number]; dist: number } | null = null;
  for (const leg of legGeometries) {
    if (!leg.coordinates || leg.coordinates.length === 0) continue;
    for (const coord of leg.coordinates) {
      const d = Math.sqrt((coord[0] - lngLat.lng) ** 2 + (coord[1] - lngLat.lat) ** 2);
      if (!best || d < best.dist) {
        const fromWaypoint = waypoints.find(w => w.id === leg.fromId);
        const toWaypoint = waypoints.find(w => w.id === leg.toId);
        if (fromWaypoint && toWaypoint) {
          best = { fromId: leg.fromId, toId: leg.toId, fromCoord: [fromWaypoint.longitude, fromWaypoint.latitude], toCoord: [toWaypoint.longitude, toWaypoint.latitude], dist: d };
        }
      }
    }
  }
  return best;
}

let _previewTimer: ReturnType<typeof setTimeout> | null = null;
function updateDragPreview(marker: maplibregl.Marker, dragInfo: { fromId: number; toId: number; fromCoord: [number, number]; toCoord: [number, number] }, m: maplibregl.Map, tripId: number | undefined) {
  const pos = marker.getLngLat();
  const previewCoords: [number, number][] = [dragInfo.fromCoord, [pos.lng, pos.lat], dragInfo.toCoord];
  try {
    const src = m.getSource('route-preview') as maplibregl.GeoJSONSource;
    if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: previewCoords } });
  } catch {}
  if (_previewTimer) clearTimeout(_previewTimer);
  if (!tripId) return;
  _previewTimer = setTimeout(async () => {
    try {
      const coords = [dragInfo.fromCoord, [pos.lng, pos.lat], dragInfo.toCoord].map(c => ({ longitude: c[0], latitude: c[1] }));
      const res = await fetch(`/api/trips/${tripId}/route-preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waypoints: coords }) });
      const data = await res.json();
      if (data.geometry && data.geometry.length > 1) {
        const src = m.getSource('route-preview') as maplibregl.GeoJSONSource;
        if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: data.geometry } });
      }
    } catch {}
  }, 500);
}
