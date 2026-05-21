import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { vehicleOptions, type VehicleType } from '../components/trip/VehicleIcon';

export default function NewTripPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [vehicle, setVehicle] = useState<VehicleType>('car');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Name your trip'); return; }
    setLoading(true);
    try {
      const { data: trip } = await api.post('/trips', { title: title.trim(), vehicle });
      toast.success('Trip created! Start adding stops.');
      navigate(`/trips/${trip.id}/plan`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-roadtrip-100 text-roadtrip-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">New Trip</h1>
          <p className="text-gray-500 mt-2 text-sm">Name it, then start planning on the map</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Trip name</label>
            <input
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500 focus:border-transparent transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pacific Coast Highway"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Vehicle</label>
            <select
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500 focus:border-transparent transition-all bg-white"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value as VehicleType)}
            >
              {vehicleOptions.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-roadtrip-600 text-white rounded-xl font-medium text-sm hover:bg-roadtrip-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Start Planning →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Add stops by clicking the map, searching, or uploading a GPX file later
        </p>
      </div>
    </div>
  );
}
