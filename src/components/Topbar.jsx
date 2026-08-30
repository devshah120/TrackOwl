import { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, Calendar, Truck, Settings, LogOut, Menu, X, ChevronDown, Bell, Route, MapPin, ShieldCheck, Users, UserRound, Cpu } from 'lucide-react';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { roleLabel } from '../constants/roles';
import { notifications as notificationsApi } from '../services/api';

const NOTIFICATIONS_POLL_MS = 30000;

const timeAgo = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

// Canonical top navigation, shared by every page. This is the single source of
// truth for what each menu item is and where it goes — pages must render <Topbar />
// rather than hand-rolling their own <nav>, or the menus drift out of sync.
//
// `path` is the real standalone route each item opens. `match` lists the URL
// fragments that should light the item as active (a page and its sub-pages, e.g.
// the ledger and its add-entry screen).
//
// `resource` is the permission resource the page needs. An item is hidden from
// any seat holding no grant on it — an Accountant does not see Trip Routes, a
// Driver sees neither the ledger nor the fleet. Items with no `resource` (the
// dashboard, settings) are shown to everyone. This mirrors the API, which
// refuses the same calls regardless of what the menu shows.
//
// `children` turns an item into a dropdown. Fleet Management splits into
// Vehicles and Drivers, which are separate masters with separate permission
// resources — a seat granted only `drivers` sees the parent with just the
// Drivers entry under it. A parent whose children are all filtered out is
// dropped entirely, and its own `path` is where clicking the parent lands.
//
// The superadmin's Fleet Oversight splits the same way, into the vehicles it
// oversees and the Device Master — the tracking hardware fitted to them. Both
// are superadmin-only pages, so neither child carries a `resource`.
const CLIENT_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', match: ['dashboard'] },
  { id: 'trips', label: 'Trips & Documents', icon: FileText, path: '/trips-and-documents', match: ['trips-and-documents', 'add-new-trip'], resource: 'trips' },
  { id: 'ledger', label: 'Daily Ledger', icon: Calendar, path: '/daily-ledger', match: ['daily-ledger', 'add-ledger-entry'], resource: 'ledger' },
  {
    id: 'fleet',
    label: 'Fleet Management',
    icon: Truck,
    path: '/fleet-and-drivers',
    match: ['fleet-and-drivers', 'add-new-truck', 'drivers', 'add-new-driver'],
    children: [
      { id: 'fleet-vehicles', label: 'Vehicles', icon: Truck, path: '/fleet-and-drivers', match: ['fleet-and-drivers', 'add-new-truck'], resource: 'trucks' },
      { id: 'fleet-drivers', label: 'Drivers', icon: UserRound, path: '/drivers', match: ['drivers', 'add-new-driver'], resource: 'drivers' },
    ],
  },
  { id: 'triproutes', label: 'Trip Routes', icon: Route, path: '/trip-routes', match: ['trip-routes'], resource: 'tracking' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', match: ['settings'] },
];

// Superadmin-only: platform-wide views, replacing the per-client nav entirely.
// Live Tracking lives here (not in the client nav) since it now shows every
// client's fleet on one global map, per the superadmin build.
const SUPERADMIN_NAV_ITEMS = [
  { id: 'admin-overview', label: 'Overview', icon: LayoutDashboard, path: '/admin/overview', match: ['admin/overview'] },
  { id: 'admin-clients', label: 'Clients', icon: Users, path: '/admin/clients', match: ['admin/clients'] },
  {
    id: 'admin-fleet',
    label: 'Fleet Oversight',
    icon: Truck,
    path: '/admin/fleet',
    match: ['admin/fleet', 'admin/devices'],
    children: [
      { id: 'admin-fleet-vehicles', label: 'Vehicles', icon: Truck, path: '/admin/fleet', match: ['admin/fleet'] },
      { id: 'admin-fleet-devices', label: 'Device Master', icon: Cpu, path: '/admin/devices', match: ['admin/devices'] },
    ],
  },
  { id: 'admin-tracking', label: 'Live Tracking', icon: MapPin, path: '/admin/live-tracking', match: ['admin/live-tracking'] },
  { id: 'admin-permissions', label: 'Permissions', icon: ShieldCheck, path: '/admin/permissions', match: ['admin/permissions'] },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', match: ['settings'] },
];

// `activeMenu`/`onMenuChange` are optional legacy props (DashboardLayout still
// passes them). When absent, the active item is derived from the URL and clicks
// navigate directly — so any page can drop in <Topbar /> with no wiring.
export function Topbar({ activeMenu, onMenuChange }) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Which top-level dropdown is open, by item id. Null when none is.
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin } = useAuth();
  const { canAccess } = usePermissions();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.log('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await notificationsApi.list();
        if (!cancelled) setNotifications(res.notifications);
      } catch {
        // Bell just stays empty on failure — not worth a page-level error banner.
      }
    };
    load();
    const timer = setInterval(load, NOTIFICATIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => ((n._id || n.id) === id ? { ...n, read: true } : n)));
    try {
      await notificationsApi.markRead(id);
    } catch {
      // Best-effort — next poll will reconcile with the server's actual state.
    }
  };

  const markAllRead = async (e) => {
    e.preventDefault();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      // Best-effort — next poll will reconcile with the server's actual state.
    }
  };

  // Hide what the seat cannot reach, at both levels: a child is dropped when its
  // own resource is ungranted, and a parent is dropped once nothing is left
  // under it (or its own resource is ungranted).
  const visible = (item) => !item.resource || canAccess(item.resource);
  const navItems = (isSuperAdmin ? SUPERADMIN_NAV_ITEMS : CLIENT_NAV_ITEMS)
    .filter(visible)
    .map((item) =>
      item.children ? { ...item, children: item.children.filter(visible) } : item
    )
    .filter((item) => !item.children || item.children.length > 0);
  const menuItems = navItems;

  // Which item is active: honour an explicit activeMenu prop if given, else infer
  // from the current path via each item's `match` fragments.
  const currentPath = location.pathname;
  const derivedActive =
    navItems.find((i) => i.match.some((m) => currentPath.includes(m)))?.id || navItems[0]?.id;
  const effectiveActive = activeMenu || derivedActive;

  // Longest match wins so /drivers does not also light up under a parent whose
  // first child happens to match a shorter fragment.
  const activeChildId = (item) =>
    item.children
      ?.filter((c) => c.match.some((m) => currentPath.includes(m)))
      .sort((a, b) => Math.max(...b.match.map((m) => m.length)) - Math.max(...a.match.map((m) => m.length)))[0]?.id;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Every item navigates to its canonical standalone route. onMenuChange, if the
  // parent passed one, is still notified so layouts that track active state keep
  // working — but routing no longer depends on it.
  const handleMenuClick = (itemId) => {
    const item =
      navItems.find((i) => i.id === itemId) ||
      navItems.flatMap((i) => i.children || []).find((c) => c.id === itemId);
    onMenuChange?.(itemId);
    setOpenSubmenu(null);
    if (item) navigate(item.path);
  };

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 bg-white border-b border-slate-200 shadow-sm z-[2000]">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Left: Logo and Desktop Menu */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                Track<span className="text-blue-600">Owl</span>
              </h1>
              {isSuperAdmin && (
                <span className="flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = effectiveActive === item.id;

                // Parent with children: opens a dropdown on hover (and on click,
                // so keyboard and touch reach it too) instead of navigating.
                if (item.children) {
                  const isOpen = openSubmenu === item.id;
                  const currentChild = activeChildId(item);
                  return (
                    <div
                      key={item.id}
                      className="relative"
                      onMouseEnter={() => setOpenSubmenu(item.id)}
                      onMouseLeave={() => setOpenSubmenu(null)}
                    >
                      <button
                        onClick={() => setOpenSubmenu(isOpen ? null : item.id)}
                        aria-expanded={isOpen}
                        aria-haspopup="true"
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="absolute left-0 top-full w-56 pt-2 z-[2100]">
                          <div className="bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const childActive = currentChild === child.id;
                              return (
                                <button
                                  key={child.id}
                                  onClick={() => handleMenuClick(child.id)}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                    childActive
                                      ? 'bg-blue-50 text-blue-600 font-medium'
                                      : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <ChildIcon className="w-4 h-4" />
                                  <span className="text-sm">{child.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuClick(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: User Profile and Actions */}
          <div className="flex items-center gap-4">
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Toggle fullscreen"
            >
              {isFullscreen ? (
                <AiOutlineFullscreenExit className="w-5 h-5 text-slate-600" />
              ) : (
                <AiOutlineFullscreen className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-slate-200 max-h-96 overflow-y-auto z-[2100]">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-slate-900">Notification</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 && (
                    <p className="p-4 text-sm text-slate-500">No notifications yet.</p>
                  )}

                  <div className="divide-y divide-slate-200">
                    {notifications.map((notif) => (
                      <div
                        key={notif._id || notif.id}
                        onClick={() => !notif.read && markRead(notif._id || notif.id)}
                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                          !notif.read ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="flex-shrink-0">
                            {notif.type === 'alert' ? (
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                notif.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                              }`}>!</div>
                            ) : (
                              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">i</div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{notif.title}</p>
                                <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                                {notif.vehicle && (
                                  <p className="text-xs text-slate-500 mt-1">Vehicle: {notif.vehicle}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-xs text-slate-500">{timeAgo(notif.createdAt)}</span>
                                {notif.severity === 'critical' && (
                                  <span className="text-xs text-red-600 font-semibold">Critical</span>
                                )}
                                {notif.severity === 'warning' && (
                                  <span className="text-xs text-yellow-600 font-semibold">Warning</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
                  <p className="text-xs text-slate-500">{roleLabel(user?.role)}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-[2100]">
                  <div className="p-3 border-b border-slate-200">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                    <p className="text-xs text-slate-500 mt-1">{user?.company}</p>
                    <p className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {roleLabel(user?.role)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-slate-50">
            <div className="px-4 py-2 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = effectiveActive === item.id;

                // No dropdowns on mobile — a parent becomes a section heading
                // with its children listed under it, so everything stays one tap
                // away on a screen with room to scroll.
                if (item.children) {
                  const currentChild = activeChildId(item);
                  return (
                    <div key={item.id} className="py-1">
                      <div className="flex items-center gap-3 px-4 py-2 text-slate-500">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {item.label}
                        </span>
                      </div>
                      <div className="pl-4 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = currentChild === child.id;
                          return (
                            <button
                              key={child.id}
                              onClick={() => {
                                handleMenuClick(child.id);
                                setIsMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                                childActive
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <ChildIcon className="w-4 h-4" />
                              <span className="text-sm font-medium">{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleMenuClick(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
