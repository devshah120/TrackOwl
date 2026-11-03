// Non-component helpers for the business screens (finance, invoices, vendors,
// reports, alerts). Kept apart from BusinessUI.jsx for the same fast-refresh
// reason components/trip/helpers.js gives.

export { formatCurrency, formatNumber, formatDate, formatDateTime } from '../../constants/trip';
export { inputClass, readFileAsDataUrl } from '../trip/helpers';

// YYYY-MM-DD in local time — what <input type="date"> reads and writes.
export const toISODate = (d) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Preset ranges for the date pickers. Indian financial year runs April–March.
export const rangePreset = (key) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'last_month':
      return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
    case 'quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { from: toISODate(new Date(y, qStart, 1)), to: toISODate(now) };
    }
    case 'fy': {
      const fyStart = m >= 3 ? y : y - 1;
      return { from: toISODate(new Date(fyStart, 3, 1)), to: toISODate(now) };
    }
    case 'last_30':
      return { from: toISODate(new Date(now.getTime() - 29 * 86400000)), to: toISODate(now) };
    case 'this_month':
    default:
      return { from: toISODate(new Date(y, m, 1)), to: toISODate(now) };
  }
};

export const RANGE_PRESETS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'fy', label: 'This financial year' },
];

// A value as a table cell would show it, given the column type the reports
// API declares.
export const formatCell = (value, type) => {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money') {
    const n = Number(value);
    return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—';
  }
  if (type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
  }
  if (type === 'date') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (type === 'datetime') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return String(value);
};

export const INVOICE_STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
  overdue: 'bg-red-100 text-red-800',
};

export const BILL_STATUS_COLORS = {
  unpaid: 'bg-blue-100 text-blue-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
  overdue: 'bg-red-100 text-red-800',
};

export const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
};
