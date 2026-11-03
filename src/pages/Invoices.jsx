import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Settings2, FileText, Wallet, FileWarning, CheckCircle2, Download } from 'lucide-react';
import { PageShell, PageHeader, StatTile, Panel, Banner, Pager, Th, Td, Pill, Button, Modal, EmptyState } from '../components/business/BusinessUI';
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS, inputClass } from '../components/business/helpers';
import { invoices as invoicesApi, customers as customersApi, reports as reportsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// Invoices & Payments (brief §9). The receivables register: every invoice with
// what was billed, received and is still due, filterable down to "overdue for
// this customer", plus the ageing view and the numbering series.
export function Invoices() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'list';

  const [filters, setFilters] = useState({ status: params.get('status') || '', customer: '', q: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ invoices: [], total: 0, pages: 1, sums: {} });
  const [customers, setCustomers] = useState([]);
  const [ageing, setAgeing] = useState(null);
  const [options, setOptions] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    customersApi.list().then((r) => setCustomers(r.customers || [])).catch(() => {});
    invoicesApi.options().then(setOptions).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'list') return undefined;
    let cancelled = false;
    // Debounced so typing in the search box does not fire a request per key.
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await invoicesApi.list({ ...filters, page });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load invoices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [filters, page, tab]);

  useEffect(() => {
    if (tab === 'ageing') invoicesApi.ageing().then(setAgeing).catch((e) => setError(e.message));
  }, [tab]);

  const setFilter = (key, value) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const sums = data.sums || {};

  return (
    <PageShell>
      <PageHeader
        title="Invoices & Payments"
        subtitle={options?.nextNumber ? `Next invoice number: ${options.nextNumber}` : 'Bill customers, record receipts and track what is outstanding'}
        actions={
          <>
            {can('billing', 'update') && (
              <Button variant="secondary" icon={Settings2} onClick={() => setShowSettings(true)}>
                Series & defaults
              </Button>
            )}
            {can('billing', 'create') && (
              <Button icon={Plus} onClick={() => navigate('/invoices/new')}>
                New Invoice
              </Button>
            )}
          </>
        }
      />

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'list', label: 'Invoices' },
          { key: 'ageing', label: 'Outstanding & Ageing' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParams(t.key === 'list' ? {} : { tab: t.key })}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Banner message={error} onDismiss={() => setError('')} />

      {tab === 'list' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Invoiced" value={formatCurrency(sums.amount)} hint="Matching the filters below" icon={FileText} bg="bg-blue-50" fg="text-blue-600" />
            <StatTile label="Received" value={formatCurrency(sums.received)} icon={CheckCircle2} bg="bg-green-50" fg="text-green-600" />
            <StatTile label="Credit notes / TDS" value={formatCurrency(sums.adjusted)} icon={Wallet} />
            <StatTile label="Balance due" value={formatCurrency(sums.balance)} icon={FileWarning} bg="bg-red-50" fg="text-red-600" />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Invoice no., customer, trip or vehicle" className={`${inputClass} pl-9`} />
            </div>
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="">All (except cancelled)</option>
              <option value="outstanding">Outstanding</option>
              <option value="overdue">Overdue</option>
              <option value="issued">Unpaid</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={filters.customer} onChange={(e) => setFilter('customer', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm max-w-[200px]">
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            {can('reports', 'export') && (
            <Button
              variant="secondary"
              icon={Download}
              onClick={() =>
                reportsApi
                  .download('invoices', { from: filters.from, to: filters.to, customer: filters.customer, invoiceStatus: filters.status === 'overdue' ? 'outstanding' : filters.status }, 'xlsx')
                  .catch((e) => setError(e.message))
              }
            >
              Excel
            </Button>
            )}
          </div>

          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Date</Th>
                    <Th>Customer</Th>
                    <Th>Due</Th>
                    <Th right>Amount</Th>
                    <Th right>Received</Th>
                    <Th right>Balance</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">
                        Loading invoices…
                      </td>
                    </tr>
                  )}
                  {!loading && data.invoices.length === 0 && (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState icon={FileText} title="No invoices match" hint="Raise one from finished trips with New Invoice." />
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    data.invoices.map((inv) => (
                      <tr key={inv._id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/invoices/${inv._id}`)}>
                        <Td className="font-medium text-blue-700">{inv.invoiceNumber}</Td>
                        <Td>{formatDate(inv.invoiceDate)}</Td>
                        <Td>{inv.billTo?.name || inv.customer?.name}</Td>
                        <Td className={inv.overdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(inv.dueDate)}
                          {inv.overdue ? <span className="block text-xs">{inv.daysOverdue} day(s) late</span> : null}
                        </Td>
                        <Td right>{formatCurrency(inv.totals.total)}</Td>
                        <Td right>{formatCurrency(inv.totals.received + inv.totals.adjusted)}</Td>
                        <Td right className="font-semibold">{formatCurrency(inv.totals.balance)}</Td>
                        <Td>
                          <Pill className={INVOICE_STATUS_COLORS[inv.overdue ? 'overdue' : inv.status]}>{inv.statusLabel}</Pill>
                        </Td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page || page} pages={data.pages} total={data.total} onPage={setPage} />
          </Panel>
        </>
      )}

      {tab === 'ageing' && ageing && <AgeingTable ageing={ageing} onCustomer={(id) => { setParams({}); setFilter('customer', id); setFilter('status', 'outstanding'); }} />}

      {showSettings && options?.settings && (
      <SeriesSettings
        key={options.nextNumber}
        open={showSettings}
        options={options}
        onClose={() => setShowSettings(false)}
        onSaved={(res) => {
          setOptions((o) => ({ ...o, settings: res.settings, nextNumber: res.nextNumber }));
          setShowSettings(false);
        }}
      />
      )}
    </PageShell>
  );
}

function AgeingTable({ ageing, onCustomer }) {
  return (
    <Panel title="Customer outstanding by age" subtitle="Days past each invoice's due date">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th>Customer</Th>
              <Th right>Invoices</Th>
              {ageing.buckets.map((b) => (
                <Th key={b.key} right>
                  {b.label}
                </Th>
              ))}
              <Th right>Total</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ageing.customers.length === 0 && (
              <tr>
                <td colSpan={ageing.buckets.length + 3}>
                  <EmptyState icon={CheckCircle2} title="Nothing outstanding" hint="Every issued invoice is paid." />
                </td>
              </tr>
            )}
            {ageing.customers.map((c) => (
              <tr key={c.customer} className="hover:bg-slate-50 cursor-pointer" onClick={() => onCustomer(c.customer)}>
                <Td className="font-medium text-slate-900">{c.name}</Td>
                <Td right>{c.invoices}</Td>
                {ageing.buckets.map((b) => (
                  <Td key={b.key} right className={b.key === 'd90_plus' && c[b.key] ? 'text-red-600 font-semibold' : ''}>
                    {c[b.key] ? formatCurrency(c[b.key]) : '—'}
                  </Td>
                ))}
                <Td right className="font-semibold">{formatCurrency(c.total)}</Td>
              </tr>
            ))}
          </tbody>
          {ageing.customers.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
              <tr>
                <Td>Total</Td>
                <Td />
                {ageing.buckets.map((b) => (
                  <Td key={b.key} right>
                    {formatCurrency(ageing.totals[b.key])}
                  </Td>
                ))}
                <Td right>{formatCurrency(ageing.totals.total)}</Td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Panel>
  );
}

// Mounted only while open, so the form starts from the saved settings each
// time without copying props into state in an effect.
function SeriesSettings({ open, options, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...options.settings }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const preview = `${form.prefix || 'INV'}${form.separator}${form.useFinancialYear ? `2026-27${form.separator}` : ''}${String(form.startFrom || 1).padStart(Number(form.padding) || 4, '0')}`;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      onSaved(await invoicesApi.saveSettings(form));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Invoice series & defaults"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Banner message={error} />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">
            Prefix
            <input value={form.prefix} onChange={(e) => set('prefix', e.target.value.toUpperCase())} className={inputClass} />
          </label>
          <label className="text-sm text-slate-700">
            Separator
            <select value={form.separator} onChange={(e) => set('separator', e.target.value)} className={inputClass}>
              <option value="/">/</option>
              <option value="-">-</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Digits
            <input type="number" min={1} max={8} value={form.padding} onChange={(e) => set('padding', e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm text-slate-700">
            Start numbering from
            <input type="number" min={1} value={form.startFrom} onChange={(e) => set('startFrom', e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.useFinancialYear} onChange={(e) => set('useFinancialYear', e.target.checked)} />
          Include the financial year and restart numbering each April
        </label>
        <p className="text-sm text-slate-600">
          Example: <span className="font-mono font-semibold">{preview}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">
            Default credit days
            <input type="number" min={0} value={form.defaultDueDays} onChange={(e) => set('defaultDueDays', e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm text-slate-700">
            Default GST %
            <input type="number" min={0} max={28} value={form.defaultGstRate} onChange={(e) => set('defaultGstRate', e.target.value)} className={inputClass} />
          </label>
          <label className="text-sm text-slate-700">
            Default SAC
            <input value={form.defaultSac} onChange={(e) => set('defaultSac', e.target.value)} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
            <input type="checkbox" checked={form.defaultReverseCharge} onChange={(e) => set('defaultReverseCharge', e.target.checked)} />
            GST under reverse charge
          </label>
        </div>
        <label className="text-sm text-slate-700 block">
          Terms printed on invoices
          <textarea rows={3} value={form.terms} onChange={(e) => set('terms', e.target.value)} className={inputClass} />
        </label>
      </div>
    </Modal>
  );
}
