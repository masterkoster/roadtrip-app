import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

interface Segment { id: number; title: string; content: string; orderIndex: number; waypointId: number | null; }
interface Guide { id: number; tripId: number; title: string; description: string | null; difficulty: string; recommendedSeason: string | null; estimatedDuration: number | null; segments: Segment[]; }

export default function GuideViewPage() {
  const { id } = useParams();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/guides/${id}`).then(({ data }) => setGuide(data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading guide...</div>;
  if (!guide) return <div className="text-center py-12 text-gray-500">Guide not found</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <Link to={`/trips/${guide.tripId}`} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to trip</Link>

      <div className="card mt-2 mb-6">
        <h1 className="text-2xl font-bold mb-2">{guide.title}</h1>
        {guide.description && <p className="text-gray-600 mb-4">{guide.description}</p>}
        <div className="flex gap-4 text-sm text-gray-500">
          <span className="capitalize">Difficulty: <strong>{guide.difficulty}</strong></span>
          {guide.recommendedSeason && <span>Season: <strong className="capitalize">{guide.recommendedSeason}</strong></span>}
        </div>
      </div>

      <div className="space-y-4">
        {guide.segments.map((seg, i) => (
          <div key={seg.id} className="card">
            <div className="flex items-start gap-4">
              <span className="w-8 h-8 rounded-full bg-roadtrip-600 text-white text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">{seg.title}</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{seg.content}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
