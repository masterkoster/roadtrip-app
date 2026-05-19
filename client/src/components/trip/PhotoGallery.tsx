import { useState, useEffect, useCallback } from 'react';

interface Photo { id: number; url: string; thumbnailUrl: string | null; caption: string | null; latitude?: number | null; longitude?: number | null; }

interface PhotoGalleryProps {
  photos: Photo[];
  tripId?: number;
}

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [selected, setSelected] = useState<Photo | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selected) return;
    if (e.key === 'Escape') setSelected(null);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const idx = photos.findIndex(p => p.id === selected.id);
      if (idx === -1) return;
      const next = e.key === 'ArrowRight' ? photos[(idx + 1) % photos.length] : photos[(idx - 1 + photos.length) % photos.length];
      setSelected(next);
    }
  }, [selected, photos]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setSelected(photo)}
            className={`group relative overflow-hidden rounded-lg bg-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-roadtrip-500 ${i === 0 && photos.length >= 2 ? 'row-span-2 col-span-2' : ''}`}
            style={{ aspectRatio: i === 0 && photos.length >= 2 ? undefined : '1' }}
          >
            <img
              src={photo.thumbnailUrl || photo.url}
              alt={photo.caption || ''}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
            {photo.caption && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-white text-xs truncate">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setSelected(null)}>
          <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none z-10">&times;</button>
          <button onClick={(e) => { e.stopPropagation(); const idx = photos.findIndex(p => p.id === selected.id); setSelected(photos[(idx - 1 + photos.length) % photos.length]); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl leading-none">&lsaquo;</button>
          <button onClick={(e) => { e.stopPropagation(); const idx = photos.findIndex(p => p.id === selected.id); setSelected(photos[(idx + 1) % photos.length]); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl leading-none">&rsaquo;</button>
          <div className="max-w-4xl max-h-[85vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <img src={selected.url} alt={selected.caption || ''} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            {selected.caption && <p className="text-white/80 text-center mt-3 text-sm">{selected.caption}</p>}
          </div>
        </div>
      )}
    </>
  );
}
