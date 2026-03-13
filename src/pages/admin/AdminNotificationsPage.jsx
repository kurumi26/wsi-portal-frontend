import { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCheck, MailOpen, Trash2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { usePortal } from '../../context/PortalContext';
import { formatDateTime } from '../../utils/format';

const NOTIFICATIONS_PER_PAGE = 6;

export default function AdminNotificationsPage() {
  const { notifications, updateNotificationStatus, markAllNotificationsRead, dismissNotification } = usePortal();
  const [filter, setFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const filters = ['All', 'Unread', 'Read', 'info', 'warning', 'success', 'danger'];

  const filteredNotifications = useMemo(() => {
    if (filter === 'All') {
      return notifications;
    }

    if (filter === 'Unread') {
      return notifications.filter((item) => !item.isRead);
    }

    if (filter === 'Read') {
      return notifications.filter((item) => item.isRead);
    }

    return notifications.filter((item) => item.type === filter);
  }, [notifications, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / NOTIFICATIONS_PER_PAGE));
  const paginatedNotifications = filteredNotifications.slice((currentPage - 1) * NOTIFICATIONS_PER_PAGE, currentPage * NOTIFICATIONS_PER_PAGE);
  const allVisibleSelected = paginatedNotifications.length > 0 && paginatedNotifications.every((item) => selectedIds.includes(item.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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

    setSelectedNotification({
      ...notification,
      isRead: true,
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Admin Alerts"
        title="Notifications center"
        description="Track operational events, customer purchase activity, and system alerts from the admin portal."
        action={
          notifications.length ? (
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
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-slate-400">Total alerts</p>
          <p className="mt-3 text-3xl font-semibold text-white">{notifications.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-400">Unread</p>
          <p className="mt-3 text-3xl font-semibold text-white">{unreadCount}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-slate-400">Read</p>
          <p className="mt-3 text-3xl font-semibold text-white">{notifications.length - unreadCount}</p>
        </div>
      </div>

      <div className="mb-6 panel p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={filter === item ? 'btn-primary px-3 py-2' : 'btn-secondary px-3 py-2'}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-blue-500"
            />
            Select current page
          </label>
        </div>
      </div>

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
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.isRead ? 'bg-white/5 text-slate-400' : 'bg-orange-400/15 text-orange-300'}`}>
                  <BellRing size={18} />
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenNotification(item)}
                  className="min-w-0 text-left"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-medium text-white">{item.title}</p>
                    {!item.isRead ? <span className="badge bg-orange-400/10 text-orange-300">New</span> : null}
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
              <button
                type="button"
                onClick={async () => {
                  await updateNotificationStatus(selectedNotification.id, false);
                  setSelectedNotification((current) => (current ? { ...current, isRead: false } : current));
                }}
                className="btn-secondary"
              >
                Mark unread
              </button>
              <button
                type="button"
                onClick={async () => {
                  await dismissNotification(selectedNotification.id);
                  setSelectedNotification(null);
                }}
                className="btn-secondary"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
