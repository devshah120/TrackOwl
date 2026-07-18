import { useEffect, useState } from 'react';
import { Users, Truck, Radio, Wallet } from 'lucide-react';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-5 flex items-center gap-4">
    <div className={`p-3 rounded-lg ${accent}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const Breakdown = ({ title, rows }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-5">
    <h3 className="font-semibold text-slate-900 mb-4">{title}</h3>
    <div className="space-y-3">
      {rows.map(([label, value, dot]) => (
        <div key={label} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            {label}
          </div>
          <span className="font-semibold text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  </div>
);

export function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await admin.getStats();
        if (!cancelled) setStats(res.stats);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load platform stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Overview</h1>
            <p className="text-slate-600 mt-1">Platform-wide numbers across every client</p>
          </div>

          {loading && <div className="text-center py-12 text-slate-500">Loading stats...</div>}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {stats && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Clients" value={stats.totalClients} accent="bg-blue-100 text-blue-600" />
                <StatCard icon={Truck} label="Total Trucks" value={stats.totalTrucks} accent="bg-emerald-100 text-emerald-600" />
                <StatCard icon={Radio} label="Tracked Devices" value={stats.totalDevices} accent="bg-sky-100 text-sky-600" />
                <StatCard
                  icon={Wallet}
                  label="Net Ledger"
                  value={`₹${Number(stats.ledger.net).toLocaleString()}`}
                  accent={stats.ledger.net >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Breakdown
                  title="Trucks by Status"
                  rows={[
                    ['Running', stats.trucksByStatus.Running, 'bg-green-500'],
                    ['Idle', stats.trucksByStatus.Idle, 'bg-yellow-500'],
                    ['Stopped', stats.trucksByStatus.Stopped, 'bg-red-500'],
                  ]}
                />
                <Breakdown
                  title="Devices by Status"
                  rows={[
                    ['Moving', stats.devicesByStatus.moving, 'bg-green-500'],
                    ['Idle', stats.devicesByStatus.idle, 'bg-amber-500'],
                    ['Offline', stats.devicesByStatus.offline, 'bg-slate-400'],
                  ]}
                />
                <div className="bg-white rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">Ledger Totals</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total Income</span>
                      <span className="font-semibold text-green-600">₹{Number(stats.ledger.totalIncome).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total Expense</span>
                      <span className="font-semibold text-red-600">₹{Number(stats.ledger.totalExpense).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-slate-900 font-medium">Net</span>
                      <span className={`font-bold ${stats.ledger.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{Number(stats.ledger.net).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
