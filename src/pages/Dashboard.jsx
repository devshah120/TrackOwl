import { useState, useEffect } from 'react';
import { TrendingUp, Truck, AlertCircle, Check, SatelliteDish } from 'lucide-react';
import { FleetMapWidget } from '../components/FleetMapWidget';
import { FleetDashboard } from '../components/FleetDashboard';
import { fleet, ledger, billing, tracking } from '../services/api';
import {
  ACTIVE_STATUSES,
  VEHICLE_STATUSES,
  getStatusColor as vehicleStatusColor,
} from '../constants/vehicle';

const DEVICE_POLL_MS = 5000;

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

export function Dashboard() {
  const [selectedTruck, setSelectedTruck] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trucksData, setTrucksData] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [billingData, setBillingData] = useState([]);
  const [devices, setDevices] = useState([]);
  // Whether this role can read the fleet list. When it can, the fleet is the
  // source of truth for which vehicles exist; when it cannot, the dashboard
  // falls back to the raw tracking devices.
  const [fleetVisible, setFleetVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Each section is fetched independently and its failure kept local: the
      // dashboard is shared by every role, and an Accountant has no fleet
      // grant while a Fleet Manager cannot read billing. A single Promise.all
      // would let one expected 403 blank the whole page, so a section the
      // caller may not see simply stays empty.
      const [fleetRes, ledgerRes, billingRes] = await Promise.allSettled([
        fleet.list(),
        ledger.list(),
        billing.list(),
      ]);
      if (cancelled) return;

      if (fleetRes.status === 'fulfilled') {
        setTrucksData(fleetRes.value.trucks || []);
        setFleetVisible(true);
      }
      if (ledgerRes.status === 'fulfilled') setLedgerData(ledgerRes.value.entries || []);
      if (billingRes.status === 'fulfilled') setBillingData(billingRes.value.billingTrips || []);

      // Only a genuine failure is worth a banner — a 403 is the role working
      // as intended, not something the user can act on.
      const realFailure = [fleetRes, ledgerRes, billingRes].find(
        (r) => r.status === 'rejected' && r.reason?.status !== 403
      );
      if (realFailure) setError(realFailure.reason?.message || 'Failed to load dashboard data');

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Live vehicle positions — the same feed Live Tracking shows, polled the same way.
  useEffect(() => {
    let cancelled = false;
    const loadDevices = async () => {
      try {
        const res = await tracking.getDevices();
        if (cancelled) return;
        setDevices(res.devices || []);
      } catch {
        // Fleet Summary just stays empty; the main error banner covers fleet/ledger/billing failures.
      }
    };
    loadDevices();
    const timer = setInterval(loadDevices, DEVICE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysLedger = ledgerData.filter((e) => String(e.date).slice(0, 10) === todayStr);
  const todaysIncome = todaysLedger.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const todaysExpense = todaysLedger.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const pendingBalance = billingData
    .filter((b) => b.status !== 'Paid')
    .reduce((sum, b) => sum + b.amount, 0);
  // "Active" covers both in-service states: parked-and-available counts as
  // fleet strength, a truck in Maintenance or retired does not.
  const activeTruckCount = trucksData.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;

  const stats = [
    {
      title: 'Active Trucks',
      value: String(activeTruckCount),
      subtitle: `${trucksData.length} total in fleet`,
      icon: Truck,
      color: 'bg-blue-100',
      textColor: 'text-blue-600',
    },
    {
      title: "Today's Income",
      value: `₹${todaysIncome.toLocaleString()}`,
      subtitle: 'Ledger income entries today',
      icon: Check,
      color: 'bg-green-100',
      textColor: 'text-green-600',
    },
    {
      title: 'Pending Balance',
      value: `₹${pendingBalance.toLocaleString()}`,
      subtitle: 'Outstanding billing trips',
      icon: AlertCircle,
      color: 'bg-yellow-100',
      textColor: 'text-yellow-600',
    },
    {
      title: 'Net Profit (Today)',
      value: `₹${(todaysIncome - todaysExpense).toLocaleString()}`,
      subtitle: "Today's income minus expenses",
      icon: TrendingUp,
      color: 'bg-purple-100',
      textColor: 'text-purple-600',
    },
  ];

  // Every fleet truck is listed, not just the ones reporting: a truck with no
  // GPS unit fitted shows up as needing one rather than silently missing.
  // Telemetry comes from the same live devices Live Tracking shows, so the
  // summary and the map never disagree about where a vehicle is.
  const deviceById = new Map(devices.map((d) => [String(d.id || d._id), d]));
  const linkedDeviceIds = new Set();
  const deviceRow = (d, name) => ({
    id: String(d.id || d._id),
    name,
    status: d.status,
    location: d.lastPosition?.latitude ? `${Math.round(d.lastPosition.speed || 0)} km/h` : 'No position yet',
    driver: timeAgo(d.lastSeenAt),
    tracked: true,
  });
  const trucks = trucksData.map((t) => {
    if (t.device) {
      const deviceId = String(t.device._id || t.device.id || t.device);
      linkedDeviceIds.add(deviceId);
      // Prefer the live poll; the copy populated on the truck covers the gap
      // before the first poll lands.
      const live = deviceById.get(deviceId) || (typeof t.device === 'object' ? t.device : { _id: deviceId });
      return deviceRow({ status: 'offline', ...live }, t.number);
    }
    return {
      id: `truck-${t._id || t.id}`,
      name: t.number,
      status: 'no gps',
      location: 'Connect a GPS device to track this truck',
      driver: t.model || t.vehicleType || 'Truck',
      tracked: false,
    };
  });
  // A device not fitted to any fleet truck is not a vehicle of this fleet, so
  // it stays off the summary and the map. Only a role that cannot read the
  // fleet sees the raw devices, since it has no trucks to show instead.
  if (!fleetVisible) {
    devices
      .filter((d) => !linkedDeviceIds.has(String(d.id || d._id)))
      .forEach((d) => trucks.push(deviceRow(d, d.name)));
  }
  const untrackedTrucks = trucks.filter((t) => !t.tracked);
  const trackedTrucks = trucks.filter((t) => t.tracked);
  // Map pins carry the truck number rather than the raw device name / IMEI.
  const deviceLabels = Object.fromEntries(trackedTrucks.map((t) => [t.id, t.name]));
  // Falls back to the first tracked truck until the user picks one, and if
  // the picked one drops out of the list.
  const activeTruckId = trackedTrucks.some((t) => t.id === selectedTruck)
    ? selectedTruck
    : trackedTrucks[0]?.id || '';

  const recentTrips = [...billingData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
    .map((b) => ({
      id: b._id || b.id,
      route: `${b.partyName} (${b.truck})`,
      distance: b.bill || '—',
      freight: `₹${b.amount.toLocaleString()}`,
      status: b.status,
    }));

  const pendingPayments = billingData
    .filter((b) => b.status !== 'Paid')
    .map((b) => ({
      buyer: b.partyName,
      amount: `₹${b.amount.toLocaleString()}`,
      daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(b.date)) / (1000 * 60 * 60 * 24))),
    }));

  // Vehicle statuses come from the shared palette; the cases below are the
  // device ('moving'/'idle'/...) and billing ('Paid'/...) vocabularies, which
  // this table also renders.
  const getStatusColor = (status) => {
    if (VEHICLE_STATUSES.includes(status)) return vehicleStatusColor(status);
    switch (status) {
      case 'moving':
        return 'bg-blue-100 text-blue-800';
      case 'idle':
        return 'bg-yellow-100 text-yellow-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'no gps':
        return 'bg-orange-100 text-orange-800';
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'Pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Welcome back! Here's your fleet overview.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500">Loading dashboard...</div>
      )}

      {!loading && (
      <>
      {/* Fleet Dashboard — live vehicle counts, alongside the financial stats
          below. Fetches and polls on its own so the map and the money figures
          are not held up waiting on it. */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Fleet Dashboard</h2>
        <FleetDashboard />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
              <p className="text-slate-600 text-sm font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
              <p className="text-slate-500 text-xs mt-2">{stat.subtitle}</p>
            </div>
          );
        })}
      </div>

      {/* Fleet Live Map and Truck Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map on Left */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Fleet Live Map</h2>
          <FleetMapWidget
            height="600px"
            selectedTruck={activeTruckId}
            onSelectTruck={setSelectedTruck}
            untrackedTrucks={untrackedTrucks}
            deviceLabels={deviceLabels}
            fleetOnly={fleetVisible}
          />
        </div>

        {/* Truck Status Cards on Right */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Fleet Summary</h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {trucks.map((truck) =>
              truck.tracked ? (
                <button
                  key={truck.id}
                  onClick={() => setSelectedTruck(truck.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    activeTruckId === truck.id
                      ? 'bg-blue-50 border-blue-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{truck.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{truck.driver}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(truck.status)}`}>
                      {truck.status.charAt(0).toUpperCase() + truck.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">📍 {truck.location}</p>
                </button>
              ) : (
                // Nothing to select on the map, so this card is not a button.
                <div
                  key={truck.id}
                  className="w-full p-4 rounded-lg border border-dashed border-orange-300 bg-orange-50/40"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{truck.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{truck.driver}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(truck.status)}`}>
                      No GPS
                    </span>
                  </div>
                  <p className="text-xs text-orange-700 flex items-center gap-1">
                    <SatelliteDish className="w-3.5 h-3.5" /> {truck.location}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Recent Trips and Pending Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trips */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Trips</h2>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Party / Truck</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Bill</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Freight</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTrips.map((trip) => (
                  <tr key={trip.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{trip.route}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{trip.distance}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{trip.freight}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(trip.status)}`}>
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Payments */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Pending Payments</h2>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Buyer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((payment, idx) => (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{payment.buyer}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-semibold">{payment.amount}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-red-600">{payment.daysOverdue} days</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
