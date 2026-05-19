import { useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface Waypoint {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  orderIndex: number;
}

interface WaypointPanelProps {
  waypoints: Waypoint[];
  tripId: number;
  onUpdate: () => void;
}

export default function WaypointPanel({ waypoints, tripId, onUpdate }: WaypointPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [addingWaypoint, setAddingWaypoint] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');

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

  const deleteWp = async (id: number) => {
    if (!confirm('Delete this stop?')) return;
    try { await api.delete(`/waypoints/${id}`); toast.success('Stop removed'); onUpdate(); }
    catch { toast.error('Failed to delete'); }
  };

  const moveUp = async (idx: number) => {
    if (idx === 0) return;
    const reordered = [...waypoints];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    await reorder(reordered);
  };

  const moveDown = async (idx: number) => {
    if (idx === waypoints.length - 1) return;
    const reordered = [...waypoints];
    [reordered[idx + 1], reordered[idx]] = [reordered[idx], reordered[idx + 1]];
    await reorder(reordered);
  };

  const reorder = async (list: Waypoint[]) => {
    try {
      await api.put(`/waypoints/trip/${tripId}/reorder`, { waypointIds: list.map(w => w.id) });
      onUpdate();
    } catch { toast.error('Failed to reorder'); }
  };

  const addWaypoint = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    if (!newName.trim() || isNaN(lat) || isNaN(lng)) {
      toast.error('Name, lat, and lng required');
      return;
    }
    try {
      await api.post(`/waypoints/trip/${tripId}`, { name: newName.trim(), latitude: lat, longitude: lng });
      toast.success('Stop added!');
      setNewName(''); setNewLat(''); setNewLng('');
      setAddingWaypoint(false);
      onUpdate();
    } catch { toast.error('Failed to add stop'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Stops <span className="text-gray-400 font-normal">{waypoints.length}</span>
        </h2>
        <button onClick={() => setAddingWaypoint(!addingWaypoint)}
          className="inline-flex items-center gap-1 text-sm text-roadtrip-600 hover:text-roadtrip-700 font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {addingWaypoint ? 'Cancel' : 'Add Stop'}
        </button>
      </div>

      {addingWaypoint && (
        <form onSubmit={addWaypoint} className="mb-4 p-3 bg-roadtrip-50 rounded-xl border border-roadtrip-200 space-y-2">
          <input className="input text-sm" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Stop name" required />
          <div className="grid grid-cols-2 gap-2">
            <input className="input text-sm" value={newLat} onChange={e => setNewLat(e.target.value)} placeholder="Latitude" type="number" step="any" required />
            <input className="input text-sm" value={newLng} onChange={e => setNewLng(e.target.value)} placeholder="Longitude" type="number" step="any" required />
          </div>
          <button type="submit" className="btn-primary w-full text-sm">Add to Trip</button>
        </form>
      )}

      {waypoints.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
          <p className="text-sm">No stops yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Stop" or tap the map</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {waypoints.map((wp, idx) => (
            <div key={wp.id}
              className={`group relative flex items-start gap-3 p-3 rounded-xl transition-all ${
                dragIdx === idx ? 'opacity-50 scale-95' : ''
              } ${editingId === wp.id ? 'bg-roadtrip-50 ring-1 ring-roadtrip-200' : 'hover:bg-gray-50'}`}
            >
              {/* Drag handle / number */}
              <div className="flex flex-col items-center gap-0.5 pt-0.5">
                <span className="w-6 h-6 rounded-full bg-roadtrip-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">{idx + 1}</span>
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && <button onClick={() => moveUp(idx)} className="text-gray-400 hover:text-gray-600 leading-none text-xs">▲</button>}
                  {idx < waypoints.length - 1 && <button onClick={() => moveDown(idx)} className="text-gray-400 hover:text-gray-600 leading-none text-xs">▼</button>}
                </div>
              </div>

              {/* Content */}
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
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
