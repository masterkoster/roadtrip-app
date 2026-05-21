import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import TripMap from '../components/map/TripMap';
import WaypointPanel from '../components/trip/WaypointPanel';
import ItineraryTimeline from '../components/trip/ItineraryTimeline';
import toast from 'react-hot-toast';

interface Waypoint {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  orderIndex: number;
  duration: number | null;
  dayIndex: number | null;
}

interface TrackPoint {
  id: number;
  latitude: number;
  longitude: number;
  elevation: number | null;
  timestamp: string | null;
}

interface Trip {
  id: number;
  title: string;
  vehicle: string;
}

interface LegStat {
  fromId: number;
  toId: number;
  distanceKm: number;
  durationHours: number;
}

interface CostData {
  fuelCost: { total: number; perLeg: number[] };
  accommodationCost: { total: number; nights: number; perNight: number };
  totalEstimatedCost: number;
}

type Tab = 'stops' | 'find' | 'itinerary';

const CAT_ICONS: Record<string, string> = {
  food: '🍽️', fuel: '⛽', camping: '🏕️', viewpoint: '🏔️',
  attraction: '🎯', museum: '🏛️', park: '🌳', historical: '🏰',
  entertainment: '🎭', shopping: '🛍️', beach: '🏖️',
  lodging: '🏨', parking: '🅿️', restroom: '🚻',
};

export default function PlanningPage() {
  const { id } = useParams();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('stops');
  const [panelOpen, setPanelOpen] = useState(true);

  // Map click → add stop
  const [pendingLat, setPendingLat] = useState<number | null>(null);
  const [pendingLng, setPendingLng] = useState<number | null>(null);

  // Route geometry + leg stats from estimate-stops
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [legStats, setLegStats] = useState<LegStat[]>([]);
  const [legGeometries, setLegGeometries] = useState<{ fromId: number; toId: number; coordinates: [number, number][] }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [costData, setCostData] = useState<CostData | null>(null);

  // Day selection + places
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayPlacesCache, setDayPlacesCache] = useState<Map<number, any[]>>(new Map());
  const cacheRef = useRef(dayPlacesCache);
  cacheRef.current = dayPlacesCache;
  const [dayPlacesLoading, setDayPlacesLoading] = useState(false);
  const [flyToBounds, setFlyToBounds] = useState<[number, number][] | null>(null);
  const [dayItinerary, setDayItinerary] = useState<any>(null);

  const fetchDayPlaces = useCallback(async (dayIndex: number): Promise<any[]> => {
    // Get centroid from itinerary or waypoints
    const legWps: [number, number][] = [];
    if (dayItinerary?.days) {
      const day = dayItinerary.days.find((d: any) => d.day === dayIndex);
      if (day) {
        for (const leg of day.legs || []) {
          const fw = waypoints.find(w => w.id === leg.fromId);
          if (fw) legWps.push([fw.latitude, fw.longitude]);
          const tw = waypoints.find(w => w.id === leg.toId);
          if (tw) legWps.push([tw.latitude, tw.longitude]);
        }
      }
    }
    // Fallback: if itinerary not loaded yet, use all waypoints
    if (legWps.length === 0) {
      waypoints.forEach(w => legWps.push([w.latitude, w.longitude]));
    }
    if (legWps.length === 0) return [];
    const lat = legWps.reduce((s, c) => s + c[0], 0) / legWps.length;
    const lng = legWps.reduce((s, c) => s + c[1], 0) / legWps.length;
    const { data } = await api.post(`/trips/${id}/day-places`, { lat, lng, day: dayIndex });
    return data.places || [];
  }, [dayItinerary, waypoints, id]);

  const handleDayClick = useCallback((dayIndex: number) => {
    setSelectedDay(dayIndex);
    // Zoom map to this day's area
    if (dayItinerary?.days) {
      const day = dayItinerary.days.find((d: any) => d.day === dayIndex);
      if (day) {
        const dayCoords: [number, number][] = [];
        day.legs?.forEach((leg: any) => {
          if (leg.fromId) {
            const wp = waypoints.find(w => w.id === leg.fromId);
            if (wp) dayCoords.push([wp.longitude, wp.latitude]);
          }
        });
        const lastLeg = day.legs?.[day.legs.length - 1];
        if (lastLeg?.toId) {
          const wp = waypoints.find(w => w.id === lastLeg.toId);
          if (wp) dayCoords.push([wp.longitude, wp.latitude]);
        }
        if (dayCoords.length >= 2) {
          const lngs = dayCoords.map(c => c[0]);
          const lats = dayCoords.map(c => c[1]);
          const pad = 1.0;
          const expanded: [number, number][] = [
            [Math.min(...lngs) - pad, Math.min(...lats) - pad],
            [Math.max(...lngs) + pad, Math.max(...lats) + pad],
          ];
          setFlyToBounds(expanded);
        }
      }
    }
    setTab('itinerary');
    setPanelOpen(true);
    // On-demand fetch if not cached yet
    if (!cacheRef.current.has(dayIndex)) {
      setDayPlacesLoading(true);
      fetchDayPlaces(dayIndex).then(places => {
        setDayPlacesCache(prev => {
          const next = new Map(prev);
          next.set(dayIndex, places);
          return next;
        });
        setDayPlacesLoading(false);
      });
    }
  }, [dayItinerary, waypoints, fetchDayPlaces]);

  // Pre-fetch day places when itinerary data arrives
  const prefetchDayPlaces = useCallback(async (days: any[]) => {
    if (!days || days.length === 0) return;
    setDayPlacesLoading(true);
    const newCache = new Map(dayPlacesCache);
    const promises = days.map(async (day: any) => {
      if (newCache.has(day.day)) return;
      // Calculate centroid of day's legs
      let sumLat = 0, sumLng = 0, count = 0;
      const seen = new Set<number>();
      day.legs?.forEach((leg: any) => {
        const fromWp = waypoints.find(w => w.id === leg.fromId);
        const toWp = waypoints.find(w => w.id === leg.toId);
        if (fromWp && !seen.has(fromWp.id)) { sumLat += fromWp.latitude; sumLng += fromWp.longitude; count++; seen.add(fromWp.id); }
        if (toWp && !seen.has(toWp.id)) { sumLat += toWp.latitude; sumLng += toWp.longitude; count++; seen.add(toWp.id); }
      });
      if (count === 0) return;
      const lat = sumLat / count;
      const lng = sumLng / count;
      try {
        const { data } = await api.post(`/trips/${id}/day-places`, { lat, lng, day: day.day });
        newCache.set(day.day, data.places || []);
      } catch { /* silent */ }
    });
    await Promise.allSettled(promises);
    setDayPlacesCache(newCache);
    setDayPlacesLoading(false);
  }, [id, waypoints, dayPlacesCache]);

  // When itinerary data is set (from estimate-stops), pre-fetch day places
  useEffect(() => {
    if (dayItinerary?.days && dayItinerary.days.length > 0) {
      prefetchDayPlaces(dayItinerary.days);
    }
  }, [dayItinerary?.days?.length]);

  // Map instance ref (for getting viewport bounds)
  const mapRef = useRef<any>(null);

  // POI state
  const [pois, setPois] = useState<Record<string, any[]>>({});
  const [poiCategories, setPoiCategories] = useState<any[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [activePoiCat, setActivePoiCat] = useState<string | null>(null);
  const [addingPoi, setAddingPoi] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    try {
      const { data } = await api.get(`/trips/${id}`);
      setTrip(data);
      setWaypoints(data.waypoints || []);
      setTrackPoints(data.trackPoints || []);
    } catch {
      toast.error('Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  const handleMapClick = useCallback((lngLat: { lat: number; lng: number }) => {
    setTab('stops');
    setPendingLat(lngLat.lat);
    setPendingLng(lngLat.lng);
    setPanelOpen(true);
    toast('Location selected — name your stop');
  }, []);

  const handleRouteWaypointDrop = useCallback(async (lngLat: { lat: number; lng: number }, between: { fromId: number; toId: number }) => {
    setTab('stops');
    setPanelOpen(true);
    // Reverse geocode via Nominatim
    let name = 'Via point';
    let fullAddress = '';
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lngLat.lat}&lon=${lngLat.lng}&format=json&zoom=10`
      );
      const geoData = await geoRes.json();
      if (geoData.display_name) {
        fullAddress = geoData.display_name;
        name = geoData.name || geoData.display_name.split(',')[0]?.trim() || 'Via point';
      }
    } catch { /* use fallback name */ }

    try {
      // Create waypoint
      await api.post(`/waypoints/trip/${id}`, {
        name: name.substring(0, 100),
        latitude: lngLat.lat,
        longitude: lngLat.lng,
        description: fullAddress.substring(0, 500) || 'Dragged stop',
      });

      // Reorder: place new stop between fromId and toId
      const { data: updated } = await api.get(`/trips/${id}`);
      const currentWps: Waypoint[] = updated.waypoints || [];
      const fromIdx = currentWps.findIndex((w: Waypoint) => w.id === between.fromId);
      const toIdx = currentWps.findIndex((w: Waypoint) => w.id === between.toId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const newWp = currentWps[currentWps.length - 1]; // the one we just created
        const others = currentWps.filter((w: Waypoint) => w.id !== newWp.id);
        const insertAt = Math.min(fromIdx + 1, others.length);
        others.splice(insertAt, 0, newWp);
        await api.put(`/waypoints/trip/${id}/reorder`, { waypointIds: others.map((w: Waypoint) => w.id) });
      }

      toast.success(`Added "${name}"`);
      loadTrip();
    } catch { toast.error('Failed to add stop'); }
  }, [id, waypoints, loadTrip]);

  // Auto-calculate route whenever waypoints change
  useEffect(() => {
    if (waypoints.length < 2) {
      setRouteGeometry([]);
      setLegStats([]);
      setCostData(null);
      return;
    }
    let cancelled = false;
    const calc = async () => {
      setRouteLoading(true);
      try {
        const { data } = await api.post(`/trips/${id}/estimate-stops`);
        if (cancelled) return;
        const coords = (data.routeGeometry || []) as [number, number][];
        setRouteGeometry(coords);
        setLegStats(data.legs || []);
        setLegGeometries((data.legs || []).map((leg: any) => ({
          fromId: leg.fromId,
          toId: leg.toId,
          coordinates: leg.geometry || [],
        })).filter((lg: any) => lg.coordinates.length > 0));
        setDayItinerary(data);
        setCostData({
          fuelCost: data.fuelCost || { total: 0, perLeg: [] },
          accommodationCost: data.accommodationCost || { total: 0, nights: 0, perNight: 0 },
          totalEstimatedCost: data.totalEstimatedCost || 0,
        });
      } catch {
        if (!cancelled) setRouteGeometry([]);
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    };
    calc();
    return () => { cancelled = true; };
  }, [id, waypoints.length]);

  // POI fetching
  const fetchPOIs = async () => {
    if (waypoints.length < 2 && trackPoints.length < 2) { toast.error('Add at least 2 stops first'); return; }
    setPoiLoading(true);
    try {
      // Use viewport bounds if map is available
      let params = '';
      if (mapRef.current) {
        const b = mapRef.current.getBounds();
        params = `?south=${b.getSouth()}&west=${b.getWest()}&north=${b.getNorth()}&east=${b.getEast()}`;
      }
      const { data } = await api.get(`/poi/${id}${params}`);
      setPois(data.pois || {});
      setPoiCategories(data.categories || []);
      if (data.categories?.length > 0 && !activePoiCat) setActivePoiCat(data.categories[0].id);
    } catch { /* silent */ }
    setPoiLoading(false);
  };

  useEffect(() => {
    if (tab === 'find' && trackPoints.length >= 2 && poiCategories.length === 0) fetchPOIs();
  }, [tab]);

  const addPoiAsWaypoint = async (poi: any) => {
    setAddingPoi(poi.id);
    try {
      await api.post(`/waypoints/trip/${id}`, {
        name: poi.name, latitude: poi.latitude, longitude: poi.longitude,
        description: `${poi.type} (${poi.distanceKm} km from route)`,
      });
      toast.success(`Added "${poi.name}"`);
      loadTrip();
    } catch { toast.error('Failed to add'); }
    setAddingPoi(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-10 h-10 border-4 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <TripMap
          trackPoints={trackPoints}
          waypoints={waypoints}
          routeGeometry={routeGeometry}
          legGeometries={legGeometries}
          tripId={Number(id)}
          animated={false}
          interactive={true}
          onMapClick={handleMapClick}
          onRouteWaypointDrop={handleRouteWaypointDrop}
          flyToBounds={flyToBounds}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3">
          <Link to="/" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            ← Dashboard
          </Link>
          {trip && (
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-lg drop-shadow-sm">{trip.title}</h1>
              {routeLoading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20"
            title={panelOpen ? 'Close panel' : 'Open panel'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {panelOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              }
            </svg>
          </button>
          <Link
            to={`/trips/${id}`}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium backdrop-blur-sm transition-all border border-white/20"
          >
            View Trip
          </Link>
        </div>
      </div>

      {/* Right panel — day places */}
      {selectedDay != null && dayPlacesCache.has(selectedDay) && (
        <div className="absolute top-16 bottom-4 right-4 z-10 w-[300px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 transition-all duration-300 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">
              Day {selectedDay + 1} · Things to do
              <span className="text-gray-400 font-normal ml-1">{dayPlacesCache.get(selectedDay)?.length || 0}</span>
            </h3>
            <button onClick={() => setSelectedDay(null)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {dayPlacesLoading && !dayPlacesCache.has(selectedDay) ? (
              <div className="text-center py-6">
                <div className="w-5 h-5 border-2 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin mx-auto" />
              </div>
            ) : (dayPlacesCache.get(selectedDay) || []).map((place: any, idx: number) => (
              <div key={`${place.source}-${place.pageId}`} className="group flex items-start gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                {place.thumbnail ? (
                  <img src={place.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 mt-0.5" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-roadtrip-50 text-roadtrip-400 flex items-center justify-center shrink-0 text-lg">
                    {place.source === 'wikipedia' ? '📖' : '📍'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{place.title}</p>
                  {place.description && <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{place.description}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-gray-400">{place.distance} km</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded-full ${place.source === 'wikipedia' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                      {place.source}
                    </span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.post(`/waypoints/trip/${id}`, {
                        name: place.title.substring(0, 100),
                        latitude: place.latitude, longitude: place.longitude,
                        description: place.description?.substring(0, 500) || `From ${place.source}`,
                      });
                      toast.success(`Added "${place.title}"`);
                    } catch { toast.error('Failed to add'); }
                  }}
                  className="shrink-0 px-2 py-1 text-[10px] font-medium rounded-lg bg-roadtrip-50 text-roadtrip-700 hover:bg-roadtrip-100 transition-colors opacity-0 group-hover:opacity-100"
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Left panel */}
      <div className={`absolute top-16 bottom-4 left-4 z-10 w-[340px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 transition-all duration-300 flex flex-col ${panelOpen ? 'translate-x-0' : '-translate-x-[380px]'}`}>
        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-gray-100">
          {([
            { id: 'stops' as Tab, label: 'Stops', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
            { id: 'find' as Tab, label: 'Find', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
            { id: 'itinerary' as Tab, label: 'Itinerary', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-xl transition-all ${
                tab === t.id ? 'bg-roadtrip-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* ============ STOPS TAB ============ */}
          {tab === 'stops' && (
            <WaypointPanel
              waypoints={waypoints}
              tripId={Number(id)}
              onUpdate={loadTrip}
              legStats={legStats}
              pendingLat={pendingLat}
              pendingLng={pendingLng}
              onPendingCleared={() => { setPendingLat(null); setPendingLng(null); }}
            />
          )}

          {/* ============ FIND TAB ============ */}
          {tab === 'find' && (
            <>
              <button onClick={fetchPOIs} disabled={poiLoading}
                className="w-full py-2.5 bg-roadtrip-600 text-white rounded-xl text-sm font-medium hover:bg-roadtrip-700 transition-colors disabled:opacity-50">
                {poiLoading ? 'Searching...' : poiCategories.length > 0 ? 'Refresh' : 'Find Places Along Route'}
              </button>

              {poiCategories.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {poiCategories.map(cat => (
                    <button key={cat.id} onClick={() => setActivePoiCat(cat.id)}
                      className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activePoiCat === cat.id ? 'bg-roadtrip-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      <span>{CAT_ICONS[cat.id] || '📍'}</span>
                      <span>{cat.label}</span>
                      <span className={`text-[10px] ${activePoiCat === cat.id ? 'text-white/70' : 'text-gray-400'}`}>{cat.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {poiLoading ? (
                <div className="text-center py-6">
                  <div className="w-6 h-6 border-2 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-gray-400 mt-2">Scanning OpenStreetMap...</p>
                </div>
              ) : activePoiCat && pois[activePoiCat] ? (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {pois[activePoiCat].map((poi: any) => (
                    <div key={poi.id} className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <span className="text-lg shrink-0 mt-0.5">{CAT_ICONS[poi.category] || '📍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{poi.name}</p>
                        <p className="text-[11px] text-gray-400 capitalize">{poi.type.replace(/_/g, ' ')} · {poi.distanceKm < 1 ? `${(poi.distanceKm * 1000).toFixed(0)}m` : `${poi.distanceKm.toFixed(1)}km`}</p>
                      </div>
                      <button onClick={() => addPoiAsWaypoint(poi)} disabled={addingPoi === poi.id}
                        className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-roadtrip-50 text-roadtrip-700 hover:bg-roadtrip-100 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100">
                        {addingPoi === poi.id ? '...' : '+ Add'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : trackPoints.length < 2 ? (
                <div className="text-center py-6 text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <p className="text-sm">Upload a GPX file or add track points to discover places</p>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <p className="text-sm">Click "Find Places" to discover</p>
                  <p className="text-xs mt-1">restaurants, fuel, lodging & more along your route</p>
                </div>
              )}
            </>
          )}

          {/* ============ ITINERARY TAB ============ */}
          {tab === 'itinerary' && (
            <ItineraryTimeline
              tripId={Number(id)}
              waypoints={waypoints}
              onUpdate={loadTrip}
              onDayClick={handleDayClick}
            />
          )}
        </div>

        {/* Cost summary bar at bottom */}
        {costData && (costData.fuelCost.total > 0 || costData.accommodationCost.total > 0) && (
          <div className="p-3 border-t border-gray-100 bg-gradient-to-r from-roadtrip-50 to-amber-50">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-gray-500">
                  ⛽ Fuel: <strong className="text-gray-800">${costData.fuelCost.total.toFixed(2)}</strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">
                  🏨 Hotels: <strong className="text-gray-800">${costData.accommodationCost.total.toFixed(2)}</strong>
                </span>
              </div>
              <span className="text-sm font-bold text-gray-900">
                ${costData.totalEstimatedCost.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
