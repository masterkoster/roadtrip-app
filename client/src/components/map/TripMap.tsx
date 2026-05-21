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
  routeGeometry, tripId, legGeometries, onRouteWaypointDrop, flyToBounds, mapRef,
}: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    marker: maplibregl.Marker;
    fromId: number;
    toId: number;
    fromCoord: [number, number];
    toCoord: [number, number];
  } | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [currentStyle] = useState<MapStyle>(mapStyle);

  const { startMarker, endMarker } = useMemo(() => {
    if (routeGeometry && routeGeometry.length >= 2) {
      return {
        startMarker: { lat: routeGeometry[0][1], lng: routeGeometry[0][0] },
        endMarker: { lat: routeGeometry[routeGeometry.length - 1][1], lng: routeGeometry[routeGeometry.length - 1][0] },
      };
    }
    if (trackPoints.length >= 2) {
      return {
        startMarker: { lat: trackPoints[0].latitude, lng: trackPoints[0].longitude },
        endMarker: { lat: trackPoints[trackPoints.length - 1].latitude, lng: trackPoints[trackPoints.length - 1].longitude },
      };
    }
    return { startMarker: null, endMarker: null };
  }, [trackPoints, routeGeometry]);

  // Route colors optimized for dark map
  const colors = useMemo(() => ({
    route: '#00b4ff',
    routeGlow: '#00b4ff',
    routeGlowOuter: '#0044ff',
    start: '#22c55e',
    end: '#ff4444',
    waypoint: '#f59e0b',
  }), []);

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

    const styleUrl = MAP_STYLES[currentStyle] || MAP_STYLES.colorful;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: true,
      interactive,
    });

    if (interactive) {
      m.addControl(new maplibregl.NavigationControl(), 'top-right');
    }

    m.on('load', () => {
      if (!m) return;

      try { m.dragRotate?.disable(); m.touchZoomRotate?.disableRotation(); } catch {}

      const hasRoute = routeGeometry && routeGeometry.length >= 2;
      if (!hasRoute && trackPoints.length === 0) {
        onMapLoaded?.();
        return;
      }

      const coords: [number, number][] = hasRoute
        ? routeGeometry.map((c: [number, number]) => [c[0], c[1]] as [number, number])
        : trackPoints.map(p => [p.longitude, p.latitude]);

      // Full route source
      m.addSource('route-full', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      });

      const addFinalRoute = () => {
        if (!m) return;

        // Outer glow
        m.addLayer({
          id: 'route-glow-outer',
          type: 'line',
          source: 'route-full',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colors.routeGlowOuter,
            'line-width': 14,
            'line-opacity': 0.12,
            'line-blur': 8,
          },
        });

        // Inner glow
        m.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route-full',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colors.routeGlow,
            'line-width': 8,
            'line-opacity': 0.25,
            'line-blur': 4,
          },
        });

        // Main route line
        m.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-full',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colors.route,
            'line-width': 3.5,
            'line-opacity': 0.9,
          },
        });

        // Dashed outline for contrast on dark background
        m.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'route-full',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': 'rgba(255,255,255,0.15)',
            'line-width': 5,
            'line-opacity': 0.3,
            'line-dasharray': [0.5, 2],
          },
        });

        addMarkers();
      };

      if (animated) {
        m.addSource('route-animated', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [coords[0]] } },
        });

        // Animated trail glow
        m.addLayer({
          id: 'route-trail',
          type: 'line',
          source: 'route-animated',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colors.route,
            'line-width': 8,
            'line-opacity': 0.2,
            'line-blur': 6,
          },
        });

        m.addLayer({
          id: 'route-line-animated',
          type: 'line',
          source: 'route-animated',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colors.route,
            'line-width': 3.5,
            'line-opacity': 0.9,
          },
        });

        let idx = 1;
        const totalPts = coords.length;
        const drawStep = Math.max(1, Math.floor(totalPts / 60));

        function animate() {
          if (!m) return;
          idx = Math.min(idx + drawStep, totalPts);
          const slice = coords.slice(0, idx);
          const src = m.getSource('route-animated') as maplibregl.GeoJSONSource;
          if (src) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: slice } });
          if (idx < totalPts) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            try { m.removeLayer('route-line-animated'); } catch {}
            try { m.removeLayer('route-trail'); } catch {}
            try { m.removeSource('route-animated'); } catch {}
            addFinalRoute();
          }
        }

        animationRef.current = requestAnimationFrame(animate);
      } else {
        addFinalRoute();
      }

      function addMarkers() {
        // Start marker
        if (startMarker) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="width:30px;height:30px;background:${colors.start};border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2 12L22 2L12 22L10 14Z"/></svg>
          </div>`;
          new maplibregl.Marker({ element: el.firstChild as HTMLElement })
            .setLngLat([startMarker.lng, startMarker.lat])
            .setPopup(new maplibregl.Popup().setHTML('<div style="font-weight:600;font-size:13px">Start</div>'))
            .addTo(m);
        }

        // End marker
        if (endMarker) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="width:30px;height:30px;background:${colors.end};border:3px solid white;border-radius:50%;box-shadow:0 2px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
          </div>`;
          new maplibregl.Marker({ element: el.firstChild as HTMLElement })
            .setLngLat([endMarker.lng, endMarker.lat])
            .setPopup(new maplibregl.Popup().setHTML('<div style="font-weight:600;font-size:13px">End</div>'))
            .addTo(m);
        }

        // Waypoints
        waypoints.forEach((wp, i) => {
          const el = document.createElement('div');
          el.innerHTML = `<div style="width:28px;height:28px;background:${colors.waypoint};border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;cursor:pointer;">${i + 1}</div>`;
          new maplibregl.Marker({ element: el.firstChild as HTMLElement })
            .setLngLat([wp.longitude, wp.latitude])
            .setPopup(new maplibregl.Popup().setHTML(`<strong style="font-size:13px">${wp.name}</strong>${wp.description ? `<br/><span style="color:#666;font-size:12px">${wp.description}</span>` : ''}`))
            .addTo(m);
        });

        // Photos
        photos.forEach(p => {
          if (p.latitude == null || p.longitude == null) return;
          const el = document.createElement('div');
          el.innerHTML = `<div style="width:38px;height:38px;border-radius:50%;overflow:hidden;border:2px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);cursor:pointer;background:#222;">
            <img src="${p.thumbnailUrl || p.url}" style="width:100%;height:100%;object-fit:cover;" alt=""/>
          </div>`;
          const popupHtml = `<div style="max-width:240px">
            <img src="${p.url}" style="width:100%;border-radius:6px;max-height:170px;object-fit:cover;"/>
            ${p.caption ? `<p style="font-size:12px;margin-top:6px;color:#444">${p.caption}</p>` : ''}
          </div>`;
          new maplibregl.Marker({ element: el.firstChild as HTMLElement })
            .setLngLat([p.longitude, p.latitude])
            .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(popupHtml))
            .addTo(m);
        });

        // Fit bounds
        const bounds = new maplibregl.LngLatBounds();
        if (hasRoute) {
          routeGeometry.forEach((c: [number, number]) => bounds.extend(c));
        } else {
          trackPoints.forEach(p => bounds.extend([p.longitude, p.latitude]));
        }
        m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1500 });

        onMapLoaded?.();
      }
    });

    map.current = m;
    if (mapRef) mapRef.current = m;

    function findClickedLeg(lngLat: { lat: number; lng: number }): { fromId: number; toId: number; fromCoord: [number, number]; toCoord: [number, number] } | null {
      if (!legGeometries || legGeometries.length === 0) return null;
      let best: { fromId: number; toId: number; fromCoord: [number, number]; toCoord: [number, number]; dist: number } | null = null;
      for (const leg of legGeometries) {
        if (!leg.coordinates || leg.coordinates.length === 0) continue;
        for (const coord of leg.coordinates) {
          const d = Math.sqrt((coord[0] - lngLat.lng) ** 2 + (coord[1] - lngLat.lat) ** 2);
          if (!best || d < best.dist) {
            const fromWaypoint = waypoints.find(w => w.id === leg.fromId);
            const toWaypoint = waypoints.find(w => w.id === leg.toId);
            if (fromWaypoint && toWaypoint) {
              best = {
                fromId: leg.fromId,
                toId: leg.toId,
                fromCoord: [fromWaypoint.longitude, fromWaypoint.latitude],
                toCoord: [toWaypoint.longitude, toWaypoint.latitude],
                dist: d,
              };
            }
          }
        }
      }
      return best;
    }

    function updatePreview(marker: maplibregl.Marker, dragInfo: { fromId: number; toId: number; fromCoord: [number, number]; toCoord: [number, number] }) {
      if (!m) return;
      const pos = marker.getLngLat();
      const previewCoords: [number, number][] = [dragInfo.fromCoord, [pos.lng, pos.lat], dragInfo.toCoord];

      // Update straight dashed preview line immediately
      try {
        const src = m.getSource('route-preview') as maplibregl.GeoJSONSource;
        if (src) {
          src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: previewCoords } });
        }
      } catch {
        // Source may not exist yet
      }

      // Debounced OSRM preview
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      if (!tripId) return;
      previewTimeoutRef.current = setTimeout(async () => {
        try {
          const coords = [dragInfo.fromCoord, [pos.lng, pos.lat], dragInfo.toCoord].map(c => ({ longitude: c[0], latitude: c[1] }));
          const res = await fetch(`/api/trips/${tripId}/route-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waypoints: coords }),
          });
          const data = await res.json();
          if (data.geometry && data.geometry.length > 1 && m) {
            const src = m.getSource('route-preview') as maplibregl.GeoJSONSource;
            if (src) {
              src.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: data.geometry } });
            }
          }
        } catch { /* preview failed, stay with straight line */ }
      }, 500);
    }

    // Double-click: prevent default (no zoom on dblclick)
    m.on('dblclick', (e) => { e.originalEvent.preventDefault(); });

    // Click debounce: ignore the first click of a double-click
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    m.on('click', (e) => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        // Check if click hit the route line (only when legGeometries is available)
        if (legGeometries && legGeometries.length > 0 && m) {
          const features = m.queryRenderedFeatures(e.point, { layers: ['route-line'] });
          if (features.length > 0) {
            const clicked = findClickedLeg(e.lngLat);
            if (clicked) {
              // Create draggable marker
              const el = document.createElement('div');
              el.innerHTML = `<div style="width:32px;height:32px;background:#00b4ff;border:3px solid white;border-radius:50%;box-shadow:0 2px 16px rgba(0,180,255,0.6);display:flex;align-items:center;justify-content:center;cursor:grab;animation:pulse 1.5s infinite;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 4v16m8-8H4"/></svg>
              </div>
              <style>
                @keyframes pulse { 0%,100% { box-shadow: 0 2px 16px rgba(0,180,255,0.6); } 50% { box-shadow: 0 2px 24px rgba(0,180,255,1); } }
              </style>`;

              const marker = new maplibregl.Marker({ element: el.firstChild as HTMLElement, draggable: true })
                .setLngLat([e.lngLat.lng, e.lngLat.lat])
                .addTo(m);

              // Set up preview source
              try { m.removeLayer('route-preview-layer'); } catch {}
              try { m.removeSource('route-preview'); } catch {}
              m.addSource('route-preview', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [clicked.fromCoord, [e.lngLat.lng, e.lngLat.lat], clicked.toCoord] } },
              });
              m.addLayer({
                id: 'route-preview-layer',
                type: 'line',
                source: 'route-preview',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                  'line-color': '#00b4ff',
                  'line-width': 3,
                  'line-opacity': 0.7,
                  'line-dasharray': [2, 3],
                },
              });

              dragStateRef.current = { marker, ...clicked };

              marker.on('drag', () => {
                if (dragStateRef.current) updatePreview(marker, dragStateRef.current);
              });

              marker.on('dragend', () => {
                const pos = marker.getLngLat();
                marker.remove();
                try { m.removeLayer('route-preview-layer'); } catch {}
                try { m.removeSource('route-preview'); } catch {}
                dragStateRef.current = null;
                onRouteWaypointDrop?.(
                  { lat: pos.lat, lng: pos.lng },
                  { fromId: clicked.fromId, toId: clicked.toId }
                );
              });

              return; // Don't emit onMapClick
            }
          }
        }
        // onMapClick intentionally removed — user doesn't want click-to-add-waypoint
      }, 280);
    });

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      // Clean up any drag marker
      if (dragStateRef.current) {
        try { dragStateRef.current.marker.remove(); } catch {}
        dragStateRef.current = null;
      }
      try { m?.removeLayer('route-preview-layer'); } catch {}
      try { m?.removeSource('route-preview'); } catch {}
      map.current?.remove();
      map.current = null;
    };
  }, [trackPoints, waypoints, photos, animated, interactive, currentStyle, colors, startMarker, endMarker, onMapLoaded, routeGeometry, legGeometries, tripId, onRouteWaypointDrop]);

  // Fly to bounds when prop changes (day click zoom)
  const prevFlyToRef = useRef<string>('');
  useEffect(() => {
    const m = map.current;
    if (!m || !flyToBounds || flyToBounds.length < 2 || flyToBounds[0].length < 2) return;
    const key = JSON.stringify(flyToBounds);
    if (key === prevFlyToRef.current) return;
    prevFlyToRef.current = key;
    try {
      const bounds = new maplibregl.LngLatBounds();
      flyToBounds.forEach(c => bounds.extend(c as [number, number]));
      m.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 1200 });
    } catch { /* ignore */ }
  }, [flyToBounds]);

  return <div ref={mapContainer} className={`w-full h-full ${className}`} />;
}
