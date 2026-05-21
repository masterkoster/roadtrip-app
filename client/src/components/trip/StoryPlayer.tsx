import StorybookPlayer from './StorybookPlayer';
import AnimatedJourneyPlayer from './AnimatedJourneyPlayer';

import type { VehicleType } from './VehicleIcon';

interface StorySegment {
  id: number;
  title: string;
  content: string;
  orderIndex: number;
  waypointId: number | null;
}

interface Waypoint {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  orderIndex: number;
}

interface Photo {
  id: number;
  url: string;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  caption: string | null;
}

interface TrackPoint {
  latitude: number;
  longitude: number;
}

interface TripInfo {
  id: number;
  title: string;
  description: string | null;
  distance: number | null;
  duration: number | null;
  startDate: string | null;
  endDate: string | null;
  vehicle: string;
}

interface Participant {
  id: number;
  name: string;
  vehicleType: string;
  colorHex: string;
}

interface Highlight {
  waypointId: number;
}

interface StoryPlayerProps {
  mode: 'storybook' | 'animated';
  tripId: number;
  segments: StorySegment[];
  waypoints: Waypoint[];
  photos: Photo[];
  trackPoints: TrackPoint[];
  vehicle: VehicleType;
  trip: TripInfo;
  guideId?: number;
  readOnly?: boolean;
  allowShare?: boolean;
  participants: Participant[];
  highlights: Highlight[];
  soundtrackUrl?: string | null;
  onClose: () => void;
}

export default function StoryPlayer(props: StoryPlayerProps) {
  const {
    mode,
    tripId,
    segments,
    waypoints,
    photos,
    trackPoints,
    vehicle,
    trip,
    guideId,
    readOnly,
    allowShare,
    participants,
    highlights,
    soundtrackUrl,
    onClose,
  } = props;

  if (mode === 'animated') {
    return (
      <AnimatedJourneyPlayer
        trackPoints={trackPoints}
        waypoints={waypoints}
        photos={photos}
        participants={participants}
        highlights={highlights}
        autoPlay
        soundtrackUrl={soundtrackUrl || undefined}
        onClose={onClose}
      />
    );
  }

  return (
    <StorybookPlayer
      tripId={tripId}
      segments={segments}
      waypoints={waypoints}
      photos={photos}
      trackPoints={trackPoints}
      vehicle={vehicle}
      trip={trip}
      guideId={guideId}
      readOnly={readOnly}
      allowShare={allowShare}
      soundtrackUrl={soundtrackUrl}
      onClose={onClose}
    />
  );
}
