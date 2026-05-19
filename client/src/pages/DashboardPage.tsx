import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { format } from 'date-fns';

interface Trip {
  id: number;
  title: string;
  description: string | null;
  distance: number | null;
  duration: number | null;
  createdAt: string;
  startDate: string | null;
  photos?: { url: string; thumbnailUrl: string | null }[];
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trips').then(({ data }) => setTrips(data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-10 h-10 border-4 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Trips</h1>
          <p className="text-gray-500 mt-1">{trips.length} {trips.length === 1 ? 'trip' : 'trips'} recorded</p>
        </div>
        <Link to="/trips/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-roadtrip-600 text-white rounded-xl font-medium text-sm hover:bg-roadtrip-700 transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 text-center py-16 px-6">
          <svg className="w-20 h-20 text-gray-300 mx-auto mb-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ready for your first ride?</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Import a GPX file, start live tracking, or create a trip manually — then add photos and guides to share the experience.</p>
          <Link to="/trips/new" className="btn-primary text-base px-6 py-3">Create Your First Trip</Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              to={`/trips/${trip.id}`}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-roadtrip-200 transition-all duration-300"
            >
              {/* Thumbnail */}
              <div className="h-40 bg-gradient-to-br from-roadtrip-100 to-blue-50 relative overflow-hidden">
                {trip.photos?.[0] && (
                  <img src={trip.photos[0].thumbnailUrl || trip.photos[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                )}
                {!trip.photos?.[0] && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-12 h-12 text-roadtrip-300/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[11px] font-semibold text-gray-700 shadow-sm">
                  {trip.distance ? `${trip.distance.toFixed(0)} km` : '—'}
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-roadtrip-700 transition-colors line-clamp-1">{trip.title}</h3>
                {trip.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{trip.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                  {trip.startDate && <span>{format(new Date(trip.startDate), 'MMM d, yyyy')}</span>}
                  {formatDuration(trip.duration) && <span>{formatDuration(trip.duration)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
