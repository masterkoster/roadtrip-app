import { useMemo } from 'react';

interface TrackPoint { latitude: number; longitude: number; elevation?: number | null; }

interface ElevationProfileProps {
  trackPoints: TrackPoint[];
}

export default function ElevationProfile({ trackPoints }: ElevationProfileProps) {
  const profile = useMemo(() => {
    if (trackPoints.length < 2) return null;

    let totalDist = 0;
    const segments: { dist: number; ele: number }[] = [{ dist: 0, ele: trackPoints[0].elevation ?? 0 }];

    for (let i = 1; i < trackPoints.length; i++) {
      const prev = trackPoints[i - 1];
      const curr = trackPoints[i];
      const dlat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dlon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dlat / 2) ** 2 + Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDist += 6371 * c;
      if (curr.elevation != null) {
        segments.push({ dist: totalDist, ele: curr.elevation });
      }
    }

    if (segments.length < 2) return null;

    const elevations = segments.map(s => s.ele);
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const range = Math.max(maxEle - minEle, 1);
    const totalGain = elevations.reduce((sum, ele, i) => i > 0 && ele > elevations[i - 1] ? sum + (ele - elevations[i - 1]) : sum, 0);

    const width = 100;
    const height = 40;
    const padding = 2;

    const points = segments.map(s => {
      const x = padding + (s.dist / totalDist) * (width - 2 * padding);
      const y = height - padding - ((s.ele - minEle) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return {
      path: `M${points.join(' L')}`,
      fillPath: `M${points.join(' L')} L${padding + (width - 2 * padding)},${height - padding} L${padding},${height - padding} Z`,
      minEle: Math.round(minEle),
      maxEle: Math.round(maxEle),
      totalGain: Math.round(totalGain),
      totalDist: Math.round(totalDist * 10) / 10,
    };
  }, [trackPoints]);

  if (!profile) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Elevation Profile</h3>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>{profile.totalDist} km</span>
          <span>↑ {profile.totalGain}m gain</span>
        </div>
      </div>
      <svg viewBox="0 0 100 40" className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0066ff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0066ff" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Fill */}
        <path d={profile.fillPath} fill="url(#eleGrad)" />
        {/* Line */}
        <path d={profile.path} fill="none" stroke="#0066ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Min/Max labels */}
        <text x="0" y="8" fontSize="3" fill="#999">{profile.maxEle}m</text>
        <text x="0" y="38" fontSize="3" fill="#999">{profile.minEle}m</text>
      </svg>
    </div>
  );
}
