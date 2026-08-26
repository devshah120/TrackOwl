import { useEffect, useState } from 'react';
import {
  Plus, Edit2, Trash2, X, KeyRound, CheckCircle2, XCircle, ShieldCheck, AlertCircle, Eye, EyeOff,
} from 'lucide-react';
import { users as usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_BADGE_CLASSES, roleLabel,
} from '../constants/roles';

const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function RoleBadge({ role }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_BADGE_CLASSES[role] || 'bg-slate-100 text-slate-700'}`}>
      {roleLabel(role)}
    </span>
  );
}

// A password field that can be revealed — used for both the initial password on
// create and the admin-set reset, where typing a value blind is a good way to
// lock someone out of an account you just made for them.
function PasswordField({ label, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600"
          title={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// Create and edit share one modal: the only differences are the password field
// (set once at creation, changed afterwards through the reset action) and which
// API verb runs on submit.
function UserModal({ existing, onClose, onSaved }) {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState({
    name: existing?.name || '',
    email: existing?.email || '',
    mobile: existing?.mobile || '',
    password: '',
    role: existing?.role || ASSIGNABLE_ROLES[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.mobile.trim()) {
      setError('Name, email and mobile are required');
      return;
    }
    if (!isEdit && form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.replace(/[^0-9]/g, ''),
        role: form.role,
      };
      const res = isEdit
        ? await usersApi.update(existing._id || existing.id, payload)
        : await usersApi.create({ ...payload, password: form.password });
      onSaved(res.user, isEdit);
    } catch (err) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} user`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input name="name" value={form.name} onChange={change} className={inputClass} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" name="email" value={form.email} onChange={change} className={inputClass} placeholder="name@company.com" />
            <p className="mt-1 text-xs text-slate-500">This is what they log in with.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
            <input name="mobile" value={form.mobile} onChange={change} className={inputClass} placeholder="10-digit number" maxLength={10} />
          </div>

          {!isEdit && (
            <>
              <PasswordField
                label="Initial Password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="At least 8 characters"
              />
              <p className="-mt-2 text-xs text-slate-500">
                Share this with them. They can change it later from Forgot Password, and you can reset it from this table.
              </p>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select name="role" value={form.role} onChange={change} className={inputClass}>
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
            <p className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              {ROLE_DESCRIPTIONS[form.role]}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ target, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await usersApi.resetPassword(target._id || target.id, password);
      onDone(res.message);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Reset Password</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Set a new password for <span className="font-medium text-slate-900">{target.name}</span>. Their existing
          sessions keep working until the token expires, so tell them to log in again.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <PasswordField
            label="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// The team roster for one account: the Company Admin plus every seat they have
// added. Rendered by the Settings page's User Management tab.
//
// A staff seat with `users:read` can open this and see who their colleagues
// are; only the account owner gets the action buttons, matching what the API
// allows.
export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { isAccountOwner } = usePermissions();

  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [editing, setEditing] = useState(null);   // user row, or 'new'
  const [resetting, setResetting] = useState(null);

  const load = async () => {
    try {
      const res = await usersApi.list();
      setTeam(res.users || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Success banners are transient — the table itself is the durable record of
  // what happened.
  const flash = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 4000);
  };

  const toggleActive = async (row) => {
    const id = row._id || row.id;
    setBusyId(id);
    try {
      const res = await usersApi.setStatus(id, !row.isActive);
      setTeam((prev) => prev.map((u) => ((u._id || u.id) === id ? { ...u, ...res.user } : u)));
      flash(res.message);
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row) => {
    const id = row._id || row.id;
    if (!confirm(`Remove ${row.name}? They lose access immediately. Trucks, trips and ledger entries they created stay with the account.`)) return;
    setBusyId(id);
    try {
      const res = await usersApi.remove(id);
      setTeam((prev) => prev.filter((u) => (u._id || u.id) !== id));
      flash(res.message);
    } catch (err) {
      setError(err.message || 'Failed to remove user');
    } finally {
      setBusyId(null);
    }
  };

  const onSaved = (saved, wasEdit) => {
    setTeam((prev) =>
      wasEdit
        ? prev.map((u) => ((u._id || u.id) === (saved._id || saved.id) ? { ...u, ...saved } : u))
        : [...prev, saved]
    );
    setEditing(null);
    flash(wasEdit ? 'User updated' : `${saved.name} added as ${roleLabel(saved.role)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-600 mt-1">
            Everyone who can log into this account. Each seat sees the same fleet and books — their role decides what
            they may change.
          </p>
        </div>
        {isAccountOwner && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4" />
          {notice}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading && <div className="py-12 text-center text-slate-500">Loading users...</div>}

      {!loading && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Contact</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Added</th>
                  {isAccountOwner && (
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {team.map((row) => {
                  const id = row._id || row.id;
                  const isSelf = id === (currentUser?._id || currentUser?.id);
                  // The owner's row is their login profile: edited under Company
                  // Details, and never deactivated or removed from here.
                  const locked = row.isAccountOwner;

                  return (
                    <tr key={id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{row.name}</span>
                          {locked && (
                            <span className="flex items-center gap-1 text-xs text-slate-500" title="Account owner">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Owner
                            </span>
                          )}
                          {isSelf && !locked && <span className="text-xs text-slate-500">(you)</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="text-slate-700">{row.email}</p>
                        <p className="text-xs text-slate-500">{row.mobile}</p>
                      </td>
                      <td className="px-6 py-4 text-sm"><RoleBadge role={row.role} /></td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          row.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {row.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{formatDate(row.createdAt)}</td>

                      {isAccountOwner && (
                        <td className="px-6 py-4 text-sm">
                          {locked ? (
                            <span className="text-xs text-slate-400">Manage under Company Details</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleActive(row)}
                                disabled={busyId === id}
                                title={row.isActive ? 'Deactivate' : 'Activate'}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                                  row.isActive
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                                }`}
                              >
                                {row.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                {row.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button onClick={() => setEditing(row)} title="Edit user"
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setResetting(row)} title="Reset password"
                                className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors">
                                <KeyRound className="w-4 h-4" />
                              </button>
                              <button onClick={() => remove(row)} disabled={busyId === id} title="Remove user"
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors disabled:opacity-50">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {team.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500">No users yet.</p>
          )}
        </div>
      )}

      {!isAccountOwner && !loading && (
        <p className="text-xs text-slate-500">
          Only a Company Admin can add or change users. You are seeing this list read-only.
        </p>
      )}

      {editing && (
        <UserModal
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          target={resetting}
          onClose={() => setResetting(null)}
          onDone={(message) => { setResetting(null); flash(message); }}
        />
      )}
    </div>
  );
}
