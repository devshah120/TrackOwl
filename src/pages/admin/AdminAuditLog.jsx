import { History, Info } from 'lucide-react';
import { Topbar } from '../../components/Topbar';
import { AuditLog } from '../../components/AuditLog';

// The platform operator's view of the audit trail: every client account's
// activity in one list, plus the entries that belong to no account at all — a
// failed sign-in against an unknown email, a role-matrix edit, a client account
// that has been deleted. Those exist only here, and they are usually what a
// platform operator came looking for.
//
// The table itself is the same component Settings → Audit Log renders, pointed
// at a different endpoint. Sharing it is deliberate: filtering, expansion and
// paging behave identically in both places rather than drifting apart as one
// gets fixed and the other does not.
export function AdminAuditLog() {
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Topbar />
      <main className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 p-6">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
              <History className="h-7 w-7 text-blue-600" />
              Audit Log
            </h1>
            <p className="mt-1 text-slate-600">
              Every change made across the platform — who made it, what it was before, and what it
              became.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Entries are written automatically and cannot be edited or deleted from the app.
              Platform-level events — failed sign-ins, permission changes, deleted client accounts —
              appear only here, not in any client&apos;s own Settings.
            </p>
          </div>

          <AuditLog platform />
        </div>
      </main>
    </div>
  );
}
