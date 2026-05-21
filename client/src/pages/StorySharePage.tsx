import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import StoryPlayer from '../components/trip/StoryPlayer';
import api from '../api/client';

interface StoryResponse {
  trip: {
    id: number;
    title: string;
    description: string | null;
    distance: number | null;
    duration: number | null;
    startDate: string | null;
    endDate: string | null;
    vehicle: string;
  };
  guide: { id: number; title: string };
  segments: any[];
  waypoints: any[];
  photos: any[];
  trackPoints: any[];
  participants?: any[];
  settings?: {
    defaultMode?: 'storybook' | 'animated';
    highlights?: { waypointId: number }[];
    soundtrackUrl?: string | null;
  };
}

export default function StorySharePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [story, setStory] = useState<StoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'storybook' | 'animated'>('storybook');

  useEffect(() => {
    if (!token) {
      setError('Missing story token');
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get(`/stories/share/${token}`)
      .then(({ data }) => {
        setStory(data);
        setError(null);
        const requested = (searchParams.get('mode') as 'storybook' | 'animated') || data.settings?.defaultMode || 'storybook';
        setMode(requested === 'animated' ? 'animated' : 'storybook');
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Unable to load shared story');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('mode', mode);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf6ef] flex flex-col items-center justify-center text-gray-600">
        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-3" />
        <p className="text-sm">Loading shared story...</p>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-[#faf6ef] flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🗺️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Story unavailable</h1>
        <p className="text-sm text-gray-500 mb-4 max-w-sm">{error || 'This shared story link is no longer valid.'}</p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors">
          Go to Roadtrip
        </Link>
      </div>
    );
  }

  const participants = story.participants || [];
  const highlights = story.settings?.highlights || [];
  const soundtrackUrl = story.settings?.soundtrackUrl || null;

  return (
    <>
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-black/40 text-white px-3 py-1.5 rounded-xl text-xs">
        <span className="uppercase tracking-[0.2em] text-white/60">View</span>
        <button
          onClick={() => setMode('storybook')}
          className={`px-2 py-1 rounded-lg transition-colors ${mode === 'storybook' ? 'bg-amber-500 text-white' : 'text-white/70 hover:text-white'}`}
        >Storybook</button>
        <button
          onClick={() => setMode('animated')}
          className={`px-2 py-1 rounded-lg transition-colors ${mode === 'animated' ? 'bg-amber-500 text-white' : 'text-white/70 hover:text-white'}`}
        >Animated</button>
      </div>
      <StoryPlayer
        mode={mode}
        tripId={story.trip.id}
        segments={story.segments}
        waypoints={story.waypoints}
        photos={story.photos}
        trackPoints={story.trackPoints}
        vehicle={(story.trip.vehicle as any) || 'car'}
        trip={story.trip}
        guideId={story.guide.id}
        readOnly
        allowShare={false}
        participants={participants}
        highlights={highlights}
        soundtrackUrl={soundtrackUrl || undefined}
        onClose={() => navigate('/')}
      />
    </>
  );
}
