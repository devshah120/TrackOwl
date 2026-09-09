import { useEffect, useRef, useState } from 'react';
import { Building2, Loader2, X, Search } from 'lucide-react';
import { customers as customersApi } from '../services/api';

// Turn a failed customer lookup into something the user can act on. apiCall
// throws { status, message }, so the HTTP status tells us whose problem it is.
const searchErrorMessage = (err) => {
  if (err?.status === 401) return 'Session expired — sign in again to search.';
  if (err?.status === 403) return 'You do not have access to the customer master.';
  return 'Could not search customers. Check your connection.';
};

// Flatten the master's address block into the single line the consignor /
// consignee fields on a BillingTrip hold. Empty parts are dropped so a
// half-filled master does not produce ", , 380015".
export const flattenAddress = (addr = {}) =>
  [addr.line1, addr.line2, addr.city, addr.state, addr.pincode]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');

// The person the office calls by default, mirroring how Customers.jsx picks the
// row it displays: the starred contact, else simply the first one.
export const primaryContact = (customer) =>
  customer?.contacts?.find((c) => c.isPrimary) || customer?.contacts?.[0] || null;

// Everything the trip form copies off a customer master in one shape, so both
// the supplier and buyer blocks fill in the same way.
export const customerToParty = (customer) => ({
  name: customer?.name || '',
  gst: customer?.gstin || '',
  address: flattenAddress(customer?.billingAddress),
  contact: primaryContact(customer)?.mobile || '',
});

// A search box that looks up the customer master and hands the whole record
// back through onSelect. The trip form copies the details onto the consignment
// rather than referencing them, which is deliberate: BillingTrip's embedded
// party blocks are what the printed LR and tax invoice render from, so they
// have to keep the values as they stood on the day the trip was booked.
//
// Picking a customer never locks the fields it fills — the office regularly
// ships to a branch office or a one-off site whose details differ from the
// master, and typing over the filled-in value is the normal way to do that.
export function CustomerPicker({ label = 'Find in customer master', onSelect, disabled = false }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);
  const abortRef = useRef(null);

  // Debounced search: wait for a pause in typing, and cancel any in-flight
  // request so results can't arrive out of order.
  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      try {
        const res = await customersApi.list({ search: q, signal: controller.signal });
        // A blacklisted customer is refused at trip creation, so offering it
        // here would only produce an error the user cannot act on.
        const rows = (res.customers || []).filter((c) => c.status !== 'Blacklisted');
        setResults(rows);
        setError(rows.length ? null : 'No matching customer.');
        setOpen(true);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setResults([]);
        setError(searchErrorMessage(err));
        setOpen(true);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [text]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Drop the in-flight request if the field unmounts mid-search.
  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = (customer) => {
    onSelect(customer);
    // The box is a lookup, not a value: clearing it makes plain that what was
    // filled in below is now ordinary editable text, not a live link.
    setText('');
    setResults([]);
    setError(null);
    setOpen(false);
  };

  return (
    <div className="mb-4" ref={boxRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search by name, code or GSTIN"
          className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
        />
        {busy && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
        {!busy && text && (
          <button
            type="button"
            onClick={() => { setText(''); setResults([]); setError(null); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {results.map((c) => {
              const contact = primaryContact(c);
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => pick(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-900 truncate">{c.name}</span>
                    {c.code && <span className="text-xs text-slate-400 shrink-0">{c.code}</span>}
                  </div>
                  <div className="mt-0.5 pl-6 text-xs text-slate-500 truncate">
                    {[c.gstin, c.billingAddress?.city, contact?.mobile].filter(Boolean).join(' · ') || 'No further details'}
                  </div>
                </button>
              );
            })}
            {!results.length && error && (
              <p className="px-4 py-2.5 text-sm text-slate-500">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
