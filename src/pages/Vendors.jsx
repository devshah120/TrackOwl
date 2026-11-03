import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Store, Receipt, IndianRupee, Paperclip } from 'lucide-react';
import { PageShell, PageHeader, StatTile, Panel, Banner, Button, Modal, Pill, Pager, EmptyState, Th, Td } from '../components/business/BusinessUI';
import { formatCurrency, formatDate, inputClass, toISODate, readFileAsDataUrl, BILL_STATUS_COLORS } from '../components/business/helpers';
import { vendors as vendorsApi, fleet as fleetApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// Vendors & bills (brief §9.1): who the business pays, what it owes them, and
// the payments made. A bill's expense head decides whether it is also a cost in
// the P&L or only a payable — the form says which, so nobody is surprised by
// the Finance view.
const BILL_STATUS_LABELS = { unpaid: 'Unpaid', partially_paid: 'Part paid', paid: 'Paid', cancelled: 'Cancelled' };

export function Vendors() {
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'vendors';
  const [options, setOptions] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [q, setQ] = useState('');
  const [bills, setBills] = useState({ bills: [], sums: {}, page: 1, pages: 1, total: 0 });
  const [billFilter, setBillFilter] = useState({ status: 'outstanding', vendor: '', page: 1 });
  const [editingVendor, setEditingVendor] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [payingBill, setPayingBill] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadVendors = useCallback(() => vendorsApi.list().then((r) => setVendors(r.vendors || [])).catch((e) => setError(e.message)), []);
  const loadBills = useCallback(() => vendorsApi.bills(billFilter).then(setBills).catch((e) => setError(e.message)), [billFilter]);

  useEffect(() => {
    vendorsApi.options().then(setOptions).catch(() => {});
    fleetApi.list().then((r) => setTrucks(r.trucks || [])).catch(() => {});
    loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    if (tab === 'bills') loadBills();
  }, [tab, loadBills]);

  const catLabel = (v) => options?.categories.find((c) => c.value === v)?.label || v;
  const shown = vendors.filter((v) => !q || `${v.name} ${v.contactName} ${v.mobile} ${v.gstin}`.toLowerCase().includes(q.toLowerCase()));
  const totals = vendors.reduce((s, v) => ({ billed: s.billed + v.billed, balance: s.balance + v.balance }), { billed: 0, balance: 0 });

  const refreshAll = () => {
    loadVendors();
    if (tab === 'bills') loadBills();
  };

  return (
    <PageShell>
      <PageHeader
        title="Vendors & Bills"
        subtitle="Workshops, fuel pumps, dealers and other suppliers — what you owe and what you have paid"
        actions={
          <>
            {can('ledger', 'create') && (
              <Button variant="secondary" icon={Receipt} onClick={() => setEditingBill({})}>
                Add Bill
              </Button>
            )}
            {can('ledger', 'create') && (
              <Button icon={Plus} onClick={() => setEditingVendor({})}>
                Add Vendor
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Vendors" value={vendors.length} icon={Store} bg="bg-blue-50" fg="text-blue-600" />
        <StatTile label="Total billed" value={formatCurrency(totals.billed)} icon={Receipt} />
        <StatTile label="Outstanding payable" value={formatCurrency(totals.balance)} icon={IndianRupee} bg="bg-amber-50" fg="text-amber-600" onClick={() => setParams({ tab: 'bills' })} />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[{ key: 'vendors', label: 'Vendors' }, { key: 'bills', label: 'Bills' }].map((t) => (
          <button key={t.key} type="button" onClick={() => setParams(t.key === 'vendors' ? {} : { tab: t.key })} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

      {tab === 'vendors' && (
        <Panel
          action={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors" className="pl-8 pr-3 py-1.5 border border-slate-200 rounded text-sm" />
            </div>
          }
          title="All vendors"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Vendor</Th>
                  <Th>Category</Th>
                  <Th>Contact</Th>
                  <Th>GSTIN</Th>
                  <Th right>Bills</Th>
                  <Th right>Billed</Th>
                  <Th right>Outstanding</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={Store} title={vendors.length ? 'No vendors match' : 'No vendors yet'} hint="Add the workshops, pumps and dealers you buy from." />
                    </td>
                  </tr>
                )}
                {shown.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-900">
                      {v.name}
                      {v.status === 'Inactive' ? <Pill className="ml-2 bg-slate-100 text-slate-500">Inactive</Pill> : null}
                    </Td>
                    <Td>{catLabel(v.category)}</Td>
                    <Td>
                      {v.contactName || '—'}
                      {v.mobile ? <span className="block text-xs text-slate-500">{v.mobile}</span> : null}
                    </Td>
                    <Td>{v.gstin || '—'}</Td>
                    <Td right>
                      <button type="button" className="text-blue-600 hover:underline" onClick={() => { setBillFilter({ status: '', vendor: v._id, page: 1 }); setParams({ tab: 'bills' }); }}>
                        {v.bills}
                      </button>
                    </Td>
                    <Td right>{formatCurrency(v.billed)}</Td>
                    <Td right className={v.balance > 0 ? 'font-semibold text-amber-700' : ''}>{formatCurrency(v.balance)}</Td>
                    <Td>
                      <div className="flex gap-1">
                        {can('ledger', 'update') && (
                          <button type="button" aria-label="Edit" className="p-1.5 hover:bg-slate-100 rounded text-slate-600" onClick={() => setEditingVendor(v)}>
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('ledger', 'delete') && (
                          <button type="button" aria-label="Delete" className="p-1.5 hover:bg-red-50 rounded text-red-600" onClick={() => window.confirm(`Delete ${v.name}?`) && vendorsApi.remove(v._id).then(refreshAll).catch((e) => setError(e.message))}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'bills' && (
        <Panel
          title="Vendor bills"
          subtitle={`Billed ${formatCurrency(bills.sums.total)} · paid ${formatCurrency(bills.sums.paid)} · due ${formatCurrency(bills.sums.balance)}`}
          action={
            <div className="flex gap-2 flex-wrap">
              <select value={billFilter.vendor} onChange={(e) => setBillFilter({ ...billFilter, vendor: e.target.value, page: 1 })} className="px-2 py-1.5 border border-slate-200 rounded text-sm max-w-[180px]">
                <option value="">All vendors</option>
                {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>
              <select value={billFilter.status} onChange={(e) => setBillFilter({ ...billFilter, status: e.target.value, page: 1 })} className="px-2 py-1.5 border border-slate-200 rounded text-sm">
                <option value="">All</option>
                <option value="outstanding">Outstanding</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Date</Th>
                  <Th>Vendor</Th>
                  <Th>Bill no.</Th>
                  <Th>For</Th>
                  <Th>Due</Th>
                  <Th right>Total</Th>
                  <Th right>Balance</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.bills.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState icon={Receipt} title="No bills match" />
                    </td>
                  </tr>
                )}
                {bills.bills.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50">
                    <Td>{formatDate(b.billDate)}</Td>
                    <Td className="font-medium text-slate-900">{b.vendor?.name}</Td>
                    <Td>
                      {b.billNumber || '—'}
                      {b.hasAttachment && (
                        <button type="button" className="ml-1 text-blue-600" aria-label="Open bill copy" onClick={() => vendorsApi.billAttachment(b._id).then((r) => window.open(r.attachment.dataUrl, '_blank', 'noopener')).catch((e) => setError(e.message))}>
                          <Paperclip className="w-3 h-3 inline" />
                        </button>
                      )}
                    </Td>
                    <Td>
                      {options?.expenseHeads.find((h) => h.value === b.expenseHead)?.label || b.expenseHead}
                      {b.truck?.number ? <span className="block text-xs text-slate-500">{b.truck.number}</span> : null}
                    </Td>
                    <Td className={b.overdue ? 'text-red-600 font-medium' : ''}>{formatDate(b.dueDate)}</Td>
                    <Td right>{formatCurrency(b.total)}</Td>
                    <Td right className="font-semibold">{formatCurrency(b.balance)}</Td>
                    <Td>
                      <Pill className={BILL_STATUS_COLORS[b.overdue ? 'overdue' : b.status]}>{b.overdue ? 'Overdue' : BILL_STATUS_LABELS[b.status]}</Pill>
                    </Td>
                    <Td>
                      <div className="flex gap-1 justify-end">
                        {can('ledger', 'update') && b.balance > 0.5 && (
                          <Button variant="secondary" className="!px-2 !py-1" onClick={() => setPayingBill(b)}>
                            Pay
                          </Button>
                        )}
                        {can('ledger', 'update') && (
                          <button type="button" aria-label="Edit bill" className="p-1.5 hover:bg-slate-100 rounded text-slate-600" onClick={() => setEditingBill(b)}>
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {can('ledger', 'delete') && !b.payments?.length && (
                          <button type="button" aria-label="Delete bill" className="p-1.5 hover:bg-red-50 rounded text-red-600" onClick={() => window.confirm('Delete this bill?') && vendorsApi.removeBill(b._id).then(refreshAll).catch((e) => setError(e.message))}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={bills.page} pages={bills.pages} total={bills.total} onPage={(p) => setBillFilter({ ...billFilter, page: p })} />
        </Panel>
      )}

      {editingVendor && <VendorModal key={editingVendor._id || 'new'} vendor={editingVendor} options={options} onClose={() => setEditingVendor(null)} onSaved={(msg) => { setEditingVendor(null); setNotice(msg); refreshAll(); }} />}
      {editingBill && <BillModal key={editingBill._id || 'new'} bill={editingBill} vendors={vendors} trucks={trucks} options={options} onClose={() => setEditingBill(null)} onSaved={(msg) => { setEditingBill(null); setNotice(msg); refreshAll(); }} />}
      {payingBill && <PayModal key={payingBill._id} bill={payingBill} options={options} onClose={() => setPayingBill(null)} onSaved={() => { setPayingBill(null); setNotice('Payment recorded'); refreshAll(); }} />}
    </PageShell>
  );
}

// The three dialogs below are mounted only while open and keyed by record, so
// each starts from its record via the useState initialiser.
function VendorModal({ vendor, options, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ category: 'other', status: 'Active', creditDays: 0, address: {}, bank: {}, ...vendor }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      if (vendor._id) await vendorsApi.update(vendor._id, form);
      else await vendorsApi.create(form);
      onSaved(vendor._id ? 'Vendor updated' : `${form.name} added`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title={vendor._id ? 'Edit vendor' : 'Add vendor'} onClose={onClose} wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!form.name?.trim()} onClick={save}>Save</Button></>}>
      <div className="space-y-3">
        <Banner message={error} />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">Name *<input value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Category
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputClass}>
              {options?.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Contact person<input value={form.contactName || ''} onChange={(e) => set('contactName', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Mobile<input value={form.mobile || ''} onChange={(e) => set('mobile', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Email<input value={form.email || ''} onChange={(e) => set('email', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">GSTIN<input value={form.gstin || ''} onChange={(e) => set('gstin', e.target.value.toUpperCase())} className={inputClass} /></label>
          <label className="text-sm text-slate-700">City<input value={form.address?.city || ''} onChange={(e) => set('address', { ...form.address, city: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">State<input value={form.address?.state || ''} onChange={(e) => set('address', { ...form.address, state: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Credit days<input type="number" min={0} value={form.creditDays} onChange={(e) => set('creditDays', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Status
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">Bank A/c no.<input value={form.bank?.accountNumber || ''} onChange={(e) => set('bank', { ...form.bank, accountNumber: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">IFSC / UPI<input value={form.bank?.ifsc || form.bank?.upi || ''} onChange={(e) => set('bank', { ...form.bank, [e.target.value.includes('@') ? 'upi' : 'ifsc']: e.target.value })} className={inputClass} /></label>
        </div>
        <label className="text-sm text-slate-700 block">Notes<textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className={inputClass} /></label>
      </div>
    </Modal>
  );
}

function BillModal({ bill, vendors, trucks, options, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => ({
        vendor: bill.vendor?._id || bill.vendor || '',
        billNumber: bill.billNumber || '',
        billDate: toISODate(bill.billDate || new Date()),
        dueDate: bill.dueDate ? toISODate(bill.dueDate) : '',
        expenseHead: bill.expenseHead || 'other',
        description: bill.description || '',
        truck: bill.truck?._id || bill.truck || '',
        amount: bill.amount ?? '',
        gstAmount: bill.gstAmount ?? 0,
        notes: bill.notes || '',
  }));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const head = options?.expenseHeads.find((h) => h.value === form.expenseHead);
  const save = async (confirmDuplicate = false) => {
    setBusy(true);
    setError('');
    try {
      const payload = { ...form, amount: Number(form.amount), gstAmount: Number(form.gstAmount) || 0, confirmDuplicate };
      if (bill._id) await vendorsApi.updateBill(bill._id, payload);
      else await vendorsApi.createBill(payload);
      onSaved(bill._id ? 'Bill updated' : 'Bill recorded');
    } catch (err) {
      if (err.data?.duplicate && window.confirm(`${err.message}. Record it anyway?`)) {
        setBusy(false);
        return save(true);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title={bill._id ? 'Edit bill' : 'Add vendor bill'} onClose={onClose} wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!form.vendor || !(Number(form.amount) > 0)} onClick={() => save()}>Save bill</Button></>}>
      <div className="space-y-3">
        <Banner message={error} />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">Vendor *
            <select value={form.vendor} disabled={Boolean(bill._id)} onChange={(e) => set('vendor', e.target.value)} className={inputClass}>
              <option value="">Choose…</option>
              {vendors.filter((v) => v.status !== 'Inactive' || v._id === form.vendor).map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Bill number<input value={form.billNumber} onChange={(e) => set('billNumber', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Bill date<input type="date" value={form.billDate} onChange={(e) => set('billDate', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Due date<input type="date" value={form.dueDate} min={form.billDate} onChange={(e) => set('dueDate', e.target.value)} className={inputClass} /><span className="text-xs text-slate-500">Blank = vendor&apos;s credit days</span></label>
          <label className="text-sm text-slate-700 sm:col-span-2">What is it for
            <select value={form.expenseHead} onChange={(e) => set('expenseHead', e.target.value)} className={inputClass}>
              {options?.expenseHeads.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
            <span className="text-xs text-slate-500">
              {head?.payableOnly
                ? 'Tracked as a payable only — the cost is already counted from the fuel, maintenance or trip records, so it is not added to the P&L again.'
                : 'Counted as an expense in the P&L (excluding GST).'}
            </span>
          </label>
          <label className="text-sm text-slate-700">Vehicle (optional)
            <select value={form.truck} onChange={(e) => set('truck', e.target.value)} className={inputClass}>
              <option value="">No vehicle</option>
              {trucks.map((t) => <option key={t._id} value={t._id}>{t.number}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Description<input value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Amount before GST (₹) *<input type="number" min={0} value={form.amount} onChange={(e) => set('amount', e.target.value)} className={inputClass} /></label>
          <label className="text-sm text-slate-700">GST (₹)<input type="number" min={0} value={form.gstAmount} onChange={(e) => set('gstAmount', e.target.value)} className={inputClass} /></label>
        </div>
        <p className="text-sm text-slate-700">Bill total: <span className="font-semibold">{formatCurrency((Number(form.amount) || 0) + (Number(form.gstAmount) || 0))}</span></p>
        <label className="text-sm text-slate-700 block">
          Bill copy (photo or PDF)
          <input type="file" accept="image/*,application/pdf" className="block mt-1 text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('attachment', await readFileAsDataUrl(f)); }} />
        </label>
      </div>
    </Modal>
  );
}

function PayModal({ bill, options, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ date: toISODate(new Date()), amount: bill.balance, mode: 'Bank Transfer', reference: '', notes: '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (confirmDuplicate = false) => {
    setBusy(true);
    setError('');
    try {
      await vendorsApi.payBill(bill._id, { ...form, amount: Number(form.amount), confirmDuplicate });
      onSaved();
    } catch (err) {
      if (err.data?.duplicate && window.confirm(`${err.message}\n\nRecord it anyway?`)) {
        setBusy(false);
        return save(true);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title={`Pay ${bill.vendor?.name || 'vendor'}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={busy} disabled={!(Number(form.amount) > 0)} onClick={() => save()}>Record payment</Button></>}>
      <div className="space-y-3">
        <Banner message={error} />
        <p className="text-sm text-slate-600">Due on bill {bill.billNumber || ''}: <span className="font-semibold">{formatCurrency(bill.balance)}</span></p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-700">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Amount (₹)<input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} /></label>
          <label className="text-sm text-slate-700">Mode
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={inputClass}>
              {(options?.paymentModes || ['Bank Transfer', 'Cash']).map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-700">Reference<input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={inputClass} /></label>
        </div>
      </div>
    </Modal>
  );
}
