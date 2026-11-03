import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CreditCard, ShieldCheck, Truck, Users, Lock, Clock, Receipt } from 'lucide-react';
import { PageShell, PageHeader, Panel, Banner, Button, Pill, StatTile, Th, Td } from '../components/business/BusinessUI';
import { formatCurrency, formatDate } from '../components/business/helpers';
import { subscription as subscriptionApi } from '../services/api';

// Plan & Billing for the signed-in account: what plan it is on, until when,
// how close it is to its limits, and Razorpay checkout to buy or renew.
//
// Payment is prepaid: one month or one year per payment. The amount comes from
// the plan on the server; the page never sends a price. A payment counts only
// once the server has verified Razorpay's signature.

const STATUS = {
  trialing: { label: 'Free trial', cls: 'bg-blue-100 text-blue-800' },
  active: { label: 'Active', cls: 'bg-green-100 text-green-800' },
  grace: { label: 'Expired — grace period', cls: 'bg-amber-100 text-amber-800' },
  expired: { label: 'Expired', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Suspended', cls: 'bg-red-100 text-red-700' },
};

// Razorpay Checkout is a script, loaded only on this page and only once.
const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const existing = document.getElementById('razorpay-checkout-js');
    const script = existing || document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Could not load Razorpay. Check your connection and try again.'));
    if (!existing) document.body.appendChild(script);
  });

const readPending = () => {
  try {
    return JSON.parse(sessionStorage.getItem('to_pending_plan') || 'null');
  } catch {
    return null;
  }
};

export function Billing() {
  const [params] = useSearchParams();
  const pending = readPending();
  const [data, setData] = useState(null);
  const [cycle, setCycle] = useState(params.get('cycle') || pending?.cycle || 'monthly');
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const preselect = params.get('plan') || pending?.plan || null;

  const load = useCallback(async () => {
    try {
      setData(await subscriptionApi.get());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => { await load(); })();
    // The plan picked on the public pricing page has done its job once the
    // billing page has it.
    try {
      sessionStorage.removeItem('to_pending_plan');
    } catch {
      // storage blocked — nothing to clear
    }
  }, [load]);

  const pay = async (plan) => {
    setBusyPlan(plan.id);
    setError('');
    setNotice('');
    try {
      const [Razorpay, order] = await Promise.all([loadRazorpay(), subscriptionApi.checkout(plan.id, cycle)]);
      await new Promise((resolve) => {
        const rzp = new Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
          prefill: order.prefill,
          notes: order.notes,
          theme: { color: '#2563eb' },
          handler: async (response) => {
            try {
              await subscriptionApi.verify(response);
              setNotice(`Payment received — you are on ${plan.name} (${cycle}). Thank you!`);
              await load();
            } catch (err) {
              setError(err.message);
            }
            resolve();
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on('payment.failed', (resp) => {
          const reason = resp?.error?.description || 'Payment failed';
          subscriptionApi.failed(order.orderId, reason).catch(() => {});
          setError(`${reason}. No money was taken — you can try again.`);
        });
        rzp.open();
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyPlan(null);
    }
  };

  if (!data) {
    return (
      <PageShell>
        <Banner message={error} />
        {!error && <p className="text-sm text-slate-500">Loading your plan…</p>}
      </PageShell>
    );
  }

  const s = data.subscription;
  const status = STATUS[s.status] || STATUS.expired;
  const lim = s.limits || {};

  return (
    <PageShell>
      <PageHeader title="Plan & Billing" subtitle="Your TrackOwl plan, usage and payments" />

      {(params.get('expired') || s.blocked) && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3">
          <Lock className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">{s.status === 'cancelled' ? 'This account is suspended.' : 'Your plan has expired, so TrackOwl is locked.'}</p>
            <p>
              {s.status === 'cancelled'
                ? 'Please contact TrackOwl support.'
                : data.canPay
                  ? 'Choose a plan below to unlock it. Your data and GPS history are safe.'
                  : 'Ask your account owner to renew the plan. Your data and GPS history are safe.'}
            </p>
          </div>
        </div>
      )}
      <Banner message={error} onDismiss={() => setError('')} />
      <Banner tone="success" message={notice} onDismiss={() => setNotice('')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Current plan"
          value={s.status === 'trialing' ? 'Free trial' : s.plan?.name || '—'}
          hint={s.cycle ? `Billed ${s.cycle}` : null}
          icon={ShieldCheck}
          bg="bg-blue-50"
          fg="text-blue-600"
        />
        <StatTile
          label={s.status === 'trialing' ? 'Trial ends' : s.status === 'grace' ? 'Locks on' : 'Valid till'}
          value={formatDate(s.status === 'grace' ? s.graceEndsAt : s.endsAt)}
          hint={s.daysLeft !== null && s.daysLeft >= 0 ? `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left` : null}
          icon={Clock}
          bg={s.daysLeft !== null && s.daysLeft <= 3 ? 'bg-red-50' : 'bg-slate-50'}
          fg={s.daysLeft !== null && s.daysLeft <= 3 ? 'text-red-600' : 'text-slate-600'}
        />
        <StatTile label="Vehicles" value={lim.maxVehicles ? `${data.usage.vehicles} / ${lim.maxVehicles}` : data.usage.vehicles} hint={lim.maxVehicles ? null : 'No limit'} icon={Truck} />
        <StatTile label="Users" value={lim.maxUsers ? `${data.usage.users} / ${lim.maxUsers}` : data.usage.users} hint={lim.maxUsers ? null : 'No limit'} icon={Users} />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Pill className={status.cls}>{status.label}</Pill>
        <div className="inline-flex rounded-full bg-slate-200 p-1">
          {['monthly', 'yearly'].map((c) => (
            <button key={c} type="button" onClick={() => setCycle(c)} className={`px-4 py-1.5 rounded-full text-sm font-medium ${cycle === c ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
              {c === 'monthly' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
        {!data.razorpayReady && <span className="text-sm text-amber-700">Online payment is not switched on yet — contact support to subscribe.</span>}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {data.plans.map((plan) => {
          const price = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
          const current = s.plan?.id === plan.id && s.status === 'active';
          const tooSmall = plan.maxVehicles && data.usage.vehicles > plan.maxVehicles;
          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-xl border p-6 flex flex-col ${plan.highlight || preselect === plan.key ? 'border-blue-600 shadow-lg' : 'border-slate-200'}`}
            >
              {plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>}
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <p className="text-sm text-slate-500">{plan.description}</p>
              <p className="mt-4">
                <span className="text-3xl font-bold text-slate-900">{formatCurrency(price)}</span>
                <span className="text-slate-500"> /{cycle === 'yearly' ? 'year' : 'month'}</span>
              </p>
              {cycle === 'yearly' && plan.monthlyPrice > 0 && (
                <p className="text-xs text-green-700">Save {formatCurrency(plan.monthlyPrice * 12 - plan.yearlyPrice)} a year</p>
              )}
              <ul className="mt-4 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {data.canPay ? (
                  <Button
                    className="w-full"
                    variant={current ? 'secondary' : 'primary'}
                    icon={CreditCard}
                    busy={busyPlan === plan.id}
                    disabled={!data.razorpayReady || Boolean(busyPlan) || tooSmall || price <= 0}
                    onClick={() => pay(plan)}
                  >
                    {current ? `Renew ${cycle === 'yearly' ? '1 year' : '1 month'}` : s.plan && s.status === 'active' ? 'Switch to this plan' : 'Choose plan'}
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500 text-center">Only the account owner can change the plan.</p>
                )}
                {tooSmall && <p className="text-xs text-red-600 mt-2">You have {data.usage.vehicles} vehicles — this plan allows {plan.maxVehicles}.</p>}
                {current && <p className="text-xs text-slate-500 mt-2">Renewing adds time after {formatDate(s.currentPeriodEnd)}.</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        Payments are processed securely by Razorpay (UPI, cards, netbanking, wallets). Switching plan starts the new plan today and converts your unused days into extra days on it.
      </p>

      <Panel title="Payment history">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th>Date</Th>
                <Th>Plan</Th>
                <Th>Period</Th>
                <Th>Method</Th>
                <Th>Reference</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    <Receipt className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                    No payments yet.
                  </td>
                </tr>
              )}
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <Td>{formatDate(p.paidAt)}</Td>
                  <Td>{p.planName} · {p.cycle}</Td>
                  <Td>{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</Td>
                  <Td className="uppercase">{p.method || '—'}</Td>
                  <Td className="text-xs">{p.razorpayPaymentId}<span className="block text-slate-400">{p.receipt}</span></Td>
                  <Td right className="font-medium">{formatCurrency(p.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageShell>
  );
}
