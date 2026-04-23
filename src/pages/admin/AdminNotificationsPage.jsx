import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, CheckCheck, MailOpen, Trash2, ChevronDown, Search, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { LayoutGrid, List } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatDateTime } from '../../utils/format';

const NOTIFICATIONS_PER_PAGE = 5;

export default function AdminNotificationsPage() {
  const { notifications, updateNotificationStatus, markAllNotificationsRead, dismissNotification } = usePortal();
  const [filter, setFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const statusRef = useRef(null);
  const statusMenuRef = useRef(null);
  const [statusMenuStyle, setStatusMenuStyle] = useState(null);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const filters = ['All', 'Unread', 'Read', 'info', 'warning', 'success', 'danger'];
  const STATUS_ICONS = {
    All: BellRing,
    Unread: MailOpen,
    Read: CheckCheck,
    info: Info,
    warning: AlertTriangle,
    success: CheckCircle,
    danger: XCircle,
  };

  const filteredNotifications = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return notifications.filter((item) => {
      // status/type filtering
      if (filter === 'Unread' && item.isRead) return false;
      if (filter === 'Read' && !item.isRead) return false;
      if (filter !== 'All' && filter !== 'Unread' && filter !== 'Read' && item.type !== filter) return false;

      // search text
      if (normalized) {
        const hay = [item.title || '', item.message || '', item.type || '', item.id || ''].join(' ').toLowerCase();
        return hay.includes(normalized);
      }

      return true;
    });
  }, [notifications, filter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / NOTIFICATIONS_PER_PAGE));
  const paginatedNotifications = filteredNotifications.slice((currentPage - 1) * NOTIFICATIONS_PER_PAGE, currentPage * NOTIFICATIONS_PER_PAGE);
  const allVisibleSelected = paginatedNotifications.length > 0 && paginatedNotifications.every((item) => selectedIds.includes(item.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  // close status dropdown on outside click
  useEffect(() => {
    const onDoc = (e) => {
      const clickedInsideTrigger = statusRef.current && statusRef.current.contains(e.target);
      const clickedInsideMenu = statusMenuRef.current && statusMenuRef.current.contains(e.target);
      if (!clickedInsideTrigger && !clickedInsideMenu) setStatusOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!statusOpen || !statusRef.current) {
      setStatusMenuStyle(null);
      return;
    }

    const btn = statusRef.current.querySelector('button');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const menuWidth = 220;
    const left = Math.max(8, rect.right - menuWidth + window.scrollX);
    const top = rect.bottom + 8 + window.scrollY;

    setStatusMenuStyle({ position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${menuWidth}px`, zIndex: 9999 });

    const onResize = () => {
      const r = btn.getBoundingClientRect();
      setStatusMenuStyle({ position: 'absolute', left: `${Math.max(8, r.right - menuWidth + window.scrollX)}px`, top: `${r.bottom + 8 + window.scrollY}px`, width: `${menuWidth}px`, zIndex: 9999 });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [statusOpen]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleSelect = (notificationId) => {
    setSelectedIds((current) => (
      current.includes(notificationId) ? current.filter((id) => id !== notificationId) : [...current, notificationId]
    ));
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = paginatedNotifications.map((item) => item.id);

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  };

  const handleDeleteSelected = async () => {
    await Promise.all(selectedIds.map((id) => dismissNotification(id)));
    setSelectedIds([]);
  };

  const handleDeleteAllFiltered = async () => {
    await Promise.all(filteredNotifications.map((item) => dismissNotification(item.id)));
    setSelectedIds([]);
  };

  const handleOpenNotification = async (notification) => {
    if (!notification.isRead) {
      await updateNotificationStatus(notification.id, true);
    }

    const maybeTarget =
      notification.link ||
      notification.url ||
      notification.target ||
      (notification.data && (notification.data.link || notification.data.url || notification.data.path)) ||
      (notification.meta && (notification.meta.link || notification.meta.path));

    const data = notification.data || notification.meta || {};

    // Only navigate immediately for external links
    if (typeof maybeTarget === 'string' && (maybeTarget.startsWith('http://') || maybeTarget.startsWith('https://'))) {
      window.location.href = maybeTarget;
      return;
    }

    setSelectedNotification({
      ...notification,
      isRead: true,
      _target: maybeTarget || null,
      _data: data,
    });
  };

  const notificationsHeaderAction = (
    notifications.length ? (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={markAllNotificationsRead} className="btn-secondary gap-2">
            <CheckCheck size={16} /> Mark all read
          </button>
          <button type="button" onClick={handleDeleteSelected} disabled={!selectedIds.length} className="btn-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 size={16} /> Delete selected
          </button>
          <button type="button" onClick={handleDeleteAllFiltered} disabled={!filteredNotifications.length} className="btn-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 size={16} /> Delete all
          </button>
        </div>

        <div className="relative w-64 flex-shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Search notifications"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-slate-200 outline-none"
          />
        </div>

        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <div className="relative" ref={statusRef}>
            <button
              type="button"
              onClick={() => setStatusOpen((s) => !s)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
            >
              <span className="text-sm text-slate-200">{filter}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {statusOpen && statusMenuStyle
              ? createPortal(
                  <div ref={statusMenuRef} style={statusMenuStyle} className="rounded-lg border border-white/6 bg-slate-900 shadow">
                    {filters.map((item) => {
                      const Icon = STATUS_ICONS[item] || STATUS_ICONS[item.toString()];
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setFilter(item);
                            setStatusOpen(false);
                            setCurrentPage(1);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/5 flex items-center gap-2"
                        >
                          {Icon ? <Icon size={14} className="text-slate-300" /> : null}
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>,
                  document.body,
                )
              : null}
          </div>

          <div className="inline-flex items-center gap-2 ml-3">
            <button type="button" onClick={() => setViewMode('grid')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="Grid view">
              <LayoutGrid size={16} />
            </button>
            <button type="button" onClick={() => setViewMode('list')} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} aria-label="List view">
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
    ) : null
  );

  return (
    <div>
      <PageHeader
        eyebrow="Admin Alerts"
        title="Notifications center"
        action={notificationsHeaderAction}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setFilter('All')}
          aria-pressed={filter === 'All'}
          className={`panel p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-500/70 ${
            filter === 'All' ? 'border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]' : ''
          }`}
        >
          <p className="text-sm text-slate-400">Total alerts</p>
          <p className="mt-3 text-3xl font-semibold text-white">{notifications.length}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('Unread')}
          aria-pressed={filter === 'Unread'}
          className={`panel p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-500/70 ${
            filter === 'Unread' ? 'border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]' : ''
          }`}
        >
          <p className="text-sm text-slate-400">Unread</p>
          <p className="mt-3 text-3xl font-semibold text-white">{unreadCount}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter('Read')}
          aria-pressed={filter === 'Read'}
          className={`panel p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-500/70 ${
            filter === 'Read' ? 'border-sky-400/80 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]' : ''
          }`}
        >
          <p className="text-sm text-slate-400">Read</p>
          <p className="mt-3 text-3xl font-semibold text-white">{notifications.length - unreadCount}</p>
        </button>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-4">
          {paginatedNotifications.map((item) => (
            <div key={item.id} className={`panel p-6 ${item.isRead ? 'opacity-80' : ''}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4">
                  <label className="mt-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-blue-500"
                      aria-label={`Select notification ${item.title}`}
                    />
                  </label>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.isRead ? 'bg-white/5 text-slate-400' : 'bg-emerald-400/15 text-emerald-300'}`}>
                    <BellRing size={18} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(item)}
                    className="min-w-0 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-medium text-white">{item.title}</p>
                      {!item.isRead ? <StatusBadge status="New" /> : null}
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{item.message}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-sky-300">Click to view details</p>
                  </button>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <p className="text-sm text-slate-500">{formatDateTime(item.createdAt)}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateNotificationStatus(item.id, !item.isRead)}
                      className="btn-secondary gap-2 px-3"
                    >
                      <MailOpen size={16} /> {item.isRead ? 'Mark unread' : 'Mark read'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissNotification(item.id)}
                      className="btn-secondary gap-2 px-3"
                    >
                      <Trash2 size={16} /> Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!paginatedNotifications.length ? (
            <div className="panel p-8 text-center text-sm text-slate-400">
              No notifications match the selected filter.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedNotifications.map((item) => (
            <div key={item.id} className={`panel p-4 ${item.isRead ? 'opacity-80' : ''}`}>
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.isRead ? 'bg-white/5 text-slate-400' : 'bg-emerald-400/15 text-emerald-300'}`}>
                      <BellRing size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateNotificationStatus(item.id, !item.isRead)} className="btn-secondary px-3">{item.isRead ? 'Mark unread' : 'Mark read'}</button>
                    <button type="button" onClick={() => dismissNotification(item.id)} className="btn-secondary px-3">Dismiss</button>
                  </div>
                </div>

                <p className="mt-2 text-sm text-slate-400 line-clamp-3">{item.message}</p>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={() => handleOpenNotification(item)} className="text-sm text-sky-300">View details</button>
                  {!item.isRead ? <StatusBadge status="New" /> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {selectedNotification ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Notification Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedNotification.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{formatDateTime(selectedNotification.createdAt)}</p>
              </div>
              <button type="button" onClick={() => setSelectedNotification(null)} className="btn-secondary px-4">
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm leading-7 text-slate-300">{selectedNotification.message}</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {selectedNotification && selectedNotification._target ? (
                <button
                  type="button"
                  onClick={() => {
                    const t = selectedNotification._target;
                    if (typeof t === 'string') {
                      if (t.startsWith('http://') || t.startsWith('https://')) {
                        window.open(t, '_blank');
                      } else {
                        // internal route
                        window.location.href = t;
                      }
                    } else if (t && t.path) {
                      window.location.href = t.path;
                    }
                  }}
                  className="btn-primary"
                >
                  Open link
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
