import { useEffect, useState } from 'react';
import { subscription as subscriptionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Which app modules the signed-in account's plan includes, for hiding menu
// entries and guarding pages. One request per signed-in user, shared by every
// component through a module-level store; `refreshPlan()` re-reads it, e.g.
// after a payment.
//
// Like usePermissions, this only hides UI — the API refuses a module the plan
// does not include regardless (middleware/auth.js).

let state = { userId: null, loaded: false, loading: false, superAdmin: false, access: null };
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
};

export const refreshPlan = async () => {
  set({ loading: true });
  try {
    const res = await subscriptionApi.access();
    set({ loaded: true, loading: false, superAdmin: Boolean(res.superAdmin), access: res.access || null });
  } catch {
    // Unreachable: fail open in the UI. The server still enforces.
    set({ loaded: true, loading: false, superAdmin: false, access: null });
  }
};

export function usePlan() {
  const { isAuthenticated, user } = useAuth();
  const [snapshot, setSnapshot] = useState(state);
  const userId = user?._id || user?.id || null;

  useEffect(() => {
    listeners.add(setSnapshot);
    return () => listeners.delete(setSnapshot);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId || state.userId === userId) return;
    set({ userId, loaded: false, access: null });
    refreshPlan();
  }, [isAuthenticated, userId]);

  const modules = snapshot.access?.modules;
  return {
    loaded: snapshot.loaded,
    access: snapshot.access,
    // Unknown (still loading, or no access info) counts as included, so the
    // menu does not flicker empty; the server is the real gate.
    has: (module) => !module || snapshot.superAdmin || !snapshot.loaded || !modules || modules.includes(module),
  };
}
