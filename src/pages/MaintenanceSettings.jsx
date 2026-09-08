import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw, Info } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { maintenance as api } from '../services/api';
import { Panel, Banner } from '../components/maintenance/MaintenanceUI';
import { DEFAULT_SETTINGS } from '../constants/maintenance';

// M3-M10 — the reminder thresholds.
//
// One row per account, created the first time this is saved. An account that
// never visits this screen is not misconfigured: it uses the shipped defaults,
// so reminders work on day one.
//
// Unlike the fuel thresholds, these need no recompute after a save. Reminders
// are computed on read, so a changed window applies to the whole fleet the
// moment it is stored — which is why this page says so rather than offering a
// recompute button that would do nothing.
const FIELDS = [
  {
    group: 'Service reminders',
    items: [
      {
        key: 'serviceDueDays',
        label: 'Warn this many days ahead',
        min: 1,
        max: 365,
        step: 1,
        suffix: 'days',
        hint: 'How far in advance a date-based service starts showing as due. Long enough to find a workshop slot, short enough that the warning does not become furniture.',
      },
      {
        key: 'serviceDueKm',
        label: 'Warn this many kilometres ahead',
        min: 50,
        max: 50000,
        step: 50,
        suffix: 'km',
        hint: 'The same for distance-based services. A truck covering 300 km a day crosses 1,000 km in three days.',
      },
      {
        key: 'overdueGraceDays',
        label: 'Stop counting overdue after',
        min: 1,
        max: 730,
        step: 1,
        suffix: 'days',
        hint: 'A service this far past due has been abandoned rather than forgotten — usually the vehicle was serviced and the record never made. It stays on the record either way; this only decides what the dashboard counts.',
      },
    ],
  },
  {
    group: 'Tyres and batteries',
    items: [
      {
        key: 'tyreMinTreadMm',
        label: 'Replace tyres at',
        min: 1.6,
        max: 10,
        step: 0.1,
        suffix: 'mm',
        hint: 'Tread depth at which a fitted tyre is called due. The common legal minimum is 1.6mm, so warning above it leaves time to act.',
      },
      {
        key: 'batteryLifeMonths',
        label: 'Expected battery life',
        min: 6,
        max: 120,
        step: 1,
        suffix: 'months',
        hint: 'Age at which a battery is flagged regardless of how it is testing. A battery with its own replacement date set uses that instead.',
      },
      {
        key: 'warrantyWarnDays',
        label: 'Warn before warranty ends',
        min: 1,
        max: 180,
        step: 1,
        suffix: 'days',
        hint: 'A failing battery still inside warranty is a claim, not a purchase — but only if somebody knew the date was coming.',
      },
    ],
  },
];

export function MaintenanceSettings() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isDefault, setIsDefault] = useState(true);
  const [defaults, setDefaults] = useState(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSettings();
        setSettings(res.settings || DEFAULT_SETTINGS);
        setIsDefault(Boolean(res.isDefault));
        setDefaults(res.defaults || DEFAULT_SETTINGS);
      } catch (err) {
        setError(err.message || 'Failed to load the reminder thresholds');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.saveSettings(settings);
      setSettings(res.settings || settings);
      setIsDefault(false);
      setNotice(res.message || 'Reminder thresholds saved.');
    } catch (err) {
      setError(err.message || 'Could not save the thresholds');
    } finally {
      setSaving(false);
    }
  };

  // Puts the shipped values back in the form. Not saved until the user says so
  // — a reset that wrote immediately would be a destructive button with no
  // confirmation.
  const restoreDefaults = () => {
    setSettings(defaults);
    setNotice('Shipped defaults loaded — save to apply them.');
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <Topbar />
        <main className="flex-1 flex items-center justify-center text-slate-500">
          Loading the reminder thresholds…
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      <main className="flex-1 overflow-y-auto">
        <form onSubmit={save} className="p-6 w-full max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/maintenance')}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Reminder Thresholds</h1>
                <p className="text-slate-600 mt-1">
                  When a service, tyre or battery starts asking for attention
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={restoreDefaults}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              <RotateCcw className="w-4 h-4" />
              Restore defaults
            </button>
          </div>

          <Banner tone="error" message={error} onDismiss={() => setError('')} />
          <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

          {isDefault && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-900">
                This account is using the shipped defaults. Reminders already work — save here only
                if this fleet runs to a different schedule.
              </p>
            </div>
          )}

          {FIELDS.map(({ group, items }) => (
            <Panel key={group} title={group}>
              <div className="p-4 space-y-5">
                {items.map(({ key, label, min, max, step, suffix, hint }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between gap-4">
                      <label htmlFor={key} className="text-sm font-medium text-slate-700">
                        {label}
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          id={key}
                          type="number"
                          min={min} max={max} step={step}
                          value={settings[key] ?? ''}
                          onChange={(e) =>
                            set(key, e.target.value === '' ? '' : Number(e.target.value))
                          }
                          className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-500 w-16">{suffix}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pr-40">{hint}</p>
                    {/* The shipped value, so a changed setting is visibly a
                        choice rather than something that drifted. */}
                    {settings[key] !== defaults[key] && (
                      <p className="text-xs text-blue-600 mt-1">
                        default is {defaults[key]} {suffix}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          ))}

          <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600">
              These apply immediately across the whole fleet. Reminders are worked out as they are
              read rather than stored, so nothing needs recomputing after a change.
            </p>
          </div>

          <div className="flex justify-end gap-2 pb-6">
            <button
              type="button"
              onClick={() => navigate('/maintenance')}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save thresholds'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
