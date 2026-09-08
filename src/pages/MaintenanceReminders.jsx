import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Settings2, AlertTriangle } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { maintenance as api, fleet } from '../services/api';
import { StatTile, Panel, ReminderRow, EmptyState, Banner } from '../components/maintenance/MaintenanceUI';
import { formatNumber } from '../constants/maintenance';

// M3-M10 — everything due or overdue, worst first.
//
// Services, tyres and batteries in one list rather than three. To whoever reads
// this, an overdue brake service and an illegal tyre are the same job — get the
// vehicle in — and splitting them into three differently-shaped lists would
// hide that.
//
// Nothing here is stored. A service due at 55,000 km becomes overdue the moment
// the vehicle crosses that reading, with nothing happening to the service
// record itself, so the verdicts are computed on read. That is why this page
// has no refresh button: it is never stale.
export function MaintenanceReminders() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();

  const [reminders, setReminders] = useState([]);
  const [counts, setCounts] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    truck: searchParams.get('truck') || '',
    kind: searchParams.get('kind') || '',
    status: searchParams.get('status') || '',
  });

  const [trucks, setTrucks] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.reminders(filters);
      setReminders(res.reminders || []);
      setCounts(res.counts || null);
      setSettings(res.settings || null);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load the reminders');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fleet.list();
        setTrucks(res.trucks || []);
      } catch {
        // The picker is a convenience.
      }
    })();
  }, []);

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const openReminder = (reminder) => {
    if (reminder.kind === 'service') navigate(`/maintenance/services?truck=${reminder.truck || ''}`);
    else if (reminder.kind === 'tyre') navigate(`/maintenance/tyres/${reminder.sourceId}`);
    else navigate(`/maintenance/batteries?truck=${reminder.truck || ''}`);
  };

  // The counts describe the whole account, not the filtered view — they are
  // what the tiles are for, and a tile that changed when a filter moved would
  // stop being a fleet-level figure.
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/maintenance')}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                title="Back to maintenance"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Service Reminders</h1>
                <p className="text-slate-600 mt-1">
                  What is due or overdue across services, tyres and batteries
                </p>
              </div>
            </div>
            {can('maintenance', 'manage') && (
              <button
                onClick={() => navigate('/maintenance/settings')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                <Settings2 className="w-4 h-4" />
                Thresholds
              </button>
            )}
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              label="Overdue"
              value={counts ? counts.overdue : '—'}
              hint="past due date or reading"
              icon={AlertTriangle}
              bg={counts?.overdue ? 'bg-red-50' : 'bg-slate-50'}
              fg={counts?.overdue ? 'text-red-600' : 'text-slate-400'}
              onClick={() => setFilter({ status: filters.status === 'overdue' ? '' : 'overdue' })}
            />
            <StatTile
              label="Due soon"
              value={counts ? counts.due : '—'}
              hint={settings ? `within ${settings.serviceDueDays} days or ${formatNumber(settings.serviceDueKm, { decimals: 0 })} km` : ''}
              icon={CalendarClock}
              bg={counts?.due ? 'bg-amber-50' : 'bg-slate-50'}
              fg={counts?.due ? 'text-amber-600' : 'text-slate-400'}
              onClick={() => setFilter({ status: filters.status === 'due' ? '' : 'due' })}
            />
            <StatTile
              label="Services"
              value={counts ? counts.service : '—'}
              hint="scheduled work due"
              onClick={() => setFilter({ kind: filters.kind === 'service' ? '' : 'service' })}
            />
            <StatTile
              label="Components"
              value={counts ? counts.tyre + counts.battery : '—'}
              hint={counts ? `${counts.tyre} tyre, ${counts.battery} battery` : ''}
              onClick={() => setFilter({ kind: filters.kind === 'tyre' ? '' : 'tyre' })}
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-4">
            <select
              value={filters.truck}
              onChange={(e) => setFilter({ truck: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All vehicles</option>
              {trucks.map((t) => (
                <option key={t._id} value={t._id}>{t.number}</option>
              ))}
            </select>
            <select
              value={filters.kind}
              onChange={(e) => setFilter({ kind: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Everything</option>
              <option value="service">Services</option>
              <option value="tyre">Tyres</option>
              <option value="battery">Batteries</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilter({ status: e.target.value })}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Due and overdue</option>
              <option value="overdue">Overdue only</option>
              <option value="due">Due soon only</option>
            </select>
            {(filters.truck || filters.kind || filters.status) && (
              <button
                onClick={() => setFilter({ truck: '', kind: '', status: '' })}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            )}
          </div>

          <Panel
            title={`${reminders.length} ${reminders.length === 1 ? 'item' : 'items'}`}
            subtitle="Overdue first, then by how soon each falls due"
            className="mb-6"
          >
            {loading && !reminders.length ? (
              <div className="p-10 text-center text-slate-500">Working out what is due…</div>
            ) : !reminders.length ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing is due"
                hint={
                  filters.truck || filters.kind || filters.status
                    ? 'Nothing matches those filters — try clearing them.'
                    : 'Every vehicle is inside its service window, and no tyre or battery needs replacing.'
                }
              />
            ) : (
              <div>
                {reminders.map((reminder) => (
                  <ReminderRow
                    key={`${reminder.kind}-${reminder.sourceId}`}
                    reminder={reminder}
                    onOpen={openReminder}
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
