import { useEffect, useState } from 'react';
import { Truck, Wifi, WifiOff, Route, Wrench, AlertTriangle } from 'lucide-react';
import { fleet } from '../services/api';

// The summary is cheap to compute and changes as often as the vehicles report,
// so it refreshes on the same 5s cadence as the live map rather than sitting
// stale beside it.
const POLL_MS = 5000;

// One tile per headline number. Colour carries meaning here — offline and
// alerts are the two that want the eye — so the palette is deliberately flat
// for the neutral counts and warm only for the ones that need action.
const TILES = [
  {
    key: 'totalVehicles',
    title: 'Total Vehicles',
    icon: Truck,
    color: 'bg-blue-100',
    textColor: 'text-blue-600',
    subtitle: (s) =>
      s.untracked ? `${s.untracked} without a tracker` : 'All vehicles tracked',
  },
  {
    key: 'online',
    title: 'Online',
    icon: Wifi,
    color: 'bg-green-100',
    textColor: 'text-green-600',
    // Moving vs parked is the useful split once you know a vehicle is
    // reporting at all, so it goes in the subtitle rather than its own tile.
    subtitle: (s) => `${s.moving} moving · ${s.idle} parked`,
  },
  {
    key: 'offline',
    title: 'Offline',
    icon: WifiOff,
    color: 'bg-red-100',
    textColor: 'text-red-600',
    subtitle: () => 'No signal for over 2 min',
  },
  {
    key: 'activeTrips',
    title: 'Active Trips',
    icon: Route,
    color: 'bg-indigo-100',
    textColor: 'text-indigo-600',
    subtitle: () => 'Currently running',
  },
  {
    key: 'maintenance',
    title: 'In Maintenance',
    icon: Wrench,
    color: 'bg-orange-100',
    textColor: 'text-orange-600',
    subtitle: () => 'Off the road for service',
  },
  {
    key: 'alerts',
    title: 'Open Alerts',
    icon: AlertTriangle,
    color: 'bg-yellow-100',
    textColor: 'text-yellow-600',
    subtitle: () => 'Unread — see the bell',
  },
];

export function FleetDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fleet.summary();
        if (cancelled) return;
        setSummary(res.summary);
        setError('');
      } catch (err) {
        if (cancelled) return;
        // A seat without the trucks grant simply has no fleet dashboard; that
        // is the role working as intended, not an error to shout about.
        if (err.status !== 403) setError(err.message || 'Failed to load fleet summary');
        setSummary(null);
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

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {TILES.map((tile) => (
          <div
            key={tile.key}
            className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 animate-pulse"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 mb-3" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-6 w-12 bg-slate-100 rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
        {error}
      </div>
    );
  }

  // No summary and no error means the seat cannot read trucks — render nothing
  // rather than a strip of zeroes that looks like an empty fleet.
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {TILES.map((tile) => {
        const Icon = tile.icon;
        const value = summary[tile.key] ?? 0;
        return (
          <div
            key={tile.key}
            className="bg-white rounded-lg p-4 shadow-sm border border-slate-200"
          >
            <div
              className={`${tile.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}
            >
              <Icon className={`w-5 h-5 ${tile.textColor}`} />
            </div>
            <p className="text-slate-600 text-xs font-medium">{tile.title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            <p className="text-slate-500 text-[11px] mt-1 leading-tight">
              {tile.subtitle(summary)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
