import { useEffect, useRef, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';

const MAP_STYLES = {
  eclipse: 'https://tiles.versatiles.org/assets/styles/eclipse/style.json',
  colorful: 'https://tiles.versatiles.org/assets/styles/colorful/style.json',
  neutrino: 'https://tiles.versatiles.org/assets/styles/neutrino/style.json',
  shadow: 'https://tiles.versatiles.org/assets/styles/shadow/style.json',
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
  mapStyle?: MapStyle;
}

export default function TripMap({
  trackPoints, waypoints = [], photos = [], animated = true,
  className = '', interactive = true, onMapLoaded, mapStyle = 'eclipse',
}: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  const [currentStyle] = useState<MapStyle>(mapStyle);

  const { startMarker, endMarker } = useMemo(() => {
    if (trackPoints.length < 2) return { startMarker: null, endMarker: null };
    return {
      startMarker: { lat: trackPoints[0].latitude, lng: trackPoints[0].longitude },
      endMarker: { lat: trackPoints[trackPoints.length - 1].latitude, lng: trackPoints[trackPoints.length - 1].longitude },
    };
  }, [trackPoints]);

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

    const styleUrl = MAP_STYLES[currentStyle] || MAP_STYLES.eclipse;

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

      if (trackPoints.length === 0) {
        onMapLoaded?.();
        return;
      }

      const coords: [number, number][] = trackPoints.map(p => [p.longitude, p.latitude]);

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
        trackPoints.forEach(p => bounds.extend([p.longitude, p.latitude]));
        m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 1500 });

        onMapLoaded?.();
      }
    });

    map.current = m;

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      map.current?.remove();
      map.current = null;
    };
  }, [trackPoints, waypoints, photos, animated, interactive, currentStyle, colors, startMarker, endMarker, onMapLoaded]);

  return <div ref={mapContainer} className={`w-full h-full ${className}`} />;
}
