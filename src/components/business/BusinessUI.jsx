import { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Topbar } from '../Topbar';
import { RANGE_PRESETS, rangePreset } from './helpers';

// Layout and controls shared by the business screens. The stat tile, panel,
// empty state and banner are the maintenance module's own, re-exported so the
// whole app keeps one set.
export { StatTile, Panel, EmptyState, Banner } from '../maintenance/MaintenanceUI';

// Topbar + scrolling main, the frame every standalone page in the app uses.
export function PageShell({ children }) {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 w-full space-y-6">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-slate-600 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

export function Pill({ className = 'bg-slate-100 text-slate-700', children, title }) {
  return (
    <span title={title} className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

// A primary/secondary button that also shows a spinner while `busy`, and is
// disabled then — the guard against a double-click submitting twice.
export function Button({ children, onClick, busy = false, disabled = false, variant = 'primary', icon: Icon, type = 'button', className = '' }) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    danger: 'bg-white border border-red-200 text-red-700 hover:bg-red-50',
    success: 'bg-green-600 text-white hover:bg-green-700',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}

// A centred dialog. Closes on Escape and on the backdrop.
export function Modal({ open, title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onMouseDown={onClose}>
      <div
        className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} rounded-t-xl sm:rounded-xl shadow-xl max-h-[92vh] flex flex-col`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer ? <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2 flex-wrap">{footer}</div> : null}
      </div>
    </div>
  );
}

// From/to dates with quick presets. Controlled: `value` is { from, to } as
// YYYY-MM-DD strings.
export function DateRangeBar({ value, onChange, children }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap items-end gap-3">
      <label className="text-xs text-slate-600">
        From
        <input
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="block mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      </label>
      <label className="text-xs text-slate-600">
        To
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="block mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(rangePreset(p.key))}
            className="px-2.5 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            {p.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

// Previous/next paging under a table.
export function Pager({ page, pages, onPage, total }) {
  if (!pages || pages <= 1) return total !== undefined ? <p className="px-4 py-3 text-xs text-slate-500">{total} record(s)</p> : null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm">
      <span className="text-slate-500">
        Page {page} of {pages}
        {total !== undefined ? ` · ${total} record(s)` : ''}
      </span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">
          Previous
        </button>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}

// A table header cell and body cell with the app's spacing.
export const Th = ({ children, right = false }) => (
  <th className={`px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);

export const Td = ({ children, right = false, className = '' }) => (
  <td className={`px-4 py-3 text-sm text-slate-700 ${right ? 'text-right tabular-nums' : ''} ${className}`}>{children}</td>
);

// The "how was this calculated" disclosure the brief asks for on every
// financial figure.
export function Basis({ lines = [], title = 'How these figures are calculated' }) {
  if (!lines.length) return null;
  return (
    <details className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
      <summary className="cursor-pointer font-medium text-slate-700">{title}</summary>
      <ul className="list-disc pl-5 mt-2 space-y-1">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}
