import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import StoryPlayer from '../components/trip/StoryPlayer';
import toast from 'react-hot-toast';

interface StorySegment { id: number; title: string; content: string; orderIndex: number; waypointId: number | null; }
interface Waypoint { id: number; name: string; description: string | null; latitude: number; longitude: number; orderIndex: number; }
interface Photo { id: number; url: string; thumbnailUrl: string | null; latitude: number | null; longitude: number | null; caption: string | null; }
interface TrackPoint { latitude: number; longitude: number; }
interface Guide { id: number; title: string; description: string | null; difficulty: string; }
interface TripInfo { id: number; title: string; description: string | null; distance: number | null; duration: number | null; startDate: string | null; endDate: string | null; vehicle: string; }

type StoryParticipant = { id: number; name: string; vehicleType: string; colorHex: string };

export default function StorybookPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mode = pathname.endsWith('/animated') ? 'animated' : 'storybook';

  const [data, setData] = useState<{
    guide: Guide;
    segments: StorySegment[];
    waypoints: Waypoint[];
    photos: Photo[];
    trackPoints: TrackPoint[];
    trip: TripInfo;
    participants: StoryParticipant[];
    settings?: { defaultMode?: string; highlights?: Array<{ waypointId: number }>; soundtrackUrl?: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const tripId = Number(id);

  useEffect(() => {
    if (!tripId) return;
    api.get(`/stories/${tripId}`)
      .then(({ data: storyData }) => {
        setData({
          guide: storyData.guide,
          segments: storyData.segments,
          waypoints: storyData.waypoints,
          photos: storyData.photos,
          trackPoints: storyData.trackPoints,
          trip: storyData.trip,
          participants: storyData.participants || [{ id: 0, name: 'Traveler', vehicleType: storyData.trip?.vehicle || 'car', colorHex: '#f97316' }],
          settings: storyData.settings,
        });
      })
      .catch((err: any) => {
        if (err.response?.status === 404) toast.error('No guide found for this trip');
        else toast.error('Failed to load story');
        navigate(`/trips/${tripId}`);
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  const highlights = data?.settings?.highlights?.filter(h =>
    data.waypoints.some(w => w.id === h.waypointId)
  ) || [];

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#faf6ef] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading story...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50">
      <StoryPlayer
      mode={mode}
      tripId={tripId}
      segments={data.segments}
      waypoints={data.waypoints}
      photos={data.photos}
      trackPoints={data.trackPoints}
      vehicle={(data.trip?.vehicle as any) || 'car'}
      trip={data.trip}
      guideId={data.guide.id}
      allowShare
      participants={data.participants}
      highlights={highlights}
      soundtrackUrl={data.settings?.soundtrackUrl || null}
      onClose={() => navigate(`/trips/${tripId}`)}
    />
    </div>
  );
}
