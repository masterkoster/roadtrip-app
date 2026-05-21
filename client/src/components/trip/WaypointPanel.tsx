import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/client';
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

interface LegStat {
  fromId: number;
  toId: number;
  distanceKm: number;
  durationHours: number;
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  category: string;
}

interface WaypointPanelProps {
  waypoints: Waypoint[];
  tripId: number;
  onUpdate: () => void;
  legStats?: LegStat[];
  pendingLat?: number | null;
  pendingLng?: number | null;
  onPendingCleared?: () => void;
}

type DurationUnit = 'minutes' | 'hours' | 'days';

function convertToMinutes(value: number, unit: DurationUnit): number {
  if (unit === 'hours') return Math.round(value * 60);
  if (unit === 'days') return Math.round(value * 1440);
  return Math.round(value);
}

function convertFromMinutes(minutes: number, unit: DurationUnit): number {
  if (unit === 'hours') return Math.round(minutes / 60);
  if (unit === 'days') return minutes / 1440;
  return minutes;
}

const STORAGE_KEY = 'roadtrip_drag_mode';

export default function WaypointPanel({ waypoints, tripId, onUpdate, legStats, pendingLat, pendingLng, onPendingCleared }: WaypointPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [addingWaypoint, setAddingWaypoint] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newDurationUnit, setNewDurationUnit] = useState<DurationUnit>('minutes');
  const [newDayIndex, setNewDayIndex] = useState<number | null>(null);
  const [addingSearch, setAddingSearch] = useState<string | null>(null);

  // Geocoding search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [useDragReorder, setUseDragReorder] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(useDragReorder));
  }, [useDragReorder]);

  useEffect(() => {
    if (pendingLat != null && pendingLng != null) {
      setAddingWaypoint(true);
      setNewLat(String(pendingLat));
      setNewLng(String(pendingLng));
      onPendingCleared?.();
    }
  }, [pendingLat, pendingLng]);

  // Close search results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced geocoding
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`);
      const data = await res.json();
      setSearchResults(data || []);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => doSearch(val), 400);
  };

  const addFromSearch = async (result: GeocodeResult) => {
    const name = result.display_name.split(',')[0].trim();
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (isNaN(lat) || isNaN(lng)) { toast.error('Invalid location'); return; }
    setAddingSearch(result.display_name);
    try {
      await api.post(`/waypoints/trip/${tripId}`, {
        name, latitude: lat, longitude: lng,
        description: result.display_name,
      });
      toast.success(`Added "${name}"`);
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
      onUpdate();
    } catch { toast.error('Failed to add stop'); }
    setAddingSearch(null);
  };

  const maxDay = Math.max(-1, ...waypoints.map(w => w.dayIndex ?? -1));
  const dayOptions = Array.from({ length: maxDay + 1 }, (_, i) => i);

  const getLegStatForStop = (wpId: number): LegStat | null => {
    if (!legStats) return null;
    return legStats.find(l => l.fromId === wpId) || null;
  };

  const startEdit = (wp: Waypoint) => {
    setEditingId(wp.id);
    setEditName(wp.name);
    setEditDesc(wp.description || '');
  };

  const saveEdit = async (id: number) => {
    try {
      await api.put(`/waypoints/${id}`, { name: editName, description: editDesc });
      toast.success('Waypoint updated');
      onUpdate();
    } catch { toast.error('Failed to update'); }
    setEditingId(null);
  };

  const deleteWp = useCallback(async (id: number) => {
    if (!confirm('Delete this stop?')) return;
    try { await api.delete(`/waypoints/${id}`); toast.success('Stop removed'); onUpdate(); }
    catch { toast.error('Failed to delete'); }
  }, [onUpdate]);

  const moveUp = useCallback(async (idx: number) => {
    if (idx === 0) return;
    const reordered = [...waypoints];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    await reorderApi(reordered);
  }, [waypoints]);

  const moveDown = useCallback(async (idx: number) => {
    if (idx === waypoints.length - 1) return;
    const reordered = [...waypoints];
    [reordered[idx + 1], reordered[idx]] = [reordered[idx], reordered[idx + 1]];
    await reorderApi(reordered);
  }, [waypoints]);

  const reorderApi = async (list: Waypoint[]) => {
    try {
      await api.put(`/waypoints/trip/${tripId}/reorder`, { waypointIds: list.map(w => w.id) });
      onUpdate();
    } catch { toast.error('Failed to reorder'); }
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDragLeave = () => setDragOverIdx(null);

  const handleDrop = async (dropIdx: number) => {
    if (dragIdx == null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const reordered = [...waypoints];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    await reorderApi(reordered);
  };

  const updateDuration = async (wpId: number, value: number, unit: DurationUnit) => {
    const minutes = convertToMinutes(value, unit);
    try {
      await api.put(`/waypoints/${wpId}`, { duration: minutes });
      onUpdate();
    } catch { toast.error('Failed to update duration'); }
  };

  const updateDay = async (wpId: number, dayIndex: number | null) => {
    try {
      await api.put(`/waypoints/${wpId}`, { dayIndex });
      onUpdate();
    } catch { toast.error('Failed to update day'); }
  };

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
      await api.post(`/waypoints/trip/${tripId}`, {
        name: newName.trim(), latitude: lat, longitude: lng, duration, dayIndex: newDayIndex,
      });
      toast.success('Stop added!');
      setNewName(''); setNewLat(''); setNewLng(''); setNewDuration(''); setNewDayIndex(null);
      setAddingWaypoint(false);
      onUpdate();
    } catch { toast.error('Failed to add stop'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900">
          Stops <span className="text-gray-400 font-normal">{waypoints.length}</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseDragReorder(!useDragReorder)}
            className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${useDragReorder ? 'bg-roadtrip-100 text-roadtrip-700' : 'bg-gray-100 text-gray-500'}`}
            title={useDragReorder ? 'Drag to reorder' : 'Use up/down buttons'}
          >
            {useDragReorder ? 'Drag' : 'Buttons'}
          </button>
          <button onClick={() => setAddingWaypoint(!addingWaypoint)}
            className="inline-flex items-center gap-1 text-sm text-roadtrip-600 hover:text-roadtrip-700 font-medium transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {addingWaypoint ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {/* Address search */}
      <div ref={searchRef} className="relative mb-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-roadtrip-500 transition-all"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
            placeholder="Search for a place, address, or city..."
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-[280px] overflow-y-auto">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => addFromSearch(r)}
                disabled={addingSearch === r.display_name}
                className="w-full text-left px-3 py-2.5 hover:bg-roadtrip-50 transition-colors flex items-start gap-2.5 border-b border-gray-50 last:border-0 disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.display_name.split(',')[0]}</p>
                  <p className="text-[11px] text-gray-400 truncate">{r.display_name}</p>
                </div>
                <span className="text-[10px] text-gray-400 capitalize shrink-0 mt-0.5">{r.type?.replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual add form (for map-click) */}
      {addingWaypoint && (
        <form onSubmit={addWaypoint} className="mb-3 p-2.5 bg-roadtrip-50 rounded-xl border border-roadtrip-200 space-y-1.5">
          <input className="input text-sm" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Stop name" required />
          <div className="grid grid-cols-2 gap-2">
            <input className="input text-sm" value={newLat} onChange={e => setNewLat(e.target.value)} placeholder="Latitude" type="number" step="any" required />
            <input className="input text-sm" value={newLng} onChange={e => setNewLng(e.target.value)} placeholder="Longitude" type="number" step="any" required />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex gap-1">
              <input className="input text-sm flex-1" value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="Duration" type="number" min="0" step="any" />
              <select className="input text-sm w-24" value={newDurationUnit} onChange={e => setNewDurationUnit(e.target.value as DurationUnit)}>
                <option value="minutes">min</option>
                <option value="hours">hrs</option>
                <option value="days">days</option>
              </select>
            </div>
            <select className="input text-sm w-28" value={newDayIndex ?? ''} onChange={e => setNewDayIndex(e.target.value ? parseInt(e.target.value) : null)}>
              <option value="">No day</option>
              {dayOptions.map(d => <option key={d} value={d}>Day {d + 1}</option>)}
              <option value={maxDay + 1}>Day {maxDay + 2}</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full text-sm">Add to Trip</button>
        </form>
      )}

      {/* Empty state */}
      {waypoints.length === 0 ? (
        <div className="text-center py-4 text-gray-400">
          <svg className="w-8 h-8 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
          <p className="text-sm">Search for a place above</p>
          <p className="text-xs text-gray-400 mt-1">Or click the map to add a stop</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {waypoints.map((wp, idx) => {
            const leg = getLegStatForStop(wp.id);
            return (
              <div key={wp.id}
                draggable={useDragReorder}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(idx)}
                className={`group relative flex items-start gap-2 p-2 rounded-xl transition-all cursor-${useDragReorder ? 'grab' : 'default'} ${
                  dragIdx === idx ? 'opacity-50 scale-95' : ''
                } ${dragOverIdx === idx ? 'ring-2 ring-roadtrip-400 bg-roadtrip-50' : ''} ${
                  editingId === wp.id ? 'bg-roadtrip-50 ring-1 ring-roadtrip-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center pt-0.5">
                  {useDragReorder ? (
                    <div className="w-5 h-5 rounded-full bg-roadtrip-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 cursor-grab"
                      onMouseDown={() => {}}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                    </div>
                  ) : (
                    <>
                      <span className="w-5 h-5 rounded-full bg-roadtrip-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {idx > 0 && <button onClick={() => moveUp(idx)} className="text-gray-400 hover:text-gray-600 leading-none text-xs">▲</button>}
                        {idx < waypoints.length - 1 && <button onClick={() => moveDown(idx)} className="text-gray-400 hover:text-gray-600 leading-none text-xs">▼</button>}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === wp.id ? (
                    <div className="space-y-1.5">
                      <input className="input text-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                      <textarea className="input text-sm min-h-[60px]" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(wp.id)} className="btn-primary text-xs px-3 py-1">Save</button>
                        <button onClick={() => setEditingId(null)} className="btn-ghost text-xs px-3 py-1">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{wp.name}</p>
                          {wp.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{wp.description}</p>}
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(wp)} className="p-1 text-gray-400 hover:text-gray-600" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => deleteWp(wp.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mt-1">
                        <DurationPicker value={wp.duration} onChange={(minutes) => updateDuration(wp.id, minutes, 'minutes')} />
                        <select className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white text-gray-600"
                          value={wp.dayIndex ?? ''}
                          onChange={e => updateDay(wp.id, e.target.value ? parseInt(e.target.value) : null)}
                        >
                          <option value="">No day</option>
                          {dayOptions.map(d => <option key={d} value={d}>Day {d + 1}</option>)}
                          <option value={maxDay + 1}>Day {maxDay + 2}</option>
                        </select>
                      </div>

                      {leg && (
                        <div className="mt-1 text-[10px] text-gray-400">
                          → {leg.distanceKm} km · {leg.durationHours.toFixed(1)}h drive
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DurationPicker({ value, onChange }: { value: number | null; onChange: (minutes: number) => void }) {
  const [unit, setUnit] = useState<DurationUnit>('minutes');
  const [inputValue, setInputValue] = useState(() => value ? String(convertFromMinutes(value, 'minutes')) : '');

  useEffect(() => {
    setInputValue(value ? String(convertFromMinutes(value, unit)) : '');
  }, [value, unit]);

  const commit = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onChange(convertToMinutes(num, unit));
    } else if (val === '') {
      onChange(0);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <input className="w-14 text-[11px] border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white text-gray-600"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onBlur={() => commit(inputValue)}
        onKeyDown={e => { if (e.key === 'Enter') commit(inputValue); }}
        placeholder="0" type="number" min="0" step="any"
      />
      <select className="text-[11px] border border-gray-200 rounded-lg px-1 py-0.5 bg-white text-gray-500"
        value={unit}
        onChange={e => setUnit(e.target.value as DurationUnit)}
      >
        <option value="minutes">min</option>
        <option value="hours">hrs</option>
        <option value="days">days</option>
      </select>
    </div>
  );
}
