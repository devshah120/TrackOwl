import { AlertTriangle, Info } from 'lucide-react';

// Building blocks shared by the trip detail tabs. Kept here so twelve tabs
// render a card, a label and a field the same way rather than each inventing
// its own spacing.

export function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          {title && <h3 className="font-semibold text-slate-900">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

// A read-only label/value pair, as used all over the overview and detail views.
// Renders an em dash for anything empty so a blank never looks like a bug.
export function Detail({ label, value, className = '' }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={className}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`font-medium ${empty ? 'text-slate-400' : 'text-slate-900'}`}>
        {empty ? '—' : value}
      </p>
    </div>
  );
}

export function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="text-center py-10">
      {Icon && <Icon className="w-10 h-10 text-slate-300 mx-auto mb-3" />}
      <p className="text-slate-600 font-medium">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
      {children}
    </div>
  );
}

// Warnings and blockers from the assignment checks. The distinction matters and
// is preserved visually: a blocker is red and stops the action, a warning is
// amber and merely informs — the server draws the same line.
export function FindingList({ blockers = [], warnings = [] }) {
  if (!blockers.length && !warnings.length) return null;
  return (
    <div className="space-y-2">
      {blockers.map((b, i) => (
        <div
          key={`b${i}`}
          className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{b}</span>
        </div>
      ))}
      {warnings.map((w, i) => (
        <div
          key={`w${i}`}
          className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2"
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}
