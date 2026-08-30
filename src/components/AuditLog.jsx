import { useEffect, useMemo, useState } from 'react';
import {
  History, Search, Filter, Download, ChevronDown, ChevronRight, ChevronLeft,
  AlertCircle, RotateCcw, ArrowRight, X, Monitor,
} from 'lucide-react';
import { audit as auditApi, admin as adminApi } from '../services/api';
import { roleLabel } from '../constants/roles';

const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

// How each action is coloured in the list. Read at a glance: green for things
// that appeared, amber for things that changed, red for things that went away
// or were refused, slate for the rest.
const ACTION_STYLES = {
  create: 'bg-emerald-100 text-emerald-800',
  update: 'bg-amber-100 text-amber-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-slate-100 text-slate-700',
  logout: 'bg-slate-100 text-slate-700',
  login_failed: 'bg-red-100 text-red-800',
  password_change: 'bg-violet-100 text-violet-800',
  password_reset: 'bg-violet-100 text-violet-800',
  activate: 'bg-emerald-100 text-emerald-800',
  deactivate: 'bg-red-100 text-red-800',
  permission_change: 'bg-blue-100 text-blue-800',
  permission_reset: 'bg-blue-100 text-blue-800',
};

const ACTION_LABELS = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  login: 'Signed in',
  logout: 'Signed out',
  login_failed: 'Failed sign-in',
  password_change: 'Password changed',
  password_reset: 'Password reset',
  activate: 'Activated',
  deactivate: 'Deactivated',
  permission_change: 'Permissions changed',
  permission_reset: 'Permissions reset',
};

// Full date and time, because "who changed this and when" is the question and a
// relative "2 days ago" cannot be cross-referenced against anything.
const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

// Just enough for the "when" column to stay narrow; the full stamp is in the
// row's title attribute and in the expanded detail.
const formatShort = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

// Renders one stored value. The server has already reduced these to strings,
// numbers, booleans or small objects, so this only has to make them readable —
// notably turning the empty ones into something visible, since "was blank" is
// itself information the reader needs.
function Value({ value, tone }) {
  const base = 'px-2 py-0.5 rounded text-xs font-mono break-all';
  const styles =
    tone === 'from' ? 'bg-red-50 text-red-900 line-through decoration-red-300' : 'bg-emerald-50 text-emerald-900';

  if (value === null || value === undefined || value === '') {
    return <span className={`${base} bg-slate-100 text-slate-500 italic`}>empty</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={`${base} ${styles}`}>{value ? 'Yes' : 'No'}</span>;
  }
  if (typeof value === 'object') {
    // A small object (a bank block, an address) — one key per line beats a
    // wall of JSON braces.
    return (
      <span className={`${base} ${styles} inline-block`}>
        {Object.entries(value).map(([k, v]) => (
          <span key={k} className="block">
            {k}: {String(v)}
          </span>
        ))}
      </span>
    );
  }
  return <span className={`${base} ${styles}`}>{String(value)}</span>;
}

// The old → new table for one entry. This is the part of the log that answers
// "what actually changed", so it gets the room rather than being squeezed into
// the row.
function ChangeTable({ changes }) {
  if (!changes?.length) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-1/4">
              Field
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Previous value
            </th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              New value
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {changes.map((change, i) => (
            <tr key={`${change.field}-${i}`}>
              <td className="px-4 py-2 align-top font-medium text-slate-900">
                {change.label || change.field}
              </td>
              <td className="px-4 py-2 align-top">
                <Value value={change.from} tone="from" />
              </td>
              <td className="px-4 py-2 align-top">
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-slate-400" />
                  <Value value={change.to} tone="to" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One row, collapsed to a summary and expandable to its field-level diff. Rows
// start collapsed because the common use is scanning for the change you are
// looking for, not reading every diff on the page.
function EntryRow({ entry }) {
  const [open, setOpen] = useState(false);
  const hasDetail = entry.changes?.length > 0 || entry.ipAddress;

  return (
    <>
      <tr
        className={`transition-colors hover:bg-slate-50 ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        <td className="px-4 py-3 align-top">
          <div className="flex items-start gap-2">
            {hasDetail ? (
              open ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              )
            ) : (
              <span className="w-4" />
            )}
            <span
              className="whitespace-nowrap text-sm text-slate-600"
              title={formatDateTime(entry.createdAt)}
            >
              {formatShort(entry.createdAt)}
            </span>
          </div>
        </td>

        <td className="px-4 py-3 align-top">
          <p className="text-sm font-medium text-slate-900">{entry.actorName || 'System'}</p>
          <p className="text-xs text-slate-500">
            {entry.actorRole ? roleLabel(entry.actorRole) : entry.actorEmail || '—'}
          </p>
        </td>

        <td className="px-4 py-3 align-top">
          <span
            className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
              ACTION_STYLES[entry.action] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {ACTION_LABELS[entry.action] || entry.action}
          </span>
        </td>

        <td className="px-4 py-3 align-top">
          <p className="text-sm text-slate-900">{entry.summary}</p>
          {/* The count is the cue that there is a diff worth opening. */}
          {entry.changes?.length > 0 && !open && (
            <p className="mt-0.5 text-xs text-slate-500">
              {entry.changes.length} field{entry.changes.length === 1 ? '' : 's'} changed — click to
              see old and new values
            </p>
          )}
        </td>
      </tr>

      {open && hasDetail && (
        <tr className="bg-slate-50">
          <td colSpan={4} className="px-4 pb-4 pt-1">
            <div className="space-y-3 pl-6">
              <ChangeTable changes={entry.changes} />

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                <span>{formatDateTime(entry.createdAt)}</span>
                {entry.actorEmail && <span>{entry.actorEmail}</span>}
                {entry.ipAddress && (
                  <span className="flex items-center gap-1">
                    <Monitor className="h-3 w-3" />
                    {entry.ipAddress}
                  </span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// The audit trail view. Used in two places with the same code:
//   Settings → Audit Log   — the account's own activity (default)
//   Admin → Audit Log      — every account's, with `platform` set
//
// They differ only in which endpoint feeds the list, so the filtering, paging,
// expansion and export behaviour cannot drift apart between them.
export function AuditLog({ platform = false }) {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // `search` is what the box holds right now; `applied` is what the last
  // request actually used. Kept apart so typing does not fire a request per
  // keystroke — the debounce below promotes one to the other.
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ entity: '', action: '', actor: '', from: '', to: '' });
  const [appliedSearch, setAppliedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const limit = 50;

  // 400ms after the last keystroke. Long enough that a typed word is one
  // request rather than five, short enough not to feel laggy.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(
    () => ({ ...filters, search: appliedSearch, page, limit }),
    [filters, appliedSearch, page]
  );

  // Fetches the current page. `cancelled` guards the state writes: changing a
  // filter starts a new request before the old one lands, and without this the
  // slower of the two would overwrite the newer results.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const response = platform ? await adminApi.auditLog(query) : await auditApi.list(query);
        if (cancelled) return;
        setEntries(response.entries || []);
        setTotal(response.total || 0);
        setHasMore(Boolean(response.hasMore));
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Could not load the audit log');
        setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platform, query]);

  // The filter vocabularies and the headline counts describe the whole trail
  // rather than the current page, so they are fetched once instead of with
  // every filter change. The account view owns both endpoints; the platform
  // view runs without them rather than showing another account's totals.
  useEffect(() => {
    if (platform) return;
    auditApi.options().then((r) => setOptions(r.options)).catch(() => setOptions(null));
    auditApi.stats().then((r) => setStats(r.stats)).catch(() => setStats(null));
  }, [platform]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ entity: '', action: '', actor: '', from: '', to: '' });
    setSearch('');
    setPage(1);
  };

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (appliedSearch ? 1 : 0);

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      // Exports what is on screen, filters and all — but every page of it, so
      // page and limit are deliberately left out of the query.
      await auditApi.exportCsv({ ...filters, search: appliedSearch });
    } catch (err) {
      setError(err.message || 'Could not export the audit log');
    } finally {
      setExporting(false);
    }
  };

  const firstRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastRow = (page - 1) * limit + entries.length;

  return (
    <div className="space-y-4">
      {/* Heading. The admin page supplies its own page-level title, so the
          component only titles itself when it is embedded in Settings. */}
      {!platform && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <History className="h-5 w-5 text-blue-600" />
              Audit Log
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Who changed what, the old and new value, and when. Records cannot be edited or
              removed.
            </p>
          </div>

          <button
            onClick={exportCsv}
            disabled={exporting || total === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Headline counts. Account view only — see the fetch above. */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total records', value: stats.total },
            { label: 'Last 24 hours', value: stats.today },
            { label: 'Last 7 days', value: stats.week },
            { label: 'People active', value: options?.actors?.length ?? '—' },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{tile.label}</p>
              <p className="mt-0.5 text-xl font-semibold text-slate-900">
                {typeof tile.value === 'number' ? tile.value.toLocaleString('en-IN') : tile.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Search and filters */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by record, person or description…"
              className={`${inputClass} pl-9`}
            />
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              activeFilterCount
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Area</label>
              <select
                value={filters.entity}
                onChange={(e) => setFilter('entity', e.target.value)}
                className={inputClass}
              >
                <option value="">All areas</option>
                {(options?.entities || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilter('action', e.target.value)}
                className={inputClass}
              >
                <option value="">All actions</option>
                {(options?.actions || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Person</label>
              <select
                value={filters.actor}
                onChange={(e) => setFilter('actor', e.target.value)}
                className={inputClass}
              >
                <option value="">Everyone</option>
                {(options?.actors || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.removed ? ' (removed)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilter('from', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilter('to', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {/* The trail */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading the audit log…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <History className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-900">
              {activeFilterCount ? 'Nothing matches those filters' : 'No activity recorded yet'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {activeFilterCount
                ? 'Try widening the date range or clearing a filter.'
                : 'Changes to trucks, trips, drivers, the ledger and your team will appear here.'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    When
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Who
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    What changed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <EntryRow key={entry._id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paging. Shown whenever there is more than one page's worth, so the
            reader is never left wondering whether the list stops here. */}
        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-600">
              Showing {firstRow.toLocaleString('en-IN')}–{lastRow.toLocaleString('en-IN')} of{' '}
              {total.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
