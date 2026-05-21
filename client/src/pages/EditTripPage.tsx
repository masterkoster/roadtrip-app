import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { vehicleOptions, type VehicleType } from '../components/trip/VehicleIcon';

export default function EditTripPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState('private');
  const [vehicle, setVehicle] = useState<VehicleType>('car');
  const [maxDailyDrivingHours, setMaxDailyDrivingHours] = useState('8');
  const [maxDailyDistanceKm, setMaxDailyDistanceKm] = useState('800');
  const [restStopFrequencyHours, setRestStopFrequencyHours] = useState('2');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/trips/${id}`).then(({ data }) => {
      setTitle(data.title);
      setDescription(data.description || '');
      setIsPublic(data.isPublic || 'private');
      setVehicle(data.vehicle || 'car');
      setMaxDailyDrivingHours(String(data.maxDailyDrivingHours ?? 8));
      setMaxDailyDistanceKm(String(data.maxDailyDistanceKm ?? 800));
      setRestStopFrequencyHours(String(data.restStopFrequencyHours ?? 2));
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/trips/${id}`, {
        title,
        description,
        isPublic,
        vehicle,
        maxDailyDrivingHours: parseFloat(maxDailyDrivingHours) || 8,
        maxDailyDistanceKm: parseFloat(maxDailyDistanceKm) || 800,
        restStopFrequencyHours: parseFloat(restStopFrequencyHours) || 2,
      });
      toast.success('Trip updated!');
      navigate(`/trips/${id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Trip</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Vehicle</label>
          <select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleType)}>
            {vehicleOptions.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Visibility</label>
          <select className="input" value={isPublic} onChange={(e) => setIsPublic(e.target.value)}>
            <option value="private">Private (only you)</option>
            <option value="public">Public (everyone can see)</option>
          </select>
        </div>

        {/* Planner Parameters */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Trip Planner Settings</h3>
          <p className="text-xs text-gray-500 mb-3">These parameters control how the itinerary and hotel suggestions are calculated.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label text-xs">Max driving hours/day</label>
              <input className="input" type="number" min="1" max="24" step="0.5" value={maxDailyDrivingHours} onChange={(e) => setMaxDailyDrivingHours(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Max distance/day (km)</label>
              <input className="input" type="number" min="1" step="50" value={maxDailyDistanceKm} onChange={(e) => setMaxDailyDistanceKm(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Rest stop frequency (hrs)</label>
              <input className="input" type="number" min="0.5" max="8" step="0.5" value={restStopFrequencyHours} onChange={(e) => setRestStopFrequencyHours(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button type="button" onClick={() => navigate(`/trips/${id}`)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
