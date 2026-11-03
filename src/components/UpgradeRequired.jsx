import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Topbar } from './Topbar';
import { usePermissions } from '../hooks/usePermissions';

// Shown in place of a page whose module the account's plan does not include.
const MODULE_LABELS = {
  gps_tracking: 'Real-time GPS tracking',
  trip_history: 'Route history & replay',
  alerts_geofence: 'GPS alerts & geofencing',
  tracking_links: 'Customer tracking links',
  trip_management: 'Trip management, POD & settlement',
  lr_documents: 'LR & document printing',
  driver_app: 'Driver mobile app',
  gst_invoicing: 'GST invoices & payment tracking',
  finance: 'Finance, P&L, vendors & daily ledger',
  fuel: 'Fuel management & mileage',
  maintenance: 'Maintenance, tyres & batteries',
  reports: 'Reports with Excel & PDF export',
  integrations: 'Integrations (webhooks)',
};

export function UpgradeRequired({ module }) {
  const navigate = useNavigate();
  const { isAccountOwner } = usePermissions();
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Not included in your plan</h1>
          <p className="text-slate-600 mt-2">
            <span className="font-medium">{MODULE_LABELS[module] || 'This feature'}</span> is not part of your current plan.
            {isAccountOwner ? ' Upgrade to a plan that includes it.' : ' Ask your account owner to upgrade the plan.'}
          </p>
          <div className="flex gap-2 justify-center mt-6">
            <button type="button" onClick={() => navigate('/dashboard')} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
              Back to dashboard
            </button>
            <button type="button" onClick={() => navigate('/billing')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              See plans
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
