import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LayoutDashboard, LayoutGrid, List, LogOut, ReceiptText, ClipboardList, Settings, Shield, ShieldAlert, ShieldCheck, UserCircle2, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/common/ThemeToggle';
import UserAvatar from '../components/common/UserAvatar';
import StatusBadge from '../components/common/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePortal } from '../context/PortalContext';
import { formatDateTime } from '../utils/format';

const adminNav = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Clients', to: '/admin/clients', icon: Users },
  { label: 'Users', to: '/admin/users', icon: Settings },
  { label: 'Approvals', to: '/admin/approvals', icon: ClipboardList },
  { label: 'Client Services', to: '/admin/client-services', icon: ShieldCheck },
  { label: 'Manage Service', to: '/admin/services', icon: ShieldAlert },
  { label: 'Purchases', to: '/admin/purchases', icon: ReceiptText },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
//   { label: 'Reports', to: '/admin/reports', icon: Activity },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout, showIdleWarning, idleCountdown, resetInactivityTimers } = useAuth();
  const { stats, clients, adminServices, notifications, updateNotificationStatus } = usePortal();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const notificationsRef = useRef(null);
  const profileMenuRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    setIsLogoutModalOpen(false);
    logout();
    navigate('/auth/admin');
  };

  const handleOpenLogoutModal = () => {
    setIsProfileMenuOpen(false);
    setIsNotificationsOpen(false);
    setIsLogoutModalOpen(true);
  };

  const provisioningCount = adminServices.filter((service) => service.status === 'Undergoing Provisioning').length;
  const pendingClients = clients.filter((client) => client.status === 'Pending').length;

  const unreadNotifications = notifications.filter((notification) => !notification.isRead).length;
  const recentNotifications = notifications.slice(0, 4);
  const { isDarkMode } = useTheme();

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

  const handleOpenNotificationsPage = () => {
    setIsNotificationsOpen(false);
    navigate('/admin/notifications');
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await updateNotificationStatus(notification.id, true);
    }

    handleOpenNotificationsPage();
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      {/* Overlay for mobile sidebar */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} lg:hidden`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-6 p-4 lg:p-6">
        <aside className={`panel fixed top-0 left-0 z-50 h-full w-72 max-w-[90vw] transform bg-slate-950 p-5 transition-transform duration-300 lg:static lg:translate-x-0 lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:w-76 lg:flex-col lg:gap-6 lg:overflow-y-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
                <Shield size={22} />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">WSI Portal</p>
                <p className="text-lg font-semibold text-white">Admin Console</p>
              </div>
            </div>

            <nav className="mt-8 space-y-1">
              {adminNav.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/admin'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                      isActive ? 'bg-orange-400 text-white' : 'text-slate-300 hover:bg-sky-300/10 hover:text-white'
                    }`
                  }
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="mt-auto space-y-4">
            {/* Live Control Snapshot removed */}
            <NavLink
              to="/admin/account"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  isActive ? 'bg-orange-400 text-white' : 'text-slate-300 hover:bg-sky-300/10 hover:text-white'
                }`
              }
              onClick={() => setIsSidebarOpen(false)}
            >
              <UserCircle2 size={18} />
              <span>Account</span>
            </NavLink>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <header className="panel relative z-40 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden inline-flex items-center justify-center rounded-xl bg-sky-400/15 p-2 text-sky-300 shadow-md"
                aria-label="Open sidebar"
              >
                <LayoutGrid size={20} />
              </button>
              <div>
                <p className="text-sm text-slate-400">Welcome back</p>
                <h2 className="text-2xl font-semibold text-white">{user?.name}</h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Active services quick widget removed */}
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsNotificationsOpen((current) => !current);
                    setIsProfileMenuOpen(false);
                  }}
                  className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:border-sky-300/30 hover:bg-sky-300/10"
                  aria-label="Open admin notifications"
                  title="Admin notifications"
                >
                  <Bell size={18} />
                  {unreadNotifications ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full !bg-emerald-400 px-1 text-[11px] font-semibold leading-none !text-white">
                      {unreadNotifications}
                    </span>
                  ) : null}
                </button>

                {isNotificationsOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-3 w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur">
                    <div className="flex items-center justify-between px-1 pb-3">
                      <div>
                        <p className="text-sm font-medium text-white">Admin alerts</p>
                        <p className="text-xs text-slate-400">
                          {unreadNotifications ? `${unreadNotifications} unread notification${unreadNotifications > 1 ? 's' : ''}` : 'All caught up'}
                        </p>
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
                  aria-label="Open admin menu"
                  title="Admin menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <UserAvatar user={user} />
                  <span className={`absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-lg shadow-slate-950/30 ${isDarkMode ? 'border-white/10 bg-slate-900 text-slate-300' : 'border-slate-200/80 bg-transparent text-slate-900'}`}>
                    <ChevronDown size={12} className={`transition ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur profile-menu-panel">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                      <p className="text-sm font-medium text-white">{user?.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{user?.role}</p>
                    </div>
                    <div className="mt-3">
                      <ThemeToggle />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        navigate('/admin/account');
                      }}
                      className="btn-secondary mt-3 w-full gap-2"
                    >
                      <UserCircle2 size={16} /> Account
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

          {showIdleWarning ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="panel w-full max-w-md p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Inactivity Warning</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">You will be signed out soon</h2>
                <p className="mt-4 text-sm text-slate-300">You have been inactive. You will be automatically signed out in <strong>{idleCountdown}</strong> second{idleCountdown === 1 ? '' : 's'}.</p>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => { resetInactivityTimers(); }} className="btn-secondary">Stay signed in</button>
                  <button type="button" onClick={() => { resetInactivityTimers(); logout(); }} className="btn-primary">Sign out now</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Active services modal removed */}

      {isLogoutModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Confirm Sign Out</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Are you sure you want to log out?</h2>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">
                You will be signed out of the admin portal and need to log in again to continue.
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
