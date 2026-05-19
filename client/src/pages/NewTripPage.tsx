import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function NewTripPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gpxContent, setGpxContent] = useState('');
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importMethod, setImportMethod] = useState<'gpx' | 'manual' | 'live'>('manual');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGpxFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setGpxContent(ev.target?.result as string || '');
      reader.readAsText(file);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      const { data: trip } = await api.post('/trips', { title, description });
      if (gpxContent && importMethod === 'gpx') {
        await api.post(`/trips/${trip.id}/gpx`, { gpxContent });
        toast.success('GPX imported — route ready!');
      }
      toast.success('Trip created!');
      navigate(`/trips/${trip.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-6">&larr; Back</Link>
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-6">New Trip</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500 focus:border-transparent transition-all" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pacific Coast Highway" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-roadtrip-500 focus:border-transparent transition-all min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us about this route — the scenery, the roads, the experience..." />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Route Import</label>
          <div className="flex gap-2 mb-5">
            {(['manual', 'gpx', 'live'] as const).map((method) => (
              <button key={method} type="button" onClick={() => setImportMethod(method)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  importMethod === method
                    ? 'bg-roadtrip-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {method === 'gpx' ? '📄 GPX File' : method === 'live' ? '📍 Live Track' : '✏️ Manual'}
              </button>
            ))}
          </div>

          {importMethod === 'gpx' && (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-roadtip-400 transition-colors cursor-pointer bg-gray-50/50" onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".gpx,.xml" onChange={handleFile} className="hidden" />
              {gpxFile ? (
                <div>
                  <div className="w-12 h-12 rounded-xl bg-roadtrip-100 text-roadtrip-600 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="font-medium text-gray-900">{gpxFile.name}</p>
                  <p className="text-sm text-gray-500">{(gpxFile.size / 1024).toFixed(1)} KB</p>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setGpxFile(null); setGpxContent(''); }} className="text-sm text-red-600 hover:underline mt-2">Remove</button>
                </div>
              ) : (
                <div>
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 font-medium">Upload a GPX file</p>
                  <p className="text-xs text-gray-400 mt-1">GPX files from GPS devices, Garmin, or phone apps</p>
                </div>
              )}
            </div>
          )}

          {importMethod === 'live' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                </div>
                <div>
                  <p className="font-medium text-blue-900 text-sm">Live GPS Tracking</p>
                  <p className="text-sm text-blue-700/70 mt-1">After creating the trip, you can start live tracking from the trip page. Make sure location access is enabled in your browser.</p>
                </div>
              </div>
            </div>
          )}

          {importMethod === 'manual' && (
            <div className="bg-gray-50 rounded-xl p-5">
              <p className="text-sm text-gray-600">Create an empty trip. You can add route points by uploading a GPX file or using live tracking later.</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="px-6 py-2.5 bg-roadtrip-600 text-white rounded-xl font-medium text-sm hover:bg-roadtrip-700 transition-colors shadow-sm disabled:opacity-50" disabled={loading}>
            {loading ? 'Creating...' : 'Create Trip'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  );
}
