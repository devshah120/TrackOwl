import { useState, useEffect } from 'react';
import { TrendingUp, Truck, AlertCircle, Check } from 'lucide-react';
import { FleetMapWidget } from '../components/FleetMapWidget';
import { fleet, ledger, billing, tracking } from '../services/api';

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fleetRes, ledgerRes, billingRes] = await Promise.all([
          fleet.list(),
          ledger.list(),
          billing.list(),
        ]);
        if (cancelled) return;
        setTrucksData(fleetRes.trucks);
        setLedgerData(ledgerRes.entries);
        setBillingData(billingRes.billingTrips);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
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
        setSelectedTruck((prev) => prev || res.devices?.[0]?.id || res.devices?.[0]?._id || '');
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
  const activeTruckCount = trucksData.filter((t) => t.status === 'Running').length;

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

  // Same live devices Live Tracking shows, so the dashboard summary and the
  // full map never disagree about which vehicles exist or where they are.
  const trucks = devices.map((d) => ({
    id: d.id || d._id,
    name: d.name,
    status: d.status,
    location: d.lastPosition?.latitude ? `${Math.round(d.lastPosition.speed || 0)} km/h` : 'No position yet',
    driver: timeAgo(d.lastSeenAt),
  }));

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'moving':
        return 'bg-blue-100 text-blue-800';
      case 'idle':
        return 'bg-yellow-100 text-yellow-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'Running':
        return 'bg-green-100 text-green-800';
      case 'Idle':
        return 'bg-yellow-100 text-yellow-800';
      case 'Stopped':
        return 'bg-red-100 text-red-800';
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
          <FleetMapWidget height="600px" selectedTruck={selectedTruck} onSelectTruck={setSelectedTruck} />
        </div>

        {/* Truck Status Cards on Right */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Fleet Summary</h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {trucks.map((truck) => (
              <button
                key={truck.id}
                onClick={() => setSelectedTruck(truck.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedTruck === truck.id
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
            ))}
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
