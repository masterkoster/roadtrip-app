import { useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface Waypoint {
  id: number;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  orderIndex: number;
  duration: number | null;
  dayIndex: number | null;
}

interface LegInfo {
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
  distanceKm: number;
  durationHours: number;
}

interface HotelSuggestion {
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  type: string;
}

interface DayInfo {
  day: number;
  legs: LegInfo[];
  totalDistanceKm: number;
  totalDrivingHours: number;
  stops: { waypointId: number; name: string; durationMinutes: number }[];
  needsHotel: boolean;
  suggestedHotels: HotelSuggestion[];
}

interface EstimateData {
  totalDistance: number;
  totalDrivingHours: number;
  legCount: number;
  dayCount: number;
  days: DayInfo[];
  legs: LegInfo[];
}

interface ItineraryTimelineProps {
  tripId: number;
  waypoints: Waypoint[];
  onUpdate: () => void;
  onDayClick?: (dayIndex: number) => void;
  estimateData?: EstimateData | null;
  estimateLoading?: boolean;
}

function formatDuration(durationMinutes: number | null): string {
  if (durationMinutes == null || durationMinutes === 0) return '';
  if (durationMinutes < 60) return `${durationMinutes}m`;
  if (durationMinutes < 1440) return `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;
  const days = Math.floor(durationMinutes / 1440);
  const remaining = durationMinutes % 1440;
  return `${days}d ${Math.floor(remaining / 60)}h`;
}

export default function ItineraryTimeline({ tripId, waypoints, onUpdate, onDayClick, estimateData, estimateLoading }: ItineraryTimelineProps) {
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const handleAutoAssignDays = async () => {
    setAutoAssigning(true);
    try {
      const { data: result } = await api.post(`/waypoints/trip/${tripId}/auto-assign-days`);
      toast.success(`Assigned to ${result.dayCount} day(s)`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Auto-assign failed');
    } finally {
      setAutoAssigning(false);
    }
  };

  const maxDailyHours = estimateData?.days?.[0] ? 8 : null;

  if (waypoints.length < 2) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="text-center py-6 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <p className="text-sm">Add at least 2 stops to see the itinerary</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Itinerary
          {estimateData && <span className="text-gray-400 font-normal ml-1">· {estimateData.dayCount} day{estimateData.dayCount > 1 ? 's' : ''}</span>}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleAutoAssignDays}
            disabled={autoAssigning || waypoints.length < 2}
            className="text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {autoAssigning ? 'Assigning...' : 'Auto-assign days'}
          </button>
          <button
            onClick={onUpdate}
            disabled={estimateLoading}
            className="text-xs px-2.5 py-1.5 bg-roadtrip-600 hover:bg-roadtrip-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {estimateLoading ? 'Calculating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {estimateLoading && !estimateData && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-3 border-roadtrip-200 border-t-roadtrip-600 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-400">Calculating route...</p>
        </div>
      )}

      {estimateData && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-roadtrip-50 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-gray-500">Total Distance</p>
              <p className="text-sm font-bold text-gray-900">{estimateData.totalDistance.toFixed(1)} km</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Driving Time</p>
              <p className="text-sm font-bold text-gray-900">{estimateData.totalDrivingHours.toFixed(1)}h</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Stops</p>
              <p className="text-sm font-bold text-gray-900">{estimateData.legCount + 1}</p>
            </div>
          </div>

          {/* Day timeline */}
          <div className="space-y-3">
            {estimateData.days.map((day) => {
              const isExpanded = expandedDay === day.day;
              const totalTimeWithStops = day.totalDrivingHours + day.stops.reduce((s, st) => s + st.durationMinutes / 60, 0);
              return (
                <div key={day.day} className={`rounded-xl border transition-all ${day.needsHotel ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                  {/* Day header */}
                  <button
                    onClick={() => { setExpandedDay(isExpanded ? null : day.day); onDayClick?.(day.day); }}
                    className="w-full flex items-center justify-between p-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${day.needsHotel ? 'bg-amber-500 text-white' : 'bg-roadtrip-600 text-white'}`}>
                        {day.day + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Day {day.day + 1}</p>
                        <p className="text-[10px] text-gray-500">
                          {day.totalDistanceKm.toFixed(1)} km · {day.totalDrivingHours.toFixed(1)}h drive{totalTimeWithStops > day.totalDrivingHours ? ` · ${totalTimeWithStops.toFixed(1)}h total` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {day.needsHotel && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Hotel needed
                        </span>
                      )}
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2">
                      {/* Legs */}
                      {day.legs.map((leg, li) => {
                        const stop = day.stops.find(s => s.waypointId === leg.fromId);
                        return (
                          <div key={li} className="flex items-start gap-2">
                            <div className="flex flex-col items-center pt-1">
                              <div className="w-2 h-2 rounded-full bg-roadtrip-400" />
                              {li < day.legs.length - 1 && <div className="w-0.5 h-8 bg-gray-200" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-gray-700 truncate">{leg.fromName}</p>
                                {stop && stop.durationMinutes > 0 && (
                                  <span className="text-[10px] text-gray-400">{formatDuration(stop.durationMinutes)} stay</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                <span>{leg.distanceKm} km</span>
                                <span>·</span>
                                <span>{leg.durationHours.toFixed(1)}h</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Last stop */}
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-roadtrip-600 mt-1" />
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {day.legs.length > 0 ? day.legs[day.legs.length - 1].toName : day.stops[day.stops.length - 1]?.name || 'Destination'}
                        </p>
                      </div>

                      {/* Hotel suggestion */}
                      {day.needsHotel && day.suggestedHotels.length > 0 && (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-xs font-semibold text-amber-800">🏨 Accommodation near here</span>
                          </div>
                          <div className="space-y-1">
                            {day.suggestedHotels.slice(0, 3).map((hotel, hi) => (
                              <div key={hi} className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-700 truncate">{hotel.name}</span>
                                <span className="text-gray-400 shrink-0 ml-2">
                                  {hotel.distanceKm} km · {hotel.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Day total */}
                      <div className="flex items-center justify-between pt-1 text-[10px] text-gray-500 border-t border-dashed border-gray-200">
                        <span>Total: {day.totalDistanceKm.toFixed(1)} km</span>
                        <span>{day.totalDrivingHours.toFixed(1)}h driving</span>
                        <span>{totalTimeWithStops.toFixed(1)}h with stops</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
