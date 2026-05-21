import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
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

interface Landmark {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  thumbnail: string | null;
}

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
  onRouteViaPointDrop?: (lngLat: { lat: number; lng: number }, between: { fromId: number; toId: number }) => void;
  onDeleteWaypoint?: (id: number) => void;
  flyToBounds?: [number, number][] | null;
  mapRef?: React.MutableRefObject<any>;
  landmarks?: Landmark[];
  onLandmarkClick?: (landmark: Landmark) => void;
}

export default function TripMap({
  trackPoints, waypoints = [], photos = [], animated = true,
  className = '', interactive = true, onMapLoaded, onMapClick, mapStyle = 'colorful',
  routeGeometry, tripId, legGeometries, onRouteWaypointDrop, onRouteViaPointDrop, onDeleteWaypoint,
  flyToBounds, mapRef: mapRefProp, landmarks = [], onLandmarkClick,
}: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const legGeometriesRef = useRef(legGeometries);
  const waypointsRef = useRef(waypoints);
  const onRouteWaypointDropRef = useRef(onRouteWaypointDrop);
  const onRouteViaPointDropRef = useRef(onRouteViaPointDrop);
  const onDeleteWaypointRef = useRef(onDeleteWaypoint);
  const tripIdRef = useRef(tripId);
  const onMapClickRef = useRef(onMapClick);
  const onLandmarkClickRef = useRef(onLandmarkClick);
  onLandmarkClickRef.current = onLandmarkClick;
  legGeometriesRef.current = legGeometries;
  waypointsRef.current = waypoints;
  onRouteWaypointDropRef.current = onRouteWaypointDrop;
  onRouteViaPointDropRef.current = onRouteViaPointDrop;
  onDeleteWaypointRef.current = onDeleteWaypoint;
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

    // Right-click anywhere on map → show route context menu
    let _clickedLegInfo: { fromId: number; toId: number } | null = null;
    let _clickedLngLat: { lat: number; lng: number } | null = null;
    const removeContextMenu = () => {
      const el = document.getElementById('route-context-menu');
      if (el) el.remove();
    };
    m.on('contextmenu', (e) => {
      e.originalEvent.preventDefault();
      const lg = legGeometriesRef.current;
      const wps = waypointsRef.current;
      if (!lg || lg.length === 0 || wps.length < 2 || !m) return;
      const clicked = findClickedLeg(e.lngLat, lg, wps);
      if (!clicked) return;
      removeContextMenu();
      _clickedLegInfo = { fromId: clicked.fromId, toId: clicked.toId };
      _clickedLngLat = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const menu = document.createElement('div');
      menu.id = 'route-context-menu';
      menu.style.cssText = 'position:fixed;left:' + e.originalEvent.clientX + 'px;top:' + e.originalEvent.clientY + 'px;z-index:999;background:white;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);padding:4px;min-width:160px;font-family:system-ui,sans-serif;';
      menu.innerHTML =
        '<button data-action="route-through" style="display:block;width:100%;text-align:left;padding:8px 12px;font-size:13px;border:none;background:none;cursor:pointer;border-radius:6px;color:#374151">' +
        '<span style="font-weight:500">Route through here</span><br/><span style="font-size:11px;color:#9ca3af">Force route to pass through this point</span></button>' +
        '<div style="height:1px;background:#f3f4f6;margin:2px 0"></div>' +
        '<button data-action="add-stop" style="display:block;width:100%;text-align:left;padding:8px 12px;font-size:13px;border:none;background:none;cursor:pointer;border-radius:6px;color:#374151">' +
        '<span style="font-weight:500">Add as stop</span><br/><span style="font-size:11px;color:#9ca3af">Create waypoint with name</span></button>';
      menu.addEventListener('click', (ev) => {
        const btn = (ev.target as HTMLElement).closest('button');
        if (!btn || !_clickedLegInfo || !_clickedLngLat) { menu.remove(); return; }
        const action = btn.dataset.action;
        if (action === 'route-through') {
          onRouteViaPointDropRef.current?.(_clickedLngLat, _clickedLegInfo);
        } else if (action === 'add-stop') {
          onRouteWaypointDropRef.current?.(_clickedLngLat, _clickedLegInfo);
        }
        menu.remove();
      });
      document.body.appendChild(menu);
      document.addEventListener('click', () => removeContextMenu(), { once: true });
    });

    // Route line click → show transient OSRM preview (no waypoint created)
    let _previewTimer: ReturnType<typeof setTimeout> | null = null;
    m.on('click', (e) => {
      const lg = legGeometriesRef.current;
      if (lg && lg.length > 0 && m) {
        const features = m.queryRenderedFeatures(e.point, { layers: ['route-line'] });
        if (features.length > 0) {
          const clicked = findClickedLeg(e.lngLat, lg, waypointsRef.current);
          if (clicked) {
            if (_previewTimer) clearTimeout(_previewTimer);
            // Show straight dashed preview immediately
            try { m.removeLayer('route-preview-layer'); } catch {}
            try { m.removeSource('route-preview'); } catch {}
            const coords: [number, number][] = [clicked.fromCoord, [e.lngLat.lng, e.lngLat.lat], clicked.toCoord];
            m.addSource('route-preview', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
            });
            m.addLayer({ id: 'route-preview-layer', type: 'line', source: 'route-preview', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#00b4ff', 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [2, 3] } });
            // Fetch OSRM rerouted preview
            const tripId = tripIdRef.current;
            if (tripId) {
              fetch(`/api/trips/${tripId}/route-preview`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ waypoints: [{ longitude: clicked.fromCoord[0], latitude: clicked.fromCoord[1] }, { longitude: e.lngLat.lng, latitude: e.lngLat.lat }, { longitude: clicked.toCoord[0], latitude: clicked.toCoord[1] }] }),
              }).then(r => r.json()).then(data => {
                if (data.geometry && data.geometry.length > 1) {
                  try {
                    const src = m.getSource('route-preview') as maplibregl.GeoJSONSource;
                    if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: data.geometry } });
                  } catch {}
                }
              }).catch(() => {});
            }
            // Auto-clear after 4 seconds
            _previewTimer = setTimeout(() => {
              try { m.removeLayer('route-preview-layer'); } catch {}
              try { m.removeSource('route-preview'); } catch {}
            }, 4000);
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
    // Register global delete bridge
    (window as any).__deleteWaypoint = (id: number) => {
      onDeleteWaypointRef.current?.(id);
    };
    waypoints.forEach((wp, i) => {
      const el = document.createElement('div');
      el.innerHTML = `<div style="width:28px;height:28px;background:${colors.waypoint};border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;cursor:pointer;">${i + 1}</div>`;
      const mk = new maplibregl.Marker({ element: el.firstChild as HTMLElement })
        .setLngLat([wp.longitude, wp.latitude])
        .setPopup(new maplibregl.Popup().setHTML(
          '<div style="min-width:140px;font-family:system-ui,sans-serif">' +
          '<strong style="font-size:13px">' + wp.name + '</strong>' +
          (wp.description ? '<br/><span style="color:#666;font-size:12px">' + wp.description.substring(0, 80) + '</span>' : '') +
          (wp.id ? '<br/><button onclick="window.__deleteWaypoint(' + wp.id + ')" style="margin-top:6px;padding:3px 10px;font-size:11px;background:#fee2e2;color:#dc2626;border:none;border-radius:4px;cursor:pointer">Delete</button>' : '') +
          '</div>'
        ))
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

  // Landmark markers (shown when zoomed out)
  const landmarkMarkersRef = useRef<maplibregl.Marker[]>([]);

  const renderLandmarks = useCallback(() => {
    const m = map.current;
    if (!m || !ready) return;

    landmarkMarkersRef.current.forEach(mk => mk.remove());
    landmarkMarkersRef.current = [];

    if (landmarks.length === 0) return;
    const showLandmarks = m.getZoom() <= 7;
    if (!showLandmarks) return;

    landmarks.forEach((lm) => {
      const el = document.createElement('div');
      const inner = document.createElement('div');
      inner.style.cssText = 'width:56px;height:56px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:3px solid white;border-radius:50%;box-shadow:0 4px 20px rgba(0,0,0,0.5),0 0 0 2px rgba(124,58,237,0.3);display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1;transition:transform .15s;cursor:pointer';
      inner.textContent = '🏛️';
      inner.title = lm.name;
      inner.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.15)'; });
      inner.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)'; });
      inner.addEventListener('click', () => { onLandmarkClickRef.current?.(lm); });
      el.appendChild(inner);
      const mk = new maplibregl.Marker({ element: el })
        .setLngLat([lm.longitude, lm.latitude])
        .addTo(m);
      landmarkMarkersRef.current.push(mk);
    });
  }, [landmarks, ready]);

  useEffect(() => { renderLandmarks(); }, [renderLandmarks]);

  // Re-render landmarks on zoom change
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const handler = () => { renderLandmarks(); };
    m.on('zoomend', handler);
    return () => { m.off('zoomend', handler); };
  }, [renderLandmarks]);

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


