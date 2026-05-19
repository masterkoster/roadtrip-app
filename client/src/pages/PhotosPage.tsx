import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../api/client';
import toast from 'react-hot-toast';

interface Photo { id: number; url: string; thumbnailUrl: string | null; latitude: number | null; longitude: number | null; caption: string | null; }

export default function PhotosPage() {
  const { id: tripId } = useParams();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchPhotos = () => {
    api.get(`/trips/${tripId}`).then(({ data }) => setPhotos(data.photos || [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPhotos(); }, [tripId]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      acceptedFiles.forEach((f) => formData.append('photos', f));
      await api.post(`/photos/${tripId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${acceptedFiles.length} photo(s) uploaded`);
      fetchPhotos();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [tripId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] }, maxSize: 20 * 1024 * 1024 });

  const updatePhoto = async (photoId: number, data: { caption?: string; latitude?: number; longitude?: number }) => {
    try {
      await api.put(`/photos/${tripId}/${photoId}`, data);
      toast.success('Photo updated');
      fetchPhotos();
    } catch { toast.error('Failed to update'); }
  };

  const deletePhoto = async (photoId: number) => {
    if (!confirm('Delete this photo?')) return;
    try { await api.delete(`/photos/${tripId}/${photoId}`); toast.success('Photo deleted'); fetchPhotos(); }
    catch { toast.error('Failed to delete'); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/trips/${tripId}`} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to trip</Link>
          <h1 className="text-2xl font-bold mt-1">Photos</h1>
        </div>
      </div>

      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 cursor-pointer transition-colors ${isDragActive ? 'border-roadtrip-500 bg-roadtrip-50' : 'border-gray-300 hover:border-roadtrip-400'}`}>
        <input {...getInputProps()} />
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {isDragActive ? <p className="text-roadtrip-600 font-medium">Drop photos here</p> : <p className="text-gray-600">{uploading ? 'Uploading...' : 'Drag & drop photos here, or click to select'}</p>}
        <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP, GIF (max 20MB each)</p>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No photos yet. Upload your roadtrip photos above.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="card p-2">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                <img src={photo.thumbnailUrl || photo.url} alt={photo.caption || ''} className="w-full h-full object-cover" />
              </div>
              <input className="input text-xs mb-1" defaultValue={photo.caption || ''} placeholder="Add caption..."
                onBlur={(e) => { if (e.target.value !== (photo.caption || '')) updatePhoto(photo.id, { caption: e.target.value }); }} />
              <div className="flex gap-1 text-xs text-gray-400 mb-1">
                <input className="w-1/2 input text-xs" defaultValue={photo.latitude ?? ''} placeholder="Lat"
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updatePhoto(photo.id, { latitude: v }); }} />
                <input className="w-1/2 input text-xs" defaultValue={photo.longitude ?? ''} placeholder="Lng"
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updatePhoto(photo.id, { longitude: v }); }} />
              </div>
              <button onClick={() => deletePhoto(photo.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
