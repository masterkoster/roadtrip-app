import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import TripMap from '../components/map/TripMap';
import ElevationProfile from '../components/trip/ElevationProfile';
import PhotoGallery from '../components/trip/PhotoGallery';
import StoryPlayer from '../components/trip/StoryPlayer';
import { VehicleBadge } from '../components/trip/VehicleIcon';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface TrackPoint { id: number; latitude: number; longitude: number; elevation: number | null; timestamp: string | null; }
interface Waypoint { id: number; name: string; description: string | null; latitude: number; longitude: number; orderIndex: number; duration: number | null; dayIndex: number | null; }
interface Photo { id: number; url: string; thumbnailUrl: string | null; latitude: number | null; longitude: number | null; caption: string | null; }
interface Guide { id: number; title: string; description: string | null; difficulty: string; }
interface Trip { id: number; title: string; description: string | null; distance: number | null; duration: number | null; startDate: string | null; endDate: string | null; isPublic: string; vehicle: string; }

interface StorySegment { id: number; title: string; content: string; orderIndex: number; waypointId: number | null; }

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatPace(seconds: number | null, distance: number | null) {
  if (!seconds || !distance || distance === 0) return null;
  const pace = seconds / 60 / distance;
  const paceM = Math.floor(pace);
  const paceS = Math.round((pace - paceM) * 60);
  return `${paceM}:${paceS.toString().padStart(2, '0')} /km`;
}

function fmtTime(minutes: number | null) {
  if (minutes == null || minutes === 0) return '';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const [storyData, setStoryData] = useState<{ guide: Guide; segments: StorySegment[]; waypoints: Waypoint[] } | null>(null);
  const [showingStory, setShowingStory] = useState(false);
  const [loadingStory, setLoadingStory] = useState(false);

  useEffect(() => {
    api.get(`/trips/${id}`).then(({ data }) => {
      setTrip(data);
      setTrackPoints(data.trackPoints || []);
      setWaypoints(data.waypoints || []);
      setPhotos(data.photos || []);
      setGuides(data.guides || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const stats = useMemo(() => {
    if (!trip) return null;
    return [
      { label: 'Distance', value: trip.distance ? `${trip.distance.toFixed(1)} km` : '—', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
      { label: 'Duration', value: formatDuration(trip.duration) || '—', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: 'Avg Pace', value: formatPace(trip.duration, trip.distance) || '—', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { label: 'Points', value: trackPoints.length.toLocaleString(), icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
    ];
  }, [trip, trackPoints]);

  const [mapStyle, setMapStyle] = useState<'colorful' | 'light' | 'dark'>('colorful');

  const deleteTrip = async () => {
    if (!confirm('Delete this trip permanently?')) return;
    try { await api.delete(`/trips/${id}`); toast.success('Trip deleted'); navigate('/'); }
    catch { toast.error('Failed to delete'); }
  };

  const loadStory = async () => {
    setLoadingStory(true);
    try {
      const { data } = await api.get(`/stories/${id}`);
      setStoryData(data);
      setShowingStory(true);
    } catch (err: any) {
      if (err.response?.status === 404) toast.error('No guide found for this trip');
      else toast.error('Failed to load story');
    }
    setLoadingStory(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading trip...</p>
      </div>
    </div>
  );

  if (!trip) return (
    <div className="text-center py-24">
      <p className="text-gray-500 text-lg">Trip not found</p>
      <Link to="/" className="text-roadtrip-600 hover:underline text-sm mt-2 inline-block">Back to dashboard</Link>
    </div>
  );

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      {/* === HERO === */}
      <div ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-roadtrip-900 to-gray-900 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #0066ff 0%, transparent 50%), radial-gradient(circle at 80% 20%, #0066ff 0%, transparent 50%)' }} />
        {photos.length > 0 && (
          <img src={photos[0].url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" style={{ filter: 'blur(2px)' }} />
        )}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <Link to="/" className="text-white/60 hover:text-white text-sm mb-4 inline-block transition-colors">&larr; Dashboard</Link>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">{trip.title}</h1>
                <VehicleBadge type={trip.vehicle as any} className="mt-2" />
              </div>
              {trip.description && <p className="text-white/70 text-lg mt-3 max-w-xl leading-relaxed">{trip.description}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Link to={`/trips/${id}/plan`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-roadtrip-600 hover:bg-roadtrip-700 text-white rounded-xl font-medium text-sm transition-colors shadow-lg">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Plan This Trip
              </Link>
              {guides.length > 0 && (
                <button onClick={loadStory} disabled={loadingStory}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm backdrop-blur-sm transition-colors border border-white/20 disabled:opacity-50">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  {loadingStory ? 'Loading...' : 'Play Story'}
                </button>
              )}
              {/* Map style toggle */}
              <div className="relative group">
                <button className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-colors border border-white/20" title="Map style">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                </button>
                <div className="absolute right-0 top-full mt-1 w-40 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  {(['colorful', 'light', 'dark'] as const).map((style) => (
                    <button key={style} onClick={() => setMapStyle(style)}
                      className={`block w-full text-left px-4 py-2 text-sm capitalize transition-colors ${mapStyle === style ? 'text-roadtrip-600 font-medium bg-roadtrip-50' : 'text-gray-700 hover:bg-gray-50'}`}
                    >{style}</button>
                  ))}
                </div>
              </div>
              <div className="relative group">
                <button className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-colors border border-white/20">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>
                <div className="absolute right-0 top-full mt-1 w-36 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                  <Link to={`/trips/${id}/edit`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit trip</Link>
                  <button onClick={deleteTrip} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === STATS BAR === */}
      {stats && (
        <div className="relative -mt-8 mb-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-roadtrip-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-roadtrip-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} /></svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === MAP === */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-700 ${mapLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <div style={{ height: '500px' }}>
            <TripMap
              trackPoints={trackPoints}
              waypoints={waypoints}
              photos={photos}
              animated
              onMapLoaded={() => setMapLoaded(true)}
              mapStyle={mapStyle}
            />
          </div>
          {trackPoints.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <ElevationProfile trackPoints={trackPoints} />
            </div>
          )}
        </div>
      </div>

      {/* === CONTENT GRID === */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Photos + Stops */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Photos <span className="text-gray-400 font-normal">{photos.length}</span>
                </h2>
                <Link to={`/trips/${id}/photos`} className="text-sm text-roadtrip-600 hover:text-roadtrip-700 font-medium transition-colors">Manage</Link>
              </div>
              {photos.length > 0 ? (
                <PhotoGallery photos={photos} />
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm">No photos yet</p>
                  <Link to={`/trips/${id}/photos`} className="text-roadtrip-600 hover:underline text-sm mt-1 inline-block">Upload photos</Link>
                </div>
              )}
            </div>

            {/* Read-only stops list */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Stops <span className="text-gray-400 font-normal">{waypoints.length}</span>
              </h2>
              {waypoints.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  <p className="text-sm">No stops on this trip yet</p>
                  <Link to={`/trips/${id}/plan`} className="text-roadtrip-600 hover:underline text-sm mt-1 inline-block">Plan this trip</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {waypoints.map((wp, idx) => (
                    <div key={wp.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-roadtrip-100 text-roadtrip-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900">{wp.name}</p>
                          {wp.dayIndex != null && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-roadtrip-50 text-roadtrip-600">Day {wp.dayIndex + 1}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                          <span>{wp.latitude.toFixed(5)}, {wp.longitude.toFixed(5)}</span>
                          {wp.duration != null && wp.duration > 0 && <span>· {fmtTime(wp.duration)}</span>}
                        </div>
                        {wp.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{wp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Guides */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Guides <span className="text-gray-400 font-normal">{guides.length}</span>
                </h2>
                <Link to={`/trips/${id}/guides/new`} className="text-sm text-roadtrip-600 hover:text-roadtrip-700 font-medium transition-colors">+ Create</Link>
              </div>
              {guides.length > 0 ? (
                <div className="space-y-2">
                  {guides.map((g) => (
                    <Link key={g.id} to={`/guides/${g.id}`} className="block p-3 rounded-lg border border-gray-100 hover:border-roadtrip-200 hover:bg-roadtrip-50/50 transition-all group">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-sm text-gray-900 group-hover:text-roadtrip-700 transition-colors">{g.title}</h3>
                          {g.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{g.description}</p>}
                        </div>
                        <span className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          g.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                          g.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          g.difficulty === 'hard' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>{g.difficulty}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <p className="text-sm">No guides</p>
                  <Link to={`/trips/${id}/guides/new`} className="text-roadtrip-600 hover:underline text-sm mt-1 inline-block">Create a guide</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Story Player Overlay */}
      {showingStory && storyData && (
        <StoryPlayer
          tripId={Number(id)}
          segments={storyData.segments}
          waypoints={storyData.waypoints}
          photos={photos}
          trackPoints={trackPoints}
          vehicle={(trip?.vehicle as any) || 'car'}
          onClose={() => setShowingStory(false)}
        />
      )}
    </div>
  );
}
