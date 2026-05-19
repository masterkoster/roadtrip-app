import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';

interface Segment { title: string; content: string; waypointId: number | null; }

export default function NewGuidePage() {
  const { id: tripId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [recommendedSeason, setRecommendedSeason] = useState('');
  const [segments, setSegments] = useState<Segment[]>([{ title: '', content: '', waypointId: null }]);
  const [saving, setSaving] = useState(false);

  const addSegment = () => setSegments([...segments, { title: '', content: '', waypointId: null }]);

  const updateSegment = (idx: number, field: keyof Segment, value: any) => {
    const copy = [...segments];
    copy[idx] = { ...copy[idx], [field]: value };
    setSegments(copy);
  };

  const removeSegment = (idx: number) => {
    if (segments.length <= 1) return;
    setSegments(segments.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Guide title is required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/guides/trip/${tripId}`, {
        title, description, difficulty, recommendedSeason: recommendedSeason || null,
        segments: segments.filter(s => s.title.trim()),
      });
      toast.success('Guide created!');
      navigate(`/guides/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create guide');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/trips/${tripId}`} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to trip</Link>
          <h1 className="text-2xl font-bold mt-1">Create Guide</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <div>
            <label className="label">Guide Title *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Beginner's Guide to PCH" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Overview of what this guide covers..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Difficulty</label>
              <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
            </div>
            <div>
              <label className="label">Recommended Season</label>
              <select className="input" value={recommendedSeason} onChange={(e) => setRecommendedSeason(e.target.value)}>
                <option value="">Any</option>
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="fall">Fall</option>
                <option value="winter">Winter</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Guide Segments</h2>
            <button type="button" onClick={addSegment} className="btn-ghost text-sm">+ Add Step</button>
          </div>
          <div className="space-y-4">
            {segments.map((seg, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Step {idx + 1}</span>
                  {segments.length > 1 && (
                    <button type="button" onClick={() => removeSegment(idx)} className="text-xs text-red-600 hover:underline">Remove</button>
                  )}
                </div>
                <div className="space-y-2">
                  <input className="input" value={seg.title} onChange={(e) => updateSegment(idx, 'title', e.target.value)} placeholder="Step title" />
                  <textarea className="input min-h-[80px]" value={seg.content} onChange={(e) => updateSegment(idx, 'content', e.target.value)} placeholder="Describe what riders should do at this step..." />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Guide'}</button>
          <button type="button" onClick={() => navigate(`/trips/${tripId}`)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
