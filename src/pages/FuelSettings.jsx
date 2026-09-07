import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { usePermissions } from '../hooks/usePermissions';
import { fuel as fuelApi, fleet } from '../services/api';
import { BASELINE_MODE_LABELS, DEFAULT_SETTINGS } from '../constants/fuel';

// M3-F06 — the configurable thresholds behind abnormal-efficiency flagging.
//
// The defaults are deliberately quiet on a normal fleet: a 20% swing either
// side of a vehicle's own average is wide enough that ordinary load and traffic
// variation does not trip it, and narrow enough to catch a mis-keyed odometer
// or a siphoned tank. An account that has never opened this screen is still
// flagging correctly.
export function FuelSettings() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const readOnly = !can('fuel', 'manage');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isDefault, setIsDefault] = useState(true);
  const [trucks, setTrucks] = useState([]);
  const [recomputeTruck, setRecomputeTruck] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, truckRes] = await Promise.all([
          fuelApi.getSettings(),
          fleet.list().catch(() => ({ trucks: [] })),
        ]);
        setSettings(settingsRes.settings || DEFAULT_SETTINGS);
        setIsDefault(Boolean(settingsRes.isDefault));
        setTrucks(truckRes.trucks || []);
      } catch (err) {
        setError(err.message || 'Failed to load fuel settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fuelApi.saveSettings(settings);
      setSettings(res.settings || settings);
      setIsDefault(false);
      setNotice(res.message || 'Thresholds saved.');
    } catch (err) {
      setError(err.message || 'Failed to save the thresholds');
    } finally {
      setSaving(false);
    }
  };

  const recompute = async () => {
    if (!recomputeTruck) return;
    setRecomputing(true);
    setError('');
    try {
      const res = await fuelApi.recompute(recomputeTruck);
      setNotice(res.message || 'Recomputed.');
    } catch (err) {
      setError(err.message || 'Failed to recompute that vehicle');
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <div className="flex-1 flex items-center justify-center text-slate-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/fuel')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Fuel Thresholds</h1>
              <p className="text-slate-600 mt-1">
                When a filling should be flagged as abnormal
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3">
              {notice}
            </div>
          )}

          {isDefault && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 flex gap-3">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                These are the shipped defaults. Flagging is already working — saving here only
                changes the thresholds it uses.
              </p>
            </div>
          )}

          <form onSubmit={save} className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Baseline</h2>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Compare mileage against
                </label>
                <select
                  value={settings.baselineMode} disabled={readOnly}
                  onChange={(e) => set({ baselineMode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  {Object.entries(BASELINE_MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  A vehicle's own history is the fairer test — a loaded tipper and an empty van have
                  no business being compared. A vehicle too new to have a history falls back to the
                  fleet average automatically.
                </p>
              </div>

              <NumberField
                label="Minimum samples before judging" value={settings.minSamples}
                onChange={(v) => set({ minSamples: v })} min={2} max={50} readOnly={readOnly}
                hint="How many measured fillings a vehicle needs before it is flagged at all. Below this the baseline is one or two numbers and flagging on it is noise."
              />

              <NumberField
                label="Baseline window (days)" value={settings.baselineWindowDays}
                onChange={(v) => set({ baselineWindowDays: v })} min={7} max={1095} readOnly={readOnly}
                hint="How far back the average looks. A mileage average reaching back years describes a different vehicle."
              />
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Efficiency thresholds</h2>

              <NumberField
                label="Flag when mileage is this % below the baseline" value={settings.lowEfficiencyPct}
                onChange={(v) => set({ lowEfficiencyPct: v })} min={1} max={90} readOnly={readOnly}
                hint="The main check: a vehicle burning materially more fuel per kilometre than it usually does."
              />

              <NumberField
                label="Flag when mileage is this % above the baseline" value={settings.highEfficiencyPct}
                onChange={(v) => set({ highEfficiencyPct: v })} min={1} max={500} readOnly={readOnly}
                hint="Implausibly good mileage is the usual signature of a data-entry error, and an unflagged one quietly drags the vehicle's own baseline off for months."
              />
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Data-entry checks</h2>

              <NumberField
                label="Flag a rate this % away from the recent typical price" value={settings.rateOutlierPct}
                onChange={(v) => set({ rateOutlierPct: v })} min={1} max={200} readOnly={readOnly}
                hint="Compared against the account's own recent purchases of the same fuel, since pump prices move with the market."
              />

              <NumberField
                label="Flag a single filling above this many units" value={settings.maxQuantityPerFill}
                onChange={(v) => set({ maxQuantityPerFill: v })} min={1} max={100000} readOnly={readOnly}
                hint="Set generously — a twin-tank tractor unit legitimately takes several hundred litres. This only exists to catch a slipped decimal point."
              />
            </div>

            {!readOnly && (
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button" onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to defaults
                </button>
                <button
                  type="submit" disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save thresholds'}
                </button>
              </div>
            )}
          </form>

          {/* Applying new thresholds to history is deliberately a separate,
              explicit act — see the note in routes/fuel.js. */}
          {!readOnly && (
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-slate-400" />
                Apply to existing entries
              </h2>
              <p className="text-sm text-slate-600">
                Saving thresholds does not re-judge history — that could touch every entry the
                account has ever recorded. Recompute one vehicle at a time to re-measure its
                mileage and re-apply the current thresholds to its fillings.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={recomputeTruck} onChange={(e) => setRecomputeTruck(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a vehicle</option>
                  {trucks.map((t) => <option key={t._id} value={t._id}>{t.number}</option>)}
                </select>
                <button
                  type="button" onClick={recompute} disabled={!recomputeTruck || recomputing}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`} />
                  {recomputing ? 'Recomputing…' : 'Recompute'}
                </button>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                Entries whose flags have already been reviewed keep that review — recomputing will
                not re-raise a flag someone has looked into.
              </p>
            </div>
          )}

          {readOnly && (
            <p className="text-sm text-slate-500">
              You can view these thresholds but not change them.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, hint, readOnly }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="number" value={value} min={min} max={max} disabled={readOnly}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
