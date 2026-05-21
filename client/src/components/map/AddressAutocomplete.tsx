import { useState, useEffect, useRef, useCallback } from 'react';

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (label: string, lat: number, lng: number) => void;
}

export default function AddressAutocomplete({ placeholder, value, onChange, onSelect }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
      if (!res.ok) { setSuggestions([]); return; }
      const data = await res.json();
      const items: Suggestion[] = (data.features || []).map((f: any) => {
        const p = f.properties || {};
        const parts = [p.name, p.city, p.state, p.country].filter(Boolean);
        return { label: parts.join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
      }).filter((s: Suggestion) => s.label);
      setSuggestions(items);
      setOpen(items.length > 0);
      setActiveIdx(-1);
    } catch { setSuggestions([]); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, fetchSuggestions]);

  const select = (s: Suggestion) => {
    onChange(s.label);
    onSelect(s.label, s.lat, s.lng);
    setOpen(false);
    setSuggestions([]);
  };

  const keyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="relative">
      <input ref={inputRef} type="text" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} onKeyDown={keyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 text-sm outline-none focus:border-white/40 focus:bg-white/15 transition-all" />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={s.label} onMouseDown={() => select(s)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${i === activeIdx ? 'bg-roadtrip-50 text-roadtrip-800' : 'text-gray-700 hover:bg-gray-50'}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
