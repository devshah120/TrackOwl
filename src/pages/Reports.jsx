import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileBarChart, Search } from 'lucide-react';
import { PageShell, PageHeader, Panel, Banner, Button, DateRangeBar, EmptyState, Th, Td } from '../components/business/BusinessUI';
import { formatCell, rangePreset } from '../components/business/helpers';
import { reports as reportsApi, fleet as fleetApi, drivers as driversApi, customers as customersApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// Reports (brief §11). Every report is built on the server; this page shows
// it with the filters it supports, a search and paging over the rows, and
// Excel/PDF export. The export is the same server call on the same filters, so
// its totals are the totals on screen. Search here narrows what you look at;
// it does not change what is exported — the note under the table says so.
const PAGE_SIZE = 50;

const GROUPS = [
  { label: 'Trips', keys: ['trips', 'trips-by-day', 'trips-by-month'] },
  { label: 'Profitability', keys: ['trip-profitability', 'vehicle-profitability'] },
  { label: 'Fleet', keys: ['drivers', 'fuel', 'maintenance', 'compliance', 'utilisation', 'devices'] },
  { label: 'Billing', keys: ['invoices', 'payments', 'customer-outstanding'] },
];

export function Reports() {
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [available, setAvailable] = useState([]);
  const [key, setKey] = useState(params.get('report') || '');
  const [range, setRange] = useState(rangePreset('this_month'));
  const [filters, setFilters] = useState({ truck: '', driver: '', customer: '', status: '', invoiceStatus: '' });
  const [lookups, setLookups] = useState({ trucks: [], drivers: [], customers: [] });
  const [report, setReport] = useState(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi
      .list()
      .then((r) => {
        setAvailable(r.reports || []);
        if (!key && r.reports?.length) setKey(r.reports[0].key);
      })
      .catch((e) => setError(e.message));
    fleetApi.list().then((r) => setLookups((l) => ({ ...l, trucks: r.trucks || [] }))).catch(() => {});
    driversApi.list().then((r) => setLookups((l) => ({ ...l, drivers: r.drivers || [] }))).catch(() => {});
    customersApi.list().then((r) => setLookups((l) => ({ ...l, customers: r.customers || [] }))).catch(() => {});
    // Runs once; `key` is seeded from the URL above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const def = available.find((r) => r.key === key);
  const query = useMemo(() => {
    if (!def) return {};
    const out = {};
    if (def.filters.includes('date')) Object.assign(out, range);
    for (const f of ['truck', 'driver', 'customer', 'status', 'invoiceStatus']) if (def.filters.includes(f) && filters[f]) out[f] = filters[f];
    return out;
  }, [def, range, filters]);

  useEffect(() => {
    if (!def) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await reportsApi.run(def.key, query);
        if (!cancelled) {
          setReport(r.report);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [def, query]);

  const rows = useMemo(() => {
    if (!report) return [];
    const term = q.trim().toLowerCase();
    if (!term) return report.rows;
    return report.rows.filter((row) => report.columns.some((c) => String(row[c.key] ?? '').toLowerCase().includes(term)));
  }, [report, q]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const choose = (k) => {
    setKey(k);
    setParams({ report: k });
    setReport(null);
    setQ('');
  };

  const exportAs = (format) => reportsApi.download(key, query, format).catch((e) => setError(e.message));

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        subtitle="Operational and financial reports with Excel and PDF export"
        actions={
          def && can('reports', 'export') ? (
            <>
              <Button variant="secondary" icon={Download} onClick={() => exportAs('xlsx')}>
                Excel
              </Button>
              <Button variant="secondary" icon={Download} onClick={() => exportAs('pdf')}>
                PDF
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid lg:grid-cols-4 gap-6">
        <Panel title="Choose a report" className="lg:col-span-1 h-fit">
          <div className="p-2">
            {GROUPS.map((g) => {
              const items = available.filter((r) => g.keys.includes(r.key));
              if (!items.length) return null;
              return (
                <div key={g.label} className="mb-2">
                  <p className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</p>
                  {items.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => choose(r.key)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${r.key === key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="lg:col-span-3 space-y-4">
          {def?.filters.includes('date') && <DateRangeBar value={range} onChange={setRange} />}
          {def && def.filters.some((f) => ['truck', 'driver', 'customer', 'status', 'invoiceStatus'].includes(f)) && (
            <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-wrap gap-3">
              {def.filters.includes('truck') && (
                <select value={filters.truck} onChange={(e) => setFilters({ ...filters, truck: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">All vehicles</option>
                  {lookups.trucks.map((t) => <option key={t._id} value={t._id}>{t.number}</option>)}
                </select>
              )}
              {def.filters.includes('driver') && (
                <select value={filters.driver} onChange={(e) => setFilters({ ...filters, driver: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">All drivers</option>
                  {lookups.drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              )}
              {def.filters.includes('customer') && (
                <select value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">All customers</option>
                  {lookups.customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              )}
              {def.filters.includes('status') && (
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">All statuses</option>
                  {['planned', 'assigned', 'dispatched', 'in_transit', 'delivered', 'completed', 'pending_settlement', 'closed', 'cancelled'].map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              )}
              {def.filters.includes('invoiceStatus') && (
                <select value={filters.invoiceStatus} onChange={(e) => setFilters({ ...filters, invoiceStatus: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="">All (not cancelled)</option>
                  <option value="outstanding">Outstanding</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}
            </div>
          )}

          <Banner message={error} onDismiss={() => setError('')} />

          <Panel
            title={report?.title || def?.title || 'Report'}
            subtitle={report?.subtitle}
            action={
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search rows" className="pl-8 pr-3 py-1.5 border border-slate-200 rounded text-sm w-44" />
              </div>
            }
          >
            {loading && <p className="px-4 py-8 text-sm text-slate-500 text-center">Building report…</p>}
            {!loading && report && report.rows.length === 0 && <EmptyState icon={FileBarChart} title="No data for these filters" />}
            {!loading && report && report.rows.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {report.columns.map((c) => (
                          <Th key={c.key} right={c.type === 'money' || c.type === 'number'}>
                            {c.label}
                          </Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pageRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {report.columns.map((c) => (
                            <Td key={c.key} right={c.type === 'money' || c.type === 'number'} className={c.type === 'money' && Number(row[c.key]) < 0 ? 'text-red-600' : ''}>
                              {formatCell(row[c.key], c.type)}
                            </Td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {Object.keys(report.totals || {}).length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                        <tr>
                          {report.columns.map((c, i) => (
                            <Td key={c.key} right={c.type === 'money' || c.type === 'number'}>
                              {i === 0 ? 'Total (all rows)' : c.key in report.totals ? formatCell(report.totals[c.key], c.type) : ''}
                            </Td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm flex-wrap gap-2">
                  <span className="text-slate-500">
                    {rows.length} of {report.rows.length} row(s){q ? ' match the search — totals and exports cover all rows' : ''}
                    {report.truncated ? ' · capped at 5,000 rows; narrow the filters' : ''}
                  </span>
                  {pages > 1 && (
                    <div className="flex gap-2 items-center">
                      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">Previous</button>
                      <span className="text-slate-500">{page} / {pages}</span>
                      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">Next</button>
                    </div>
                  )}
                </div>
                {report.note && <p className="px-4 pb-3 text-xs text-slate-500">{report.note}</p>}
              </>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
