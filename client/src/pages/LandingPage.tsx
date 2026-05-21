import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../api/client';
import toast from 'react-hot-toast';
import AddressAutocomplete from '../components/map/AddressAutocomplete';

interface Landmark {
  id: number; name: string; latitude: number; longitude: number;
  description: string; thumbnail: string | null;
}

export default function LandingPage() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [startLabel, setStartLabel] = useState('');
  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLng, setStartLng] = useState<number | null>(null);
  const [endLabel, setEndLabel] = useState('');
  const [endLat, setEndLat] = useState<number | null>(null);
  const [endLng, setEndLng] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [lmLoading, setLmLoading] = useState(true);

  useEffect(() => {
    api.get('/poi/landmarks').then(r => {
      setLandmarks((r.data?.landmarks || []).slice(0, 8));
    }).catch(() => {}).finally(() => setLmLoading(false));
  }, []);

  const createTripAndGo = async (title: string, waypoints: { name: string; latitude: number; longitude: number }[]) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setCreating(true);
    try {
      const { data: trip } = await api.post('/trips', { title, vehicle: 'car' });
      await api.post(`/waypoints/trip/${trip.id}/batch`, { waypoints });
      navigate(`/trips/${trip.id}/plan`);
    } catch {
      toast.error('Failed to create trip');
      setCreating(false);
    }
  };

  const handlePlanTrip = () => {
    if (!startLat || !endLat) { toast.error('Please select a starting point and destination'); return; }
    createTripAndGo(`${startLabel} to ${endLabel}`, [
      { name: startLabel, latitude: startLat, longitude: startLng! },
      { name: endLabel, latitude: endLat, longitude: endLng! },
    ]);
  };

  const handleLandmarkClick = (lm: Landmark) => {
    createTripAndGo(`Visit ${lm.name}`, [
      { name: lm.name, latitude: lm.latitude, longitude: lm.longitude },
    ]);
  };

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ===== NAV BAR ===== */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-roadtrip-500 to-roadtrip-700 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-white" viewBox="0 0 100 100" fill="currentColor">
                  <path d="M30 65 L50 25 L70 65 Z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900">Roadtrip</span>
            </Link>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Link to="/trips" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium">My Trips</Link>
                  <Link to="/trips/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-roadtrip-600 text-white rounded-xl text-sm font-medium hover:bg-roadtrip-700 transition-colors shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    New Trip
                  </Link>
                  <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-roadtrip-400 to-roadtrip-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
                    <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-1">Logout</button>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium">Log in</Link>
                  <Link to="/register" className="px-4 py-2 bg-roadtrip-600 text-white rounded-xl text-sm font-medium hover:bg-roadtrip-700 transition-colors shadow-sm">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative flex items-center justify-center min-h-[85vh] bg-gradient-to-br from-gray-900 via-roadtrip-900 to-gray-900 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.08) 0%, transparent 50%)' }} />
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight animate-[fadeIn_0.6s_ease_both]">
            The road trip planner that plans your trip
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto animate-[fadeIn_0.6s_ease_0.15s_both]">
            Build your perfect route, discover amazing places, and know your costs — all in one place.
          </p>

          {/* Hero form */}
          <div className="mt-10 max-w-xl mx-auto space-y-3 animate-[fadeIn_0.6s_ease_0.3s_both]">
            <AddressAutocomplete placeholder="Starting Point" value={startLabel}
              onChange={setStartLabel} onSelect={(l, lat, lng) => { setStartLabel(l); setStartLat(lat); setStartLng(lng); }} />
            <AddressAutocomplete placeholder="Destination" value={endLabel}
              onChange={setEndLabel} onSelect={(l, lat, lng) => { setEndLabel(l); setEndLat(lat); setEndLng(lng); }} />
            <button onClick={handlePlanTrip} disabled={creating}
              className="w-full py-3.5 bg-gradient-to-r from-roadtrip-500 to-roadtrip-700 text-white rounded-xl text-base font-bold hover:from-roadtrip-600 hover:to-roadtrip-800 transition-all shadow-lg shadow-roadtrip-900/30 disabled:opacity-50">
              {creating ? 'Creating...' : isAuthenticated ? 'Plan Trip' : 'Log in to Plan'}
            </button>
          </div>

          {isAuthenticated && (
            <p className="mt-4 text-sm text-gray-400 animate-[fadeIn_0.6s_ease_0.45s_both]">
              <Link to="/trips" className="text-roadtrip-300 hover:text-roadtrip-200 underline underline-offset-2">Or browse your existing trips →</Link>
            </p>
          )}
        </div>
      </section>

      {/* ===== FEATURE CARDS ===== */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">Everything you need for the perfect road trip</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
                title: 'Build Your Route', desc: 'Drag waypoints anywhere on the map. OSRM-powered routing gives you accurate driving times and distances between every stop.' },
              { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
                title: 'Discover Places', desc: 'Find restaurants, gas stations, hotels, and attractions along your route. Adjust the search radius and browse by category.' },
              { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                title: 'Know Your Costs', desc: 'Get fuel cost estimates based on your vehicle type and accommodation costs for overnight stops. No surprises.' },
            ].map((feat, i) => (
              <div key={feat.title} className="bg-white rounded-2xl border border-gray-200/60 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow animate-[fadeIn_0.5s_ease_both]" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-10 h-10 rounded-xl bg-roadtrip-50 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-roadtrip-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feat.icon} /></svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{feat.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LANDMARK SHOWCASE ===== */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">Explore America's Greatest Landmarks</h2>
          <p className="mt-2 text-gray-500 text-center text-sm">Click any landmark to start planning a trip there</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {lmLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-56" />
              ))
            ) : (
              landmarks.map((lm, i) => (
                <button key={lm.id} onClick={() => handleLandmarkClick(lm)}
                  className="group relative rounded-2xl overflow-hidden bg-white border border-gray-200/60 shadow-sm hover:shadow-lg transition-all text-left animate-[fadeIn_0.4s_ease_both]" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="h-40 bg-gray-100 overflow-hidden">
                    {lm.thumbnail ? (
                      <img src={lm.thumbnail} alt={lm.name} loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-roadtrip-100 to-roadtrip-200">🏛️</div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lm.name}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-roadtrip-500 to-roadtrip-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 100 100" fill="currentColor"><path d="M30 65 L50 25 L70 65 Z" /></svg>
              </div>
              <span className="text-sm font-semibold text-white">Roadtrip</span>
            </div>
            <div className="flex items-center gap-6 text-xs">
              {isAuthenticated && <Link to="/trips" className="hover:text-white transition-colors">My Trips</Link>}
              <Link to="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link to="/register" className="hover:text-white transition-colors">Sign Up</Link>
              <span className="text-gray-600">© {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
