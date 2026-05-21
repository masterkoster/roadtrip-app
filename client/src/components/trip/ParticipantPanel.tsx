import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';

type Participant = { id: number; name: string; vehicleType: string; colorHex: string };

const VEHICLE_OPTIONS: Array<{ value: Participant['vehicleType']; label: string; glyph: string }> = [
  { value: 'car', label: 'Trailblazer', glyph: '🚙' },
  { value: 'rv', label: 'Camp Rover', glyph: '🚐' },
  { value: 'motorcycle', label: 'Freewheel', glyph: '🏍️' },
  { value: 'bike', label: 'Spoke Sprinter', glyph: '🚴' },
];

const COLOR_SWATCHES = ['#f97316', '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#f472b6', '#22d3ee', '#ff8fab'];

type DraftFields = Partial<Participant>;

interface ParticipantPanelProps {
  tripId: number;
  participants: Participant[];
  setParticipants: Dispatch<SetStateAction<Participant[]>>;
  defaultVehicle: string;
}

const ensureHex = (hex: string) => (hex.startsWith('#') ? hex : `#${hex}`).toLowerCase();

const pickColor = (existing: Participant[]) => {
  const used = new Set(existing.map(p => p.colorHex.toLowerCase()));
  const palette = COLOR_SWATCHES.map(c => c.toLowerCase());
  const available = palette.find(c => !used.has(c));
  return available ?? palette[(existing.length + 1) % palette.length];
};

const makeDefaultName = (existing: Participant[]) => {
  const index = existing.length + 1;
  return index === 1 ? 'Lead Traveler' : `Co-Pilot ${index}`;
};

export default function ParticipantPanel({ tripId, participants, setParticipants, defaultVehicle }: ParticipantPanelProps) {
  const [drafts, setDrafts] = useState<Record<number, DraftFields>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [panelBusy, setPanelBusy] = useState(false);

  const hasCrew = participants.length > 0;

  const refreshParticipants = useCallback(async () => {
    try {
      const { data } = await api.get(`/trips/${tripId}/participants`);
      if (Array.isArray(data)) {
        setParticipants(data);
      }
    } catch (err) {
      console.error('Refresh participants error', err);
    }
  }, [setParticipants, tripId]);

  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);

  const markSaving = (id: number, status: boolean) => {
    setSaving(prev => ({ ...prev, [id]: status }));
  };

  const setDraftValue = (id: number, field: keyof DraftFields, value: string) => {
    setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const clearDraftField = (id: number, field: keyof DraftFields) => {
    setDrafts(prev => {
      if (!prev[id]) return prev;
      const nextFields = { ...prev[id] };
      delete nextFields[field];
      const nextDrafts = { ...prev };
      if (Object.keys(nextFields).length === 0) delete nextDrafts[id];
      else nextDrafts[id] = nextFields;
      return nextDrafts;
    });
  };

  const updateParticipant = async (id: number, patch: Partial<Participant>, message?: string) => {
    if (Object.keys(patch).length === 0) return;
    markSaving(id, true);
    try {
      const { data } = await api.put(`/trips/${tripId}/participants/${id}`, patch);
      setParticipants(prev => prev.map(p => (p.id === id ? data : p)));
      if (message) toast.success(message);
    } catch (err) {
      console.error('Update participant error', err);
      toast.error('Could not update traveler');
      await refreshParticipants();
    } finally {
      markSaving(id, false);
    }
  };

  const handleNameBlur = (participant: Participant) => {
    const draftValue = drafts[participant.id]?.name;
    if (draftValue == null) return;
    const trimmed = draftValue.trim();
    if (!trimmed || trimmed === participant.name) {
      clearDraftField(participant.id, 'name');
      return;
    }
    updateParticipant(participant.id, { name: trimmed }, 'Crew name updated');
    clearDraftField(participant.id, 'name');
  };

  const handleVehicleChange = (participant: Participant, value: Participant['vehicleType']) => {
    const nextValue = value as Participant['vehicleType'];
    if (nextValue === participant.vehicleType) {
      clearDraftField(participant.id, 'vehicleType');
      return;
    }
    setDraftValue(participant.id, 'vehicleType', nextValue);
    updateParticipant(participant.id, { vehicleType: nextValue }, 'Vehicle avatar updated');
    clearDraftField(participant.id, 'vehicleType');
  };

  const handleColorChange = (participant: Participant, hex: string) => {
    const normalized = ensureHex(hex);
    if (normalized === participant.colorHex.toLowerCase()) {
      clearDraftField(participant.id, 'colorHex');
      return;
    }
    setDraftValue(participant.id, 'colorHex', normalized);
    updateParticipant(participant.id, { colorHex: normalized }, 'Color updated');
    clearDraftField(participant.id, 'colorHex');
  };

  const handleRemove = async (participant: Participant) => {
    if (participants.length <= 1) {
      toast.error('Keep at least one traveler for the story');
      return;
    }
    markSaving(participant.id, true);
    try {
      await api.delete(`/trips/${tripId}/participants/${participant.id}`);
      setParticipants(prev => prev.filter(p => p.id !== participant.id));
      toast.success('Traveler removed');
    } catch (err) {
      console.error('Delete participant error', err);
      toast.error('Could not remove traveler');
      await refreshParticipants();
    } finally {
      markSaving(participant.id, false);
    }
  };

  const handleAdd = async () => {
    setPanelBusy(true);
    try {
      const baseVehicle = VEHICLE_OPTIONS.some(opt => opt.value === defaultVehicle)
        ? (defaultVehicle as Participant['vehicleType'])
        : 'car';
      const payload = {
        name: makeDefaultName(participants),
        vehicleType: baseVehicle,
        colorHex: pickColor(participants),
      };
      const { data } = await api.post(`/trips/${tripId}/participants`, payload);
      setParticipants(prev => [...prev, data]);
      toast.success('Traveler added');
    } catch (err) {
      console.error('Add participant error', err);
      toast.error('Could not add traveler');
    } finally {
      setPanelBusy(false);
    }
  };

  const renderNameValue = (participant: Participant) => drafts[participant.id]?.name ?? participant.name;
  const renderVehicleValue = (participant: Participant) => drafts[participant.id]?.vehicleType ?? participant.vehicleType;
  const renderColorValue = (participant: Participant) => drafts[participant.id]?.colorHex ?? participant.colorHex;

  const vehicleOptionLookup = useMemo(() => {
    const map = new Map<string, { label: string; glyph: string }>();
    VEHICLE_OPTIONS.forEach(opt => map.set(opt.value, { label: opt.label, glyph: opt.glyph }));
    return map;
  }, []);

  return (
    <div className="absolute top-6 left-6 z-[70] w-80 max-w-[80vw] text-white">
      <div className="bg-black/55 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.45em] text-white/50">Crew</div>
            <h3 className="text-lg font-semibold mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Travel Manifest</h3>
          </div>
          <button
            onClick={handleAdd}
            disabled={panelBusy}
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            + Add Companion
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-[52vh] overflow-y-auto pr-1 custom-scroll-thin">
          {hasCrew ? participants.map(participant => {
            const vehicleMeta = vehicleOptionLookup.get(participant.vehicleType) || vehicleOptionLookup.get('car');
            return (
              <div key={participant.id} className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl drop-shadow" role="img" aria-label={vehicleMeta?.label || 'Vehicle'}>
                      {vehicleMeta?.glyph || '🚙'}
                    </span>
                    <div className="flex flex-col">
                      <input
                        className="bg-transparent text-sm font-semibold text-white placeholder-white/30 border-b border-transparent focus:border-amber-400 focus:outline-none transition-colors"
                        value={renderNameValue(participant)}
                        onChange={(e) => setDraftValue(participant.id, 'name', e.target.value)}
                        onBlur={() => handleNameBlur(participant)}
                        placeholder="Crew name"
                        disabled={saving[participant.id]}
                      />
                      <span className="text-[11px] text-white/40 uppercase tracking-[0.3em]">#{participant.id.toString().padStart(3, '0')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(participant)}
                    disabled={saving[participant.id]}
                    className="text-[11px] uppercase tracking-[0.2em] text-white/50 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 block mb-1">Vehicle</label>
                    <div className="relative">
                      <select
                        value={renderVehicleValue(participant)}
                        onChange={(e) => handleVehicleChange(participant, e.target.value as Participant['vehicleType'])}
                        disabled={saving[participant.id]}
                        className="w-full appearance-none bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-xs font-medium text-white pr-8 focus:outline-none focus:border-amber-400"
                      >
                        {VEHICLE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-gray-900">
                            {opt.glyph} {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 text-xs">▾</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 block mb-1">Accent</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={renderColorValue(participant)}
                        onChange={(e) => handleColorChange(participant, e.target.value)}
                        disabled={saving[participant.id]}
                        className="w-9 h-9 rounded-full border-2 border-white/30 cursor-pointer bg-transparent"
                        title="Accent color"
                      />
                      <div className="flex gap-1">
                        {COLOR_SWATCHES.map(sw => (
                          <button
                            key={sw}
                            type="button"
                            className={`w-4 h-4 rounded-full border border-white/40 ${renderColorValue(participant).toLowerCase() === sw.toLowerCase() ? 'ring-2 ring-white/80' : ''}`}
                            style={{ background: sw }}
                            onClick={() => handleColorChange(participant, sw)}
                            disabled={saving[participant.id]}
                            aria-label={`Set color ${sw}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-white/15 py-8 px-4 text-center text-white/60 text-sm">
              No companions yet. Add a traveler to craft convoy moments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
