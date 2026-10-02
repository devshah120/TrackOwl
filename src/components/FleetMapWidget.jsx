import { useEffect, useState } from 'react';
import { Loader, SatelliteDish } from 'lucide-react';
import { tracking } from '../services/api';
import { GoogleFleetMap } from './GoogleFleetMap';

const POLL_MS = 5000;

export function FleetMapWidget({
  height = '500px',
  selectedTruck,
  onSelectTruck,
  untrackedTrucks = [],
  deviceLabels = {},
  fleetOnly = false,
}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await tracking.getDevices();
        if (cancelled) return;
        setDevices(data.devices || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not reach the tracking API');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // With fleetOnly, a device not fitted to one of the fleet's trucks is not
  // plotted; every pin shown carries its truck number.
  const shown = devices.flatMap((d) => {
    const label = deviceLabels[String(d.id || d._id)];
    if (label) return [{ ...d, name: label }];
    return fleetOnly ? [] : [d];
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden" style={{ height }}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-slate-600">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-red-600 px-4 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="relative bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden"
      style={{ height }}
    >
      <GoogleFleetMap
        devices={shown}
        selectedId={selectedTruck}
        onSelect={(id) => onSelectTruck?.(id)}
      />

      {shown.length === 0 && untrackedTrucks.length === 0 && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none">
          <p className="bg-white/90 rounded-lg px-4 py-2 text-sm text-slate-500 shadow">
            No vehicles yet — add one from Live Tracking.
          </p>
        </div>
      )}

      {/* Fleet trucks with no GPS unit fitted have no position to plot, so
          they are named here instead of silently missing from the map. */}
      {untrackedTrucks.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[10] max-w-[280px] bg-white/95 rounded-lg shadow-lg border border-orange-200">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-orange-100">
            <SatelliteDish className="w-4 h-4 text-orange-600 shrink-0" />
            <p className="text-sm font-semibold text-slate-900">
              {untrackedTrucks.length} {untrackedTrucks.length === 1 ? 'truck needs' : 'trucks need'} a GPS device
            </p>
          </div>
          <ul className="max-h-40 overflow-y-auto px-3 py-2 space-y-1">
            {untrackedTrucks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-slate-800 truncate">{t.name}</span>
                <span className="text-orange-700 whitespace-nowrap">Not connected</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
