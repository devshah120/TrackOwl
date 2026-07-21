import { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { tracking } from '../services/api';
import { GoogleFleetMap } from './GoogleFleetMap';

const POLL_MS = 5000;

export function FleetMapWidget({ height = '500px', selectedTruck, onSelectTruck }) {
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
        if (!selectedTruck && data.devices?.length && onSelectTruck) {
          onSelectTruck(data.devices[0].id || data.devices[0]._id);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        devices={devices}
        selectedId={selectedTruck}
        onSelect={(id) => onSelectTruck?.(id)}
      />

      {devices.length === 0 && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none">
          <p className="bg-white/90 rounded-lg px-4 py-2 text-sm text-slate-500 shadow">
            No vehicles yet — add one from Live Tracking.
          </p>
        </div>
      )}
    </div>
  );
}
