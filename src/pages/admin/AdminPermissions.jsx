import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Lock, RotateCcw, Save, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Topbar } from '../../components/Topbar';
import { admin } from '../../services/api';

// Column and row labels. The server sends the raw resource/action names; these
// turn them into something an operator reads rather than decodes.
const RESOURCE_LABELS = {
  users: 'Users',
  company: 'Company',
  trucks: 'Trucks',
  drivers: 'Drivers',
  trips: 'Trips',
  billing: 'Billing',
  ledger: 'Ledger',
  tracking: 'Tracking',
  reports: 'Reports',
};

const RESOURCE_HINTS = {
  users: 'The team roster under Settings',
  company: 'Company master, logo and signature',
  trucks: 'Vehicles in the fleet',
  drivers: 'Driver records attached to trucks',
  trips: 'Planned trips and live routes',
  billing: 'Lorry receipts and invoices',
  ledger: 'Income and expense entries',
  tracking: 'Devices, positions and share links',
  reports: 'Generated reports',
};

const ACTION_LABELS = { read: 'View', create: 'Add', update: 'Edit', delete: 'Delete' };

// A role's stored grants can use wildcards ('trucks:*', '*:read'). The grid
// works in concrete ticks, so a role is expanded on load and re-collapsed on
// save — otherwise every edit would silently rewrite a compact 'trucks:*' into
// four separate lines, and a later default-comparison would call it customised.
const expand = (grants, resources, actions) => {
  const set = new Set();
  grants.forEach((grant) => {
    const [r, a] = grant.split(':');
    const rs = r === '*' ? resources : [r];
    const as = a === '*' || a === 'manage' ? actions : [a];
    rs.forEach((res) => as.forEach((act) => set.add(`${res}:${act}`)));
  });
  return set;
};

// Collapses a tick set back to the shortest equivalent grant list: a resource
// with every action becomes 'resource:*', and every resource fully ticked
// becomes '*:*'.
const collapse = (ticks, resources, actions) => {
  const full = resources.every((r) => actions.every((a) => ticks.has(`${r}:${a}`)));
  if (full) return ['*:*'];

  const out = [];
  resources.forEach((r) => {
    const held = actions.filter((a) => ticks.has(`${r}:${a}`));
    if (!held.length) return;
    if (held.length === actions.length) out.push(`${r}:*`);
    else held.forEach((a) => out.push(`${r}:${a}`));
  });
  return out;
};

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

function LockedRoleCard({ entry }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-slate-500" />
        <span className="font-medium text-slate-900">{entry.label}</span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Fixed in code — full access. Locked so a permission change can never leave nobody able to
        reach this page.
      </p>
    </div>
  );
}

export function AdminPermissions() {
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingRole, setSavingRole] = useState(null);
  // Which role's grid is on screen. Only one is shown at a time — four stacked
  // tables was a lot of scrolling to compare two ticks.
  const [selectedRole, setSelectedRole] = useState('');

  // Working copy: role -> Set of "resource:action" ticks. Edited in place and
  // compared against `baseline` to decide which rows have unsaved changes.
  const [draft, setDraft] = useState({});
  const [baseline, setBaseline] = useState({});

  const load = async () => {
    try {
      const res = await admin.getPermissions();
      const m = res.matrix;
      const next = {};
      m.roles.forEach((r) => {
        next[r.role] = expand(r.grants, m.resources, m.actions);
      });
      setMatrix(m);
      setSelectedRole((prev) => prev || m.roles[0]?.role || '');
      setDraft(next);
      setBaseline(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, new Set(v)])));
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 4000);
  };

  const toggle = (role, resource, action) => {
    const key = `${resource}:${action}`;
    setDraft((prev) => {
      const next = new Set(prev[role]);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Every other action implies being able to see the thing you are
        // changing, so ticking Add/Edit/Delete ticks View with it. Without this
        // a role could hold trucks:update and get a 403 listing trucks.
        if (action !== 'read') next.add(`${resource}:read`);
      }
      // Conversely, removing View removes the rest — leaving write-without-read
      // would be a grant that cannot be exercised.
      if (action === 'read' && !next.has(key)) {
        matrix.actions.forEach((a) => next.delete(`${resource}:${a}`));
      }
      return { ...prev, [role]: next };
    });
  };

  // Ticks or clears an entire resource column for one role.
  const toggleResource = (role, resource) => {
    setDraft((prev) => {
      const next = new Set(prev[role]);
      const all = matrix.actions.every((a) => next.has(`${resource}:${a}`));
      matrix.actions.forEach((a) => (all ? next.delete(`${resource}:${a}`) : next.add(`${resource}:${a}`)));
      return { ...prev, [role]: next };
    });
  };

  const save = async (role) => {
    setSavingRole(role);
    try {
      const grants = collapse(draft[role], matrix.resources, matrix.actions);
      const res = await admin.savePermissions(role, grants);
      setBaseline((prev) => ({ ...prev, [role]: new Set(draft[role]) }));
      flash(res.message);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to save permissions');
    } finally {
      setSavingRole(null);
    }
  };

  const reset = async (role) => {
    if (!confirm(`Reset ${matrix.roles.find((r) => r.role === role)?.label} to the shipped defaults?`)) return;
    setSavingRole(role);
    try {
      const res = await admin.resetPermissions(role);
      const restored = expand(res.role.grants, matrix.resources, matrix.actions);
      setDraft((prev) => ({ ...prev, [role]: restored }));
      setBaseline((prev) => ({ ...prev, [role]: new Set(restored) }));
      flash(res.message);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to reset permissions');
    } finally {
      setSavingRole(null);
    }
  };

  const dirtyRoles = useMemo(() => {
    if (!matrix) return new Set();
    return new Set(
      matrix.roles
        .map((r) => r.role)
        .filter((role) => draft[role] && baseline[role] && !sameSet(draft[role], baseline[role]))
    );
  }, [draft, baseline, matrix]);

  // Switching away from a role with unsaved ticks would lose them silently, so
  // ask first and roll the draft back to its last saved state on discard.
  const selectRole = (role) => {
    if (role === selectedRole) return;
    if (dirtyRoles.has(selectedRole)) {
      const label = matrix?.roles.find((r) => r.role === selectedRole)?.label || selectedRole;
      if (!confirm(`Discard unsaved changes to ${label}?`)) return;
      setDraft((prev) => ({ ...prev, [selectedRole]: new Set(baseline[selectedRole]) }));
    }
    setSelectedRole(role);
  };

  const activeRow = matrix?.roles.find((r) => r.role === selectedRole) || null;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 p-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
              <ShieldCheck className="h-7 w-7 text-blue-600" />
              Roles &amp; Permissions
            </h1>
            <p className="mt-1 text-slate-600">
              What each staff role may do. This is platform-wide — a change here applies to every
              client account immediately.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Users pick up a change the next time their browser loads the app. Ticking Add, Edit or
              Delete automatically grants View, since nothing can be changed that cannot be seen.
            </p>
          </div>

          {notice && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {notice}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading && <div className="py-12 text-center text-slate-500">Loading permissions...</div>}

          {!loading && matrix && (
            <>
              {activeRow && (() => {
                const role = activeRow.role;
                const ticks = draft[role] || new Set();
                const isDirty = dirtyRoles.has(role);

                return (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
                      <div>
                        <label
                          htmlFor="role-select"
                          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Editing role
                        </label>
                        <div className="flex items-center gap-3">
                          <select
                            id="role-select"
                            value={role}
                            onChange={(e) => selectRole(e.target.value)}
                            className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {matrix.roles.map((r) => (
                              <option key={r.role} value={r.role}>
                                {r.label}
                                {dirtyRoles.has(r.role) ? ' •' : ''}
                              </option>
                            ))}
                          </select>

                          {isDirty && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              Unsaved changes
                            </span>
                          )}
                          {!isDirty && activeRow.isCustomised && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              Customised
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {ticks.size} permission{ticks.size === 1 ? '' : 's'} granted
                          {/* A dot beside a name in the dropdown marks another role
                              left with unsaved ticks, so switching is never a
                              silent loss. */}
                          {dirtyRoles.size > (isDirty ? 1 : 0) && ' · other roles have unsaved changes'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => reset(role)}
                          disabled={savingRole === role}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset to defaults
                        </button>
                        <button
                          onClick={() => save(role)}
                          disabled={!isDirty || savingRole === role}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {savingRole === role ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Area
                            </th>
                            {matrix.actions.map((action) => (
                              <th
                                key={action}
                                className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                              >
                                {ACTION_LABELS[action] || action}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                              All
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {matrix.resources.map((resource) => {
                            const allTicked = matrix.actions.every((a) => ticks.has(`${resource}:${a}`));
                            return (
                              <tr key={resource} className="transition-colors hover:bg-slate-50">
                                <td className="px-6 py-3">
                                  <p className="text-sm font-medium text-slate-900">
                                    {RESOURCE_LABELS[resource] || resource}
                                  </p>
                                  <p className="text-xs text-slate-500">{RESOURCE_HINTS[resource]}</p>
                                </td>
                                {matrix.actions.map((action) => (
                                  <td key={action} className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={ticks.has(`${resource}:${action}`)}
                                      onChange={() => toggle(role, resource, action)}
                                      aria-label={`${activeRow.label}: ${ACTION_LABELS[action] || action} ${RESOURCE_LABELS[resource] || resource}`}
                                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => toggleResource(role, resource)}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    {allTicked ? 'Clear' : 'All'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Fixed roles
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {matrix.locked.map((entry) => (
                    <LockedRoleCard key={entry.role} entry={entry} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
