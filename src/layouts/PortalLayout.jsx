import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, CreditCard, LayoutDashboard, LifeBuoy, LogOut, ReceiptText, Settings, Shield } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/common/ThemeToggle';
import UserAvatar from '../components/common/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { usePortal } from '../context/PortalContext';
import { formatDateTime } from '../utils/format';

const customerNav = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Billing', to: '/dashboard/billing', icon: CreditCard },
  { label: 'Orders', to: '/dashboard/orders', icon: ReceiptText },
  { label: 'Notifications', to: '/dashboard/notifications', icon: Bell },
  { label: 'Support', to: '/support', icon: LifeBuoy },
  { label: 'Account', to: '/dashboard/account', icon: Settings },
];

export default function PortalLayout() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { cart, notifications, stats, updateNotificationStatus } = usePortal();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileMenuRef = useRef(null);

  const unreadNotifications = notifications.filter((notification) => !notification.isRead).length;
  const recentNotifications = notifications.slice(0, 4);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }

      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    setIsLogoutModalOpen(false);
    logout();
    navigate('/auth/login');
  };

  const handleOpenLogoutModal = () => {
    setIsProfileMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsLogoutModalOpen(true);
  };

  const handleOpenNotificationsPage = () => {
    setIsNotificationsOpen(false);
    navigate('/dashboard/notifications');
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await updateNotificationStatus(notification.id, true);
    }

    // Close the dropdown first
    setIsNotificationsOpen(false);

    // Try to navigate to a designated target if the notification provides one.
    // Common shapes: { link, url, target } or nested in data/meta fields.
    const maybeTarget =
      notification.link ||
      notification.url ||
      notification.target ||
      (notification.data && (notification.data.link || notification.data.url || notification.data.path)) ||
      (notification.meta && (notification.meta.link || notification.meta.path));

    const data = notification.data || notification.meta || {};

    // First, prefer explicit link/url/target
    if (maybeTarget) {
      try {
        if (typeof maybeTarget === 'string') {
          if (maybeTarget.startsWith('http://') || maybeTarget.startsWith('https://')) {
            window.location.href = maybeTarget;
          } else {
            navigate(maybeTarget);
          }
        } else if (typeof maybeTarget === 'object' && maybeTarget.path) {
          navigate(maybeTarget.path);
        } else {
          handleOpenNotificationsPage();
        }
      } catch (e) {
        console.error('Failed to navigate for notification target', e);
        handleOpenNotificationsPage();
      }

      return;
    }

    // Next, try known payload shapes (order, service, user) and navigate accordingly
    const orderId = data.orderId || data.order_id || data.order || null;
    if (orderId) {
      const path = isAdmin ? `/admin/purchases/${orderId}` : `/dashboard/orders/${orderId}`;
      navigate(path);
      return;
    }

    const serviceId = data.serviceId || data.service_id || data.svcId || null;
    if (serviceId) {
      const path = isAdmin ? `/admin/customer-services/${serviceId}` : `/dashboard/services/${serviceId}`;
      navigate(path);
      return;
    }

    const userId = data.userId || data.user_id || data.clientId || null;
    if (userId) {
      const path = isAdmin ? `/admin/clients/${userId}` : '/dashboard/account';
      navigate(path);
      return;
    }

    // Default: open the notifications listing
    handleOpenNotificationsPage();
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-6 p-4 lg:p-6">
        <aside className="panel hidden w-76 shrink-0 self-start p-5 lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col lg:gap-6 lg:overflow-y-auto">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
                <Shield size={22} />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">WSI Portal</p>
                <p className="text-lg font-semibold text-white">Customer Portal</p>
              </div>
            </div>

            <nav className="mt-8 space-y-1">
              {customerNav.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                      isActive ? 'bg-orange-400 text-white' : 'text-slate-300 hover:bg-sky-300/10 hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="panel-muted p-4">
            <p className="text-sm text-slate-400">System Snapshot</p>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between"><span>Clients</span><span>{stats.totalClients}</span></div>
              <div className="flex items-center justify-between"><span>Active Services</span><span>{stats.activeServices}</span></div>
              <div className="flex items-center justify-between"><span>Provisioning</span><span>{stats.provisioning}</span></div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="panel relative z-40 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">Welcome back</p>
              <h2 className="text-2xl font-semibold text-white">{user?.name}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <NavLink to="/checkout" className="btn-secondary">
                Cart ({cart.length})
              </NavLink>
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen((current) => !current);
                    setIsProfileMenuOpen(false);
                  }}
                  className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:border-sky-300/30 hover:bg-sky-300/10"
                  aria-label="Open notifications"
                  title="Notifications"
                >
                  <Bell size={18} />
                  {unreadNotifications ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1 text-[11px] font-semibold leading-none text-white">
                      {unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {isNotificationsOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-3 w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur">
                    <div className="flex items-center justify-between px-1 pb-3">
                      <div>
                        <p className="text-sm font-medium text-white">New messages</p>
                        <p className="text-xs text-slate-400">{unreadNotifications ? `${unreadNotifications} unread notification${unreadNotifications > 1 ? 's' : ''}` : 'All caught up'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenNotificationsPage}
                        className="text-xs font-medium text-sky-300 transition hover:text-white"
                      >
                        View all
                      </button>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {recentNotifications.length ? (
                        recentNotifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition hover:border-sky-300/20 hover:bg-sky-300/10"
                          >
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="truncate text-sm font-medium text-white">{notification.title}</p>
                                  {!notification.isRead ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-400" /> : null}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{notification.message}</p>
                                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{formatDateTime(notification.createdAt)}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-400">
                          No new notifications.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen((current) => !current);
                    setIsNotificationsOpen(false);
                  }}
                  className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-left transition hover:border-sky-300/30 hover:bg-sky-300/10"
                  aria-label="Open customer menu"
                  title="Customer menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <UserAvatar user={user} />
                  <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-300 shadow-lg shadow-slate-950/30">
                    <ChevronDown size={12} className={`transition ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                      <p className="text-sm font-medium text-white">{user?.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{user?.role}</p>
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-2">
                      <ThemeToggle />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        navigate('/dashboard/account');
                      }}
                      className="btn-secondary mt-3 w-full gap-2"
                    >
                      <Settings size={16} /> Account
                    </button>
                    <button type="button" onClick={handleOpenLogoutModal} className="btn-secondary mt-3 w-full gap-2">
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            </header>

          <main className="relative z-0 min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>

      {isLogoutModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Confirm Sign Out</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Are you sure you want to log out?</h2>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">
                You will be signed out of the customer portal and need to log in again to continue.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsLogoutModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={handleLogout} className="btn-primary gap-2">
                <LogOut size={16} /> Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
