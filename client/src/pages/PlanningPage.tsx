import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import TripMap from '../components/map/TripMap';
import { useAuthStore } from '../stores/authStore';
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
}

type Tab = 'stops' | 'find' | 'itinerary';
type DurationUnit = 'minutes' | 'hours' | 'days';

const CAT_ICONS: Record<string, string> = {
  food: '🍽️', fuel: '⛽', camping: '🏕️', viewpoint: '🏔️',
  attraction: '🎯', lodging: '🏨', parking: '🅿️', restroom: '🚻',
};

function convertToMinutes(value: number, unit: DurationUnit): number {
  if (unit === 'hours') return Math.round(value * 60);
  if (unit === 'days') return Math.round(value * 1440);
  return Math.round(value);
}

export default function PlanningPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('stops');
  const [panelOpen, setPanelOpen] = useState(true);

  // Add stop form
  const [addingStop, setAddingStop] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newDurationUnit, setNewDurationUnit] = useState<DurationUnit>('minutes');
  const [newDayIndex, setNewDayIndex] = useState<number | null>(null);

  // Drag reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // POI state
  const [pois, setPois] = useState<Record<string, any[]>>({});
  const [poiCategories, setPoiCategories] = useState<any[]>([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [activePoiCat, setActivePoiCat] = useState<string | null>(null);
  const [addingPoi, setAddingPoi] = useState<string | null>(null);

  // Itinerary state
  const [itinerary, setItinerary] = useState<any>(null);
  const [itinLoading, setItinLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const maxDay = Math.max(-1, ...waypoints.map(w => w.dayIndex ?? -1));
  const dayOptions = Array.from({ length: maxDay + 1 }, (_, i) => i);

  const loadTrip = useCallback(async () => {
    try {
      const { data } = await api.get(`/trips/${id}`);
      setTrip(data);
      setWaypoints(data.waypoints || []);
      setTrackPoints(data.trackPoints || []);
    } catch {
      toast.error('Failed to load trip');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  const handleMapClick = useCallback((lngLat: { lat: number; lng: number }) => {
    setTab('stops');
    setAddingStop(true);
    setNewLat(String(lngLat.lat));
    setNewLng(String(lngLat.lng));
    setPanelOpen(true);
    toast('Location selected — name your stop');
  }, []);

  const addWaypoint = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    if (!newName.trim() || isNaN(lat) || isNaN(lng)) {
      toast.error('Name, lat, and lng required');
      return;
    }
    const duration = newDuration ? convertToMinutes(parseFloat(newDuration) || 0, newDurationUnit) : null;
    try {
      await api.post(`/waypoints/trip/${id}`, {
        name: newName.trim(), latitude: lat, longitude: lng,
        duration, dayIndex: newDayIndex,
      });
      toast.success('Stop added!');
      setNewName(''); setNewLat(''); setNewLng(''); setNewDuration(''); setNewDayIndex(null);
      setAddingStop(false);
      loadTrip();
    } catch { toast.error('Failed to add stop'); }
  };

  const deleteWp = async (wpId: number) => {
    if (!confirm('Delete this stop?')) return;
    try { await api.delete(`/waypoints/${wpId}`); toast.success('Stop removed'); loadTrip(); }
    catch { toast.error('Failed to delete'); }
  };

  const updateDuration = async (wpId: number, value: number, unit: DurationUnit) => {
    try {
      await api.put(`/waypoints/${wpId}`, { duration: convertToMinutes(value, unit) });
      loadTrip();
    } catch { toast.error('Failed to update duration'); }
  };

  const updateDay = async (wpId: number, dayIndex: number | null) => {
    try {
      await api.put(`/waypoints/${wpId}`, { dayIndex });
      loadTrip();
    } catch { toast.error('Failed to update day'); }
  };

  const reorderWaypoints = async (list: Waypoint[]) => {
    try {
      await api.put(`/waypoints/trip/${id}/reorder`, { waypointIds: list.map(w => w.id) });
      loadTrip();
    } catch { toast.error('Failed to reorder'); }
  };

  const fetchPOIs = async () => {
    if (trackPoints.length < 2) { toast.error('Need track points'); return; }
    setPoiLoading(true);
    try {
      const { data } = await api.get(`/poi/${id}`);
      setPois(data.pois || {});
      setPoiCategories(data.categories || []);
      if (data.categories?.length > 0 && !activePoiCat) setActivePoiCat(data.categories[0].id);
    } catch { /* silent */ }
    setPoiLoading(false);
  };

  useEffect(() => { if (tab === 'find' && trackPoints.length >= 2 && poiCategories.length === 0) fetchPOIs(); }, [tab]);

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

  const fetchItinerary = async () => {
    if (waypoints.length < 2) return;
    setItinLoading(true);
    try {
      const { data } = await api.post(`/trips/${id}/estimate-stops`);
      setItinerary(data);
    } catch { /* silent */ }
    setItinLoading(false);
  };

  useEffect(() => { if (tab === 'itinerary' && waypoints.length >= 2) fetchItinerary(); }, [tab, waypoints.length]);

  // Drag handlers
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDrop = async (dropIdx: number) => {
    if (dragIdx == null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const reordered = [...waypoints];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    await reorderWaypoints(reordered);
  };

  const formatMin = (m: number | null) => {
    if (m == null || m === 0) return '';
    if (m < 60) return `${m}m`;
    if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
    return `${(m / 1440).toFixed(1)}d`;
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
          animated={false}
          interactive={true}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3">
          <Link to="/" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            ← Dashboard
          </Link>
          {trip && (
            <h1 className="text-white font-bold text-lg drop-shadow-sm">{trip.title}</h1>
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

      {/* Left panel */}
      <div className={`absolute top-16 bottom-4 left-4 z-10 w-[380px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 transition-all duration-300 flex flex-col ${panelOpen ? 'translate-x-0' : '-translate-x-[420px]'}`}>
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
            <>
              {addingStop ? (
                <form onSubmit={addWaypoint} className="p-3 bg-roadtrip-50 rounded-xl border border-roadtrip-200 space-y-2">
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Stop name" autoFocus required />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={newLat} onChange={e => setNewLat(e.target.value)} placeholder="Lat" type="number" step="any" required />
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={newLng} onChange={e => setNewLng(e.target.value)} placeholder="Lng" type="number" step="any" required />
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="Duration" type="number" min="0" step="any" />
                    <select className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white" value={newDurationUnit} onChange={e => setNewDurationUnit(e.target.value as DurationUnit)}>
                      <option value="minutes">min</option>
                      <option value="hours">hrs</option>
                      <option value="days">days</option>
                    </select>
                    <select className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white" value={newDayIndex ?? ''} onChange={e => setNewDayIndex(e.target.value ? parseInt(e.target.value) : null)}>
                      <option value="">No day</option>
                      {dayOptions.map(d => <option key={d} value={d}>Day {d + 1}</option>)}
                      <option value={maxDay + 1}>Day {maxDay + 2}</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-roadtrip-600 text-white rounded-lg text-sm font-medium hover:bg-roadtrip-700">Add Stop</button>
                    <button type="button" onClick={() => setAddingStop(false)} className="py-2 px-4 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
                  </div>
                </form>
              ) : waypoints.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  <p className="text-sm">Click the map to add stops</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {waypoints.map((wp, idx) => (
                    <div key={wp.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={() => handleDrop(idx)}
                      className={`group flex items-start gap-2.5 p-3 rounded-xl transition-all cursor-grab ${
                        dragIdx === idx ? 'opacity-50 scale-95' : ''
                      } ${dragOverIdx === idx ? 'ring-2 ring-roadtrip-400 bg-roadtrip-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div className="w-6 h-6 rounded-full bg-roadtrip-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{wp.name}</p>
                          <button onClick={() => deleteWp(wp.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <select className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white text-gray-500" value={wp.dayIndex ?? ''} onChange={e => updateDay(wp.id, e.target.value ? parseInt(e.target.value) : null)}>
                            <option value="">No day</option>
                            {dayOptions.map(d => <option key={d} value={d}>Day {d + 1}</option>)}
                            <option value={maxDay + 1}>Day {maxDay + 2}</option>
                          </select>
                          <span className="text-[10px] text-gray-400">{wp.latitude.toFixed(4)}, {wp.longitude.toFixed(4)}</span>
                        </div>
                        <div className="mt-1">
                          <DurationPicker value={wp.duration} onChange={(v, u) => updateDuration(wp.id, v, u)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
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
                  <p className="text-sm">Add track points or a GPX file to discover places</p>
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
            <>
              {itinLoading && !itinerary ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-3 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Calculating...</p>
                </div>
              ) : itinerary ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 p-3 bg-roadtrip-50 rounded-xl mb-2">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Distance</p>
                      <p className="text-sm font-bold text-gray-900">{itinerary.totalDistance.toFixed(1)} km</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Drive time</p>
                      <p className="text-sm font-bold text-gray-900">{(itinerary.totalDrivingHours).toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500">Days</p>
                      <p className="text-sm font-bold text-gray-900">{itinerary.dayCount}</p>
                    </div>
                  </div>

                  {itinerary.days?.map((day: any) => {
                    const isExpanded = expandedDay === day.day;
                    const totalWithStops = day.totalDrivingHours + day.stops.reduce((s: number, st: any) => s + st.durationMinutes / 60, 0);
                    return (
                      <div key={day.day} className={`rounded-xl border transition-all ${day.needsHotel ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}>
                        <button onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                          className="w-full flex items-center justify-between p-3 text-left">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${day.needsHotel ? 'bg-amber-500 text-white' : 'bg-roadtrip-600 text-white'}`}>
                              {day.day + 1}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">Day {day.day + 1}</p>
                              <p className="text-[10px] text-gray-500">{day.totalDistanceKm.toFixed(1)} km · {day.totalDrivingHours.toFixed(1)}h drive</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {day.needsHotel && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Hotel</span>}
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-1.5 border-t border-gray-100 pt-2">
                            {day.legs?.map((leg: any, li: number) => (
                              <div key={li} className="flex items-start gap-2">
                                <div className="flex flex-col items-center pt-1">
                                  <div className="w-2 h-2 rounded-full bg-roadtrip-400" />
                                  {li < day.legs.length - 1 && <div className="w-0.5 h-6 bg-gray-200" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-700 truncate">{leg.fromName}</p>
                                  <p className="text-[10px] text-gray-400">{leg.distanceKm} km · {leg.durationHours.toFixed(1)}h</p>
                                </div>
                              </div>
                            ))}
                            {day.needsHotel && day.suggestedHotels?.length > 0 && (
                              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs font-semibold text-amber-800 mb-1">🏨 Accommodation</p>
                                {day.suggestedHotels.slice(0, 3).map((h: any, hi: number) => (
                                  <div key={hi} className="flex items-center justify-between text-[11px]">
                                    <span className="text-gray-700 truncate">{h.name}</span>
                                    <span className="text-gray-400 shrink-0 ml-2">{h.distanceKm} km</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex justify-between text-[10px] text-gray-500 pt-1 border-t border-dashed border-gray-200">
                              <span>{day.totalDistanceKm.toFixed(1)} km</span>
                              <span>{day.totalDrivingHours.toFixed(1)}h drive</span>
                              <span>{totalWithStops.toFixed(1)}h total</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : waypoints.length < 2 ? (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-sm">Add at least 2 stops to see the itinerary</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DurationPicker({ value, onChange }: { value: number | null; onChange: (val: number, unit: DurationUnit) => void }) {
  const [unit, setUnit] = useState<DurationUnit>('minutes');
  const [input, setInput] = useState(value ? String(value) : '');
  const commit = (v: string) => {
    const num = parseFloat(v);
    if (!isNaN(num) && num >= 0) onChange(num, unit);
  };
  return (
    <div className="flex items-center gap-1">
      <input className="w-14 text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white text-gray-600"
        value={input} onChange={e => setInput(e.target.value)} onBlur={() => commit(input)} onKeyDown={e => { if (e.key === 'Enter') commit(input); }}
        placeholder="0" type="number" min="0" step="any" />
      <select className="text-[11px] border border-gray-200 rounded-lg px-1 py-0.5 bg-white text-gray-500"
        value={unit} onChange={e => setUnit(e.target.value as DurationUnit)}>
        <option value="minutes">min</option>
        <option value="hours">hrs</option>
        <option value="days">days</option>
      </select>
    </div>
  );
}
