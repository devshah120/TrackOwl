import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, MapPin, Play, Square, FileSignature, CheckCircle2, IndianRupee, Camera, AlertTriangle,
  LogOut, ChevronLeft, RefreshCw, Phone, Navigation, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { tripOrders, tripSettlement, driverApp } from '../services/api';
import { TRIP_STATUS_LABELS, TRIP_STATUS_COLORS, ACTIVE_STATUSES, formatCurrency, formatDate, formatDateTime } from '../constants/trip';
import { StartEndTripModal } from '../components/trip/StartEndTripModal';
import { StopPodModal } from '../components/trip/StopPodModal';
import { PodForm } from '../components/trip/PodForm';
import { readFileAsDataUrl } from '../components/trip/helpers';

// The driver app (brief §6, §13, P3): a phone-first screen for the Driver
// seat. It shows only that driver's trips — the server scopes every call — and
// only the things the person on the truck does: start and end the trip, arrive
// at stops, take proof of delivery, log what they paid on the road, upload a
// photo of a challan, report a problem, and see their advance and balance.
//
// Installable to the home screen (public/manifest.webmanifest). Big buttons,
// one column, no tables: it has to work one-handed in a cab.

const EXPENSE_CATEGORIES = [
  { value: 'toll', label: 'Toll' },
  { value: 'parking', label: 'Parking' },
  { value: 'food', label: 'Food' },
  { value: 'hotel', label: 'Stay' },
  { value: 'loading', label: 'Loading' },
  { value: 'unloading', label: 'Unloading' },
  { value: 'repair', label: 'Repair' },
  { value: 'tyre', label: 'Tyre / puncture' },
  { value: 'challan', label: 'Challan / fine' },
  { value: 'miscellaneous', label: 'Other' },
];

const UPCOMING = ['planned', 'assigned', 'ready', 'dispatched'];

const currentPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

export function DriverApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await tripOrders.list({ limit: 50, sortBy: 'tripDate', sortDir: 'desc' });
      setTrips(res.trips || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load your trips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const active = trips.filter((t) => ACTIVE_STATUSES.includes(t.status) || t.status === 'delivered');
  const upcoming = trips.filter((t) => UPCOMING.includes(t.status));
  const done = trips.filter((t) => ['completed', 'pending_settlement', 'closed'].includes(t.status)).slice(0, 10);

  if (openId) return <DriverTrip id={openId} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="bg-blue-700 text-white px-4 pt-5 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold">Track<span className="text-blue-200">Owl</span> Driver</p>
          <button type="button" onClick={() => { logout(); navigate('/login'); }} className="p-2 rounded-lg hover:bg-blue-600" aria-label="Sign out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-3 text-blue-100 text-sm">Namaste,</p>
        <p className="text-2xl font-bold">{user?.name}</p>
      </header>

      <div className="px-4 -mt-3 space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
        {loading && <p className="text-center text-slate-500 py-10">Loading your trips…</p>}

        {!loading && !trips.length && !error && (
          <div className="bg-white rounded-xl p-6 text-center text-slate-600">
            <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            No trips assigned to you yet.
            <p className="text-xs text-slate-500 mt-2">If you expected one, ask the office to check your mobile number matches your driver profile.</p>
          </div>
        )}

        <Section title="On the road now" trips={active} onOpen={setOpenId} highlight />
        <Section title="Coming up" trips={upcoming} onOpen={setOpenId} />
        <Section title="Recently finished" trips={done} onOpen={setOpenId} />

        <button type="button" onClick={() => { setLoading(true); load(); }} className="w-full flex items-center justify-center gap-2 py-3 text-sm text-slate-600">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
    </div>
  );
}

function Section({ title, trips, onOpen, highlight = false }) {
  if (!trips.length) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h2>
      <div className="space-y-3">
        {trips.map((t) => (
          <button
            key={t._id}
            type="button"
            onClick={() => onOpen(t._id)}
            className={`w-full text-left bg-white rounded-xl p-4 shadow-sm border ${highlight ? 'border-blue-300' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">{t.tripNumber}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${TRIP_STATUS_COLORS[t.status]}`}>{TRIP_STATUS_LABELS[t.status]}</span>
            </div>
            <p className="mt-2 text-slate-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              {t.pickup?.city || t.pickup?.name || '—'} → {t.destination?.city || t.destination?.name || '—'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {formatDate(t.tripDate)} · {t.vehicleNumber || 'No vehicle'}{t.stops?.length ? ` · ${t.stops.length} stop(s)` : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function DriverTrip({ id, onBack }) {
  const [data, setData] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null); // start | end | pod | {stop} | expense | issue | photo

  const load = useCallback(async () => {
    try {
      const [res, s] = await Promise.all([tripOrders.get(id), tripSettlement.get(id).catch(() => null)]);
      setData(res);
      setAccount(s?.settlement?.driver || null);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 p-4">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-slate-600 mb-4"><ChevronLeft className="w-5 h-5" /> My trips</button>
        {error ? <p className="text-red-600">{error}</p> : <p className="text-slate-500">Loading…</p>}
      </div>
    );
  }

  const trip = data.trip;
  const locked = ['closed', 'cancelled'].includes(trip.status);
  const running = Boolean(trip.start?.at) && !trip.end?.at;
  const canStart = !trip.start?.at && ['ready', 'dispatched'].includes(trip.status);
  const done = (message) => {
    setModal(null);
    setNotice(message);
    load();
  };
  const dest = trip.destination;
  const mapsLink = dest?.lat && dest?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`
    : dest?.address || dest?.city
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([dest.address, dest.city].filter(Boolean).join(', '))}`
      : null;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="bg-blue-700 text-white px-4 pt-4 pb-5">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-blue-100 text-sm"><ChevronLeft className="w-5 h-5" /> My trips</button>
        <div className="flex items-center justify-between mt-2">
          <p className="text-2xl font-bold">{trip.tripNumber}</p>
          <span className="text-xs px-2 py-1 rounded-full bg-white/20">{TRIP_STATUS_LABELS[trip.status]}</span>
        </div>
        <p className="mt-1 text-blue-100">{trip.pickup?.city || trip.pickup?.name} → {trip.destination?.city || trip.destination?.name}</p>
        <p className="text-sm text-blue-200">{trip.vehicleNumber} {trip.customer?.name ? `· ${trip.customer.name}` : ''}</p>
      </header>

      <div className="px-4 py-4 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
        {notice && <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        {!locked && (
          <div className="grid grid-cols-2 gap-3">
            {canStart && <BigButton icon={Play} label="Start trip" tone="primary" onClick={() => setModal('start')} wide />}
            {running && <BigButton icon={Square} label="End trip" tone="primary" onClick={() => setModal('end')} wide />}
            {(running || ['at_destination', 'unloading', 'delivered', 'completed'].includes(trip.status)) && (
              <BigButton icon={FileSignature} label={trip.pod?.capturedAt ? 'Update POD' : 'Proof of delivery'} onClick={() => setModal('pod')} />
            )}
            {trip.start?.at && <BigButton icon={IndianRupee} label="Add expense" onClick={() => setModal('expense')} />}
            <BigButton icon={Camera} label="Upload photo" onClick={() => setModal('photo')} />
            <BigButton icon={AlertTriangle} label="Report problem" tone="warn" onClick={() => setModal('issue')} />
            {mapsLink && (
              <a href={mapsLink} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1 rounded-xl py-4 bg-white border border-slate-200 text-slate-800 font-medium">
                <Navigation className="w-6 h-6 text-blue-600" /> Navigate
              </a>
            )}
          </div>
        )}

        {trip.stops?.length > 0 && (
          <Card title="Stops">
            <div className="space-y-3">
              {trip.stops.map((stop) => (
                <div key={stop._id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{stop.sequence}. {stop.location?.name || stop.location?.city || 'Stop'}</p>
                    <span className="text-xs text-slate-500 capitalize">{stop.status}</span>
                  </div>
                  {stop.location?.contactPhone && (
                    <a href={`tel:${stop.location.contactPhone}`} className="text-sm text-blue-600 flex items-center gap-1 mt-1"><Phone className="w-3.5 h-3.5" /> {stop.location.contactName || 'Call'}</a>
                  )}
                  {!locked && trip.start?.at && stop.status !== 'completed' && stop.status !== 'skipped' && (
                    <div className="flex gap-2 mt-2">
                      {stop.status === 'pending' && (
                        <button type="button" className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium" onClick={async () => {
                          try {
                            await tripOrders.updateStop(trip._id, stop._id, { action: 'arrive', ...(await currentPosition()) });
                            done(`Arrived at stop ${stop.sequence}`);
                          } catch (err) { setError(err.message); }
                        }}>I have arrived</button>
                      )}
                      <button type="button" className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium" onClick={() => setModal({ stop })}>Delivery / POD</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {account && (
          <Card title="My money on this trip">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Figure label="Allowance" value={account.allowance} />
              <Figure label="Advance received" value={account.advances} />
              <Figure label="I paid" value={account.paidByDriver} />
              <Figure
                label={account.balance >= 0 ? 'Office owes me' : 'I must return'}
                value={Math.abs(account.balance)}
                strong
              />
            </div>
          </Card>
        )}

        <Card title="Trip details">
          <dl className="text-sm space-y-2">
            <Row label="Pickup" value={[trip.pickup?.name, trip.pickup?.address, trip.pickup?.city].filter(Boolean).join(', ')} />
            <Row label="Planned pickup" value={trip.pickupPlannedAt ? formatDateTime(trip.pickupPlannedAt) : null} />
            <Row label="Drop" value={[trip.destination?.name, trip.destination?.address, trip.destination?.city].filter(Boolean).join(', ')} />
            <Row label="Expected" value={trip.destinationExpectedAt ? formatDateTime(trip.destinationExpectedAt) : null} />
            <Row label="LR no." value={trip.consignment?.lrNumber} />
            <Row label="E-way bill" value={trip.consignment?.ewayBill} />
            <Row label="Started" value={trip.start?.at ? `${formatDateTime(trip.start.at)} · ${trip.start.odometer} km` : null} />
            <Row label="Ended" value={trip.end?.at ? `${formatDateTime(trip.end.at)} · ${trip.end.odometer} km` : null} />
          </dl>
          {trip.cargo?.length > 0 && (
            <p className="text-sm text-slate-600 mt-3">Cargo: {trip.cargo.map((c) => `${c.quantity} ${c.unit} ${c.cargoType || c.description || ''}`.trim()).join(', ')}</p>
          )}
        </Card>
      </div>

      {(modal === 'start' || modal === 'end') && (
        <StartEndTripModal mode={modal} trip={trip} onClose={() => setModal(null)} onDone={(message) => done(message)} />
      )}
      {modal?.stop && (
        <StopPodModal tripId={trip._id} stop={modal.stop} onClose={() => setModal(null)} onSaved={() => done(`Delivery at stop ${modal.stop.sequence} recorded`)} />
      )}
      {modal === 'pod' && <TripPodSheet trip={trip} onClose={() => setModal(null)} onSaved={() => done('Proof of delivery saved')} />}
      {modal === 'expense' && <ExpenseSheet trip={trip} onClose={() => setModal(null)} onSaved={(m) => done(m)} />}
      {modal === 'photo' && <PhotoSheet trip={trip} onClose={() => setModal(null)} onSaved={() => done('Photo uploaded')} />}
      {modal === 'issue' && <IssueSheet trip={trip} onClose={() => setModal(null)} onSaved={() => done('Problem reported to the office')} />}
    </div>
  );
}

function BigButton({ icon: Icon, label, onClick, tone = 'default', wide = false }) {
  const tones = {
    primary: 'bg-blue-600 text-white border-blue-600',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    default: 'bg-white text-slate-800 border-slate-200',
  };
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-center justify-center gap-1 rounded-xl py-4 border font-medium ${tones[tone]} ${wide ? 'col-span-2 text-lg py-5' : ''}`}>
      <Icon className={wide ? 'w-7 h-7' : 'w-6 h-6'} />
      {label}
    </button>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Figure({ label, value, strong = false }) {
  return (
    <div className={`rounded-lg p-3 ${strong ? 'bg-blue-50' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500 flex items-center gap-1">{strong && <Wallet className="w-3 h-3" />}{label}</p>
      <p className={`font-bold ${strong ? 'text-blue-800 text-lg' : 'text-slate-900'}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-slate-900 text-right">{value}</dd>
    </div>
  );
}

// A bottom sheet: the phone-friendly modal.
function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onMouseDown={onClose}>
      <div className="bg-white w-full rounded-t-2xl max-h-[92vh] overflow-y-auto p-5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 text-sm">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const field = 'w-full px-3 py-3 border border-slate-300 rounded-lg text-base';

function TripPodSheet({ trip, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cargoTotal = (trip.cargo || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);
  return (
    <Sheet title="Proof of delivery" onClose={onClose}>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <PodForm
        initial={trip.pod || {}}
        cargoTotal={cargoTotal}
        saving={saving}
        onCancel={onClose}
        onSubmit={async (payload) => {
          setSaving(true);
          setError('');
          try {
            await tripOrders.savePod(trip._id, payload);
            onSaved();
          } catch (err) {
            setError(err.message);
            setSaving(false);
          }
        }}
      />
    </Sheet>
  );
}

function ExpenseSheet({ trip, onClose, onSaved }) {
  const [form, setForm] = useState({ category: 'toll', amount: '', description: '', receipt: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (confirmDuplicate = false) => {
    setBusy(true);
    setError('');
    try {
      await driverApp.addExpense(trip._id, { ...form, amount: Number(form.amount), confirmDuplicate });
      onSaved(`${EXPENSE_CATEGORIES.find((c) => c.value === form.category)?.label} of ${formatCurrency(form.amount)} added`);
    } catch (err) {
      if (err.data?.duplicate && window.confirm(`${err.message}\n\nAdd it again?`)) {
        setBusy(false);
        return save(true);
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Money I paid" onClose={onClose}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button key={c.value} type="button" onClick={() => setForm({ ...form, category: c.value })} className={`py-3 rounded-lg border text-sm font-medium ${form.category === c.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <input type="number" inputMode="decimal" min={0} placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={field} />
        <input placeholder="Note (optional) — e.g. Vadodara toll plaza" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
        <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600">
          <Camera className="w-5 h-5" /> {form.receipt ? 'Receipt added ✓' : 'Photo of receipt'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setForm({ ...form, receipt: await readFileAsDataUrl(f) }); }} />
        </label>
        <button type="button" disabled={busy || !(Number(form.amount) > 0)} onClick={() => save()} className="w-full py-4 rounded-xl bg-blue-600 text-white text-lg font-semibold disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <p className="text-xs text-slate-500">This is added to your trip and paid back to you at settlement. For diesel, use the fuel entry.</p>
      </div>
    </Sheet>
  );
}

function PhotoSheet({ trip, onClose, onSaved }) {
  const [docType, setDocType] = useState('pod');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const TYPES = [
    { value: 'pod', label: 'Signed POD / challan' },
    { value: 'eway_bill', label: 'E-way bill' },
    { value: 'invoice', label: 'Invoice copy' },
    { value: 'receipt', label: 'Receipt' },
    { value: 'other', label: 'Other (damage, seal…)' },
  ];
  return (
    <Sheet title="Upload a photo" onClose={onClose}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-2">
          {TYPES.map((t) => (
            <label key={t.value} className={`flex items-center gap-3 p-3 rounded-lg border ${docType === t.value ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
              <input type="radio" checked={docType === t.value} onChange={() => setDocType(t.value)} /> {t.label}
            </label>
          ))}
        </div>
        <label className="flex items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-300 rounded-lg text-slate-600">
          <Camera className="w-6 h-6" /> {file ? file.filename : 'Take or choose a photo'}
          <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFile(await readFileAsDataUrl(f)); }} />
        </label>
        <button
          type="button"
          disabled={busy || !file}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await tripOrders.addDocument(trip._id, { docType, title: TYPES.find((t) => t.value === docType)?.label, ...file });
              onSaved();
            } catch (err) {
              setError(err.message);
              setBusy(false);
            }
          }}
          className="w-full py-4 rounded-xl bg-blue-600 text-white text-lg font-semibold disabled:opacity-50"
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </Sheet>
  );
}

function IssueSheet({ trip, onClose, onSaved }) {
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const QUICK = ['Vehicle breakdown', 'Puncture', 'Accident', 'Stuck in traffic / road closed', 'Loading delayed', 'Customer not available', 'Police / RTO check'];
  return (
    <Sheet title="Report a problem" onClose={onClose}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setMessage(q)} className={`px-3 py-2 rounded-full border text-sm ${message === q ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'}`}>{q}</button>
          ))}
        </div>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened?" className={field} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={severity === 'critical'} onChange={(e) => setSeverity(e.target.checked ? 'critical' : 'warning')} /> Urgent — I need help now
        </label>
        <button
          type="button"
          disabled={busy || !message.trim()}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const pos = await currentPosition();
              await tripOrders.addEvent(trip._id, { eventType: 'manual', severity, message: `Driver reported: ${message.trim()}`, ...(pos || {}) });
              onSaved();
            } catch (err) {
              setError(err.message);
              setBusy(false);
            }
          }}
          className="w-full py-4 rounded-xl bg-amber-500 text-white text-lg font-semibold disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send to office'}
        </button>
        <p className="text-xs text-slate-500">Your current location is attached if your phone allows it.</p>
      </div>
    </Sheet>
  );
}
