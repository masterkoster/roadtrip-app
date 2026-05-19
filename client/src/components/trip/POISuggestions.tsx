import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface POI {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  type: string;
  distanceKm: number;
  website?: string;
  phone?: string;
}

interface CategoryMeta {
  id: string;
  label: string;
  icon: string;
  count: number;
}

interface POISuggestionsProps {
  tripId: number;
  trackPoints: any[];
  onWaypointAdded: () => void;
}

const CAT_ICONS: Record<string, string> = {
  food: '🍽️', fuel: '⛽', camping: '🏕️', viewpoint: '🏔️',
  attraction: '🎯', lodging: '🏨', parking: '🅿️', restroom: '🚻',
};

export default function POISuggestions({ tripId, trackPoints, onWaypointAdded }: POISuggestionsProps) {
  const [pois, setPois] = useState<Record<string, POI[]>>({});
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const fetchPOIs = async () => {
    if (trackPoints.length < 2) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/poi/${tripId}`);
      setPois(data.pois || {});
      setCategories(data.categories || []);
      if (!activeCat && data.categories?.length > 0) {
        setActiveCat(data.categories[0].id);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const addAsWaypoint = async (poi: POI) => {
    setAdding(poi.id);
    try {
      await api.post(`/waypoints/trip/${tripId}`, {
        name: poi.name,
        latitude: poi.latitude,
        longitude: poi.longitude,
        description: `${poi.type} (${poi.distanceKm} km from route)`,
      });
      toast.success(`Added "${poi.name}"`);
      onWaypointAdded();
    } catch { toast.error('Failed to add'); }
    setAdding(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">Discover Along Route</h2>
        <button onClick={fetchPOIs} disabled={loading}
          className="text-xs text-roadtrip-600 hover:text-roadtrip-700 font-medium disabled:opacity-50">
          {loading ? 'Searching...' : categories.length > 0 ? 'Refresh' : 'Find Places'}
        </button>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-thin">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeCat === cat.id
                  ? 'bg-roadtrip-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              <span>{CAT_ICONS[cat.id] || '📍'}</span>
              <span>{cat.label}</span>
              <span className={`ml-0.5 text-[10px] ${activeCat === cat.id ? 'text-white/70' : 'text-gray-400'}`}>{cat.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* POI list */}
      {loading ? (
        <div className="text-center py-6">
          <div className="w-6 h-6 border-2 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400 mt-2">Scanning OpenStreetMap...</p>
        </div>
      ) : activeCat && pois[activeCat] ? (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
          {pois[activeCat].map(poi => (
            <div key={poi.id} className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <span className="text-lg shrink-0 mt-0.5">{CAT_ICONS[poi.category] || '📍'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">{poi.name}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{poi.type.replace(/_/g, ' ')} · {poi.distanceKm < 1 ? `${(poi.distanceKm * 1000).toFixed(0)}m` : `${poi.distanceKm.toFixed(1)}km`} away</p>
                  </div>
                  <button
                    onClick={() => addAsWaypoint(poi)}
                    disabled={adding === poi.id}
                    className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-roadtrip-50 text-roadtrip-700 hover:bg-roadtrip-100 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                  >
                    {adding === poi.id ? '...' : '+ Add'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : trackPoints.length < 2 ? (
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">Add track points to discover places</p>
          <p className="text-xs mt-1">Import GPX or use live tracking first</p>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <p className="text-sm">Click "Find Places" to discover</p>
          <p className="text-xs mt-1">restaurants, fuel, viewpoints & more along your route</p>
        </div>
      )}
    </div>
  );
}
