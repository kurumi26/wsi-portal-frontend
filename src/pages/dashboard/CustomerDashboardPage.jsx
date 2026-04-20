import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import { CircleAlert, BellRing, FolderKanban, LayoutGrid, List, Plus, ReceiptText, ShieldCheck, CreditCard, CheckCircle2, FileText, Headphones, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { extractAddonEntries, getAddonBillingCycleLabel, getAddonExpirationMeta, matchCatalogService } from '../../utils/addons';
import { getRenewalCountdownMeta, getServiceDisplayStatus, hasRenewalCountdown } from '../../utils/services';

const SERVICES_PER_PAGE = 6;

export default function CustomerDashboardPage() {
  const { myServices, notifications, orders, stats, requestServiceCancellation, reportServiceIssue, addToCart, services, refreshPortalData } = usePortal();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('All');
  const [layoutMode, setLayoutMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedCancellationService, setSelectedCancellationService] = useState(null);
  const [selectedAgreementService, setSelectedAgreementService] = useState(null);
  const [selectedSupportService, setSelectedSupportService] = useState(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [isReportingSupport, setIsReportingSupport] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isRequestingCancellation, setIsRequestingCancellation] = useState(false);
  const [dashboardModal, setDashboardModal] = useState(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [approvedBannerVisible, setApprovedBannerVisible] = useState(false);
  const [approvedBannerMessage, setApprovedBannerMessage] = useState('');
  const [dismissedBannerKey, setDismissedBannerKey] = useState(null);
  const BANNER_DISMISS_KEY = 'wsi-dashboard-dismissed-banner';

  const filters = ['All', 'Expiring Soon', 'Active', 'Undergoing Provisioning', 'Unpaid', 'Expired'];

  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  const statusMenuRef = useRef(null);
  const [statusMenuStyle, setStatusMenuStyle] = useState(null);

  useEffect(() => {
    if (!myServices.some((service) => hasRenewalCountdown(service))) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [myServices]);

  const filteredServices = useMemo(() => {
    const serviceStatusPriority = {
      'Expiring Soon': 0,
      Active: 1,
      'Undergoing Provisioning': 2,
      Unpaid: 3,
      Expired: 4,
    };

    const visibleServices = myServices.filter((service) => {
      if (statusFilter === 'All') {
        return true;
      }

      return getServiceDisplayStatus(service, countdownNow) === statusFilter;
    });

    return [...visibleServices].sort((left, right) => {
      const leftStatus = getServiceDisplayStatus(left, countdownNow);
      const rightStatus = getServiceDisplayStatus(right, countdownNow);
      const priorityDelta = (serviceStatusPriority[leftStatus] ?? Number.MAX_SAFE_INTEGER)
        - (serviceStatusPriority[rightStatus] ?? Number.MAX_SAFE_INTEGER);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      if (leftStatus === 'Expiring Soon' && rightStatus === 'Expiring Soon') {
        return new Date(left.renewsOn).getTime() - new Date(right.renewsOn).getTime();
      }

      if (hasRenewalCountdown(left) && hasRenewalCountdown(right)) {
        const renewalDelta = new Date(left.renewsOn).getTime() - new Date(right.renewsOn).getTime();

        if (renewalDelta !== 0) {
          return renewalDelta;
        }
      }

      return String(left.name ?? '').localeCompare(String(right.name ?? ''));
    });
  }, [myServices, statusFilter, countdownNow]);
  const approvalPendingOrders = orders.filter((o) => /pending/i.test(String(o.status)));
  const approvalPendingServices = approvalPendingOrders.map((o) => o.serviceName).filter(Boolean);
  const prevApprovalRef = useRef(approvalPendingOrders);
  // filter out approvals where the service has already been created and is provisioning/active
  const approvalPendingServicesFiltered = approvalPendingServices.filter((name) =>
    !myServices.some((s) => s.name === name && ['Undergoing Provisioning', 'Active'].includes(s.status)),
  );

  const unpaidRaw = myServices.filter((service) => service.status === 'Unpaid');
  // Exclude unpaid entries that have a matching pending order (payment received awaiting approval)
  const unpaidFiltered = unpaidRaw.filter((service) => {
    if (approvalPendingServices.includes(service.name)) return false;
    if (
      approvalPendingOrders.some(
        (o) => (o.serviceId && String(o.serviceId) === String(service.id)) || (o.serviceName && o.serviceName === service.name),
      )
    )
      return false;
    return true;
  });

  // Deduplicate by service name and remove names that already have a provisioning/active sibling record
  const unpaidNames = Array.from(new Set(unpaidFiltered.map((s) => s.name)));
  const unpaidNamesFinal = unpaidNames.filter(
    (name) => !myServices.some((s) => s.name === name && ['Undergoing Provisioning', 'Active'].includes(s.status) && s.status !== 'Unpaid'),
  );
  const unpaidRepresentative = unpaidFiltered.find((s) => unpaidNamesFinal.includes(s.name));

  const now = countdownNow;
  const NEAR_EXPIRE_DAYS = 7;
  const formatTimeRemaining = (value) => {
    if (!value) return '';
    const ms = new Date(value).getTime() - countdownNow;
    if (ms <= 0) return 'expired';
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    if (days >= 1) return `${days} day${days > 1 ? 's' : ''} left`;
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    const minutes = Math.ceil(ms / (60 * 1000));
    if (minutes >= 1) return `${minutes} minute${minutes > 1 ? 's' : ''} left`;
    return 'less than a minute left';
  };
  const formatCountdownTimer = (value) => {
    if (!value) return '';

    const ms = new Date(value).getTime() - countdownNow;

    if (ms <= 0) {
      return '00d 00h 00m 00s';
    }

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    return [days, hours, minutes, seconds]
      .map((part, index) => `${String(part).padStart(2, '0')}${['d', 'h', 'm', 's'][index]}`)
      .join(' ');
  };
  const nearExpiredServices = useMemo(
    () => myServices
      .filter((service) => {
        if (!hasRenewalCountdown(service)) return false;
        const t = new Date(service.renewsOn).getTime() - now;
        return t > 0 && t <= NEAR_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
      })
      .filter((service) => getServiceDisplayStatus(service, now) !== 'Expired')
      .sort((left, right) => new Date(left.renewsOn).getTime() - new Date(right.renewsOn).getTime()),
    [myServices, now],
  );
  const serviceAddonEntriesById = useMemo(() => {
    return new Map(
      myServices.map((service) => {
        const catalogService = matchCatalogService(service, services);

        return [
          String(service.id),
          extractAddonEntries(service, {
            catalogService,
            fallbackToAddonsKey: true,
          }),
        ];
      }),
    );
  }, [myServices, services]);
  const getServiceAddonEntries = (service) => serviceAddonEntriesById.get(String(service?.id)) ?? [];
  const isExpiringNotification = (item) => Boolean(
    item
    && (
      /renewal upcoming|expiring soon/i.test(item.title ?? '')
      || /will renew in|is expiring in|expires in/i.test(item.message ?? '')
    )
  );
  const latestOperationalNotification = notifications.find((item) => ['warning', 'info', 'danger'].includes(item.type));
  const latestOperationalIsCritical = Boolean(
    latestOperationalNotification
    && (
      latestOperationalNotification.type === 'danger'
      || isExpiringNotification(latestOperationalNotification)
    )
  );
  const latestOperationalIsExpiring = isExpiringNotification(latestOperationalNotification);
  const getNotificationVisual = (item, forceCritical = false) => {
    const isCritical = forceCritical || item?.type === 'danger';
    const isWarning = !isCritical && item?.type === 'warning';
    const isSuccess = !isCritical && item?.type === 'success';

    if (isCritical) {
      return {
        Icon: CircleAlert,
        iconClassName: 'bg-red-500 text-white shadow-sm shadow-red-900/15',
        strokeWidth: 2.25,
        stroke: '#ffffff',
      };
    }

    if (isWarning) {
      return {
        Icon: CreditCard,
        iconClassName: 'border border-amber-200/80 bg-amber-100 text-amber-600 shadow-sm shadow-amber-900/5',
        strokeWidth: 2,
        stroke: '#d97706',
      };
    }

    if (isSuccess) {
      return {
        Icon: CheckCircle2,
        iconClassName: 'border border-emerald-200/80 bg-emerald-100 text-emerald-600 shadow-sm shadow-emerald-900/5',
        strokeWidth: 2,
        stroke: '#059669',
      };
    }

    return {
      Icon: BellRing,
      iconClassName: 'border border-sky-200/80 bg-sky-100 text-sky-600 shadow-sm shadow-sky-900/5',
      strokeWidth: 2,
      stroke: '#2563eb',
    };
  };
  const latestExpiringService = useMemo(() => {
    if (!latestOperationalNotification || !latestOperationalIsExpiring) {
      return null;
    }

    const notificationServiceId = latestOperationalNotification?.data?.serviceId
      ?? latestOperationalNotification?.serviceId
      ?? latestOperationalNotification?.service_id;

    if (notificationServiceId != null) {
      const matchedById = myServices.find((service) => (
        String(service.id) === String(notificationServiceId)
        || String(service.service_id) === String(notificationServiceId)
      ));

      if (matchedById) {
        return matchedById;
      }
    }

    const normalizedTitle = String(latestOperationalNotification.title ?? '').toLowerCase();

    return nearExpiredServices.find((service) => normalizedTitle.includes(String(service.name ?? '').toLowerCase()))
      ?? nearExpiredServices[0]
      ?? null;
  }, [latestOperationalNotification, latestOperationalIsExpiring, myServices, nearExpiredServices]);
  const latestOperationalVisual = latestOperationalNotification
    ? getNotificationVisual(latestOperationalNotification, latestOperationalIsCritical)
    : null;
  const latestOperationalCountdownTarget = latestExpiringService?.renewsOn
    ?? latestOperationalNotification?.data?.renewsOn
    ?? latestOperationalNotification?.renewsOn
    ?? latestOperationalNotification?.expiresAt
    ?? latestOperationalNotification?.expires_at
    ?? (latestOperationalIsExpiring ? latestOperationalNotification?.createdAt : null);
  const latestOperationalCountdown = latestOperationalCountdownTarget
    ? formatCountdownTimer(latestOperationalCountdownTarget)
    : '';
  const expiringOperationalVisual = getNotificationVisual({ type: 'danger' }, true);
  const expiringAlertSummary = nearExpiredServices
    .slice(0, 3)
    .map((service) => `${service.name} (${formatTimeRemaining(service.renewsOn)})`)
    .join(', ');
  const topOperationalAlert = nearExpiredServices.length
    ? {
        title: nearExpiredServices.length === 1
          ? `${nearExpiredServices[0].name} expiring soon`
          : `${nearExpiredServices.length} services expiring soon`,
        message: nearExpiredServices.length === 1
          ? `${nearExpiredServices[0].name} is expiring in ${formatTimeRemaining(nearExpiredServices[0].renewsOn)}.`
          : `Services nearing renewal: ${expiringAlertSummary}${nearExpiredServices.length > 3 ? ` +${nearExpiredServices.length - 3} more` : ''}.`,
        countdown: formatCountdownTimer(nearExpiredServices[0].renewsOn),
        countdownLabel: nearExpiredServices.length > 1 ? 'Next expiry:' : 'Time left:',
        isCritical: true,
        visual: expiringOperationalVisual,
      }
    : latestOperationalNotification
      ? {
          title: latestOperationalNotification.title,
          message: latestOperationalNotification.message,
          countdown: latestOperationalCountdown,
          countdownLabel: 'Time left:',
          isCritical: latestOperationalIsCritical,
          visual: latestOperationalVisual,
        }
      : null;
  const bannerSvc = unpaidRepresentative ?? nearExpiredServices[0];
  const bannerHasPending = Boolean(
    bannerSvc && approvalPendingOrders.some((o) => (o.serviceId && String(o.serviceId) === String(bannerSvc.id)) || (o.serviceName && o.serviceName === bannerSvc.name)),
  );
  const bannerIsApproved = Boolean(
    bannerSvc && orders.some((o) => /approved/i.test(String(o.status)) && ((o.serviceId && String(o.serviceId) === String(bannerSvc.id)) || (o.serviceName && o.serviceName === bannerSvc.name))),
  );
  // Treat orders marked as paid as approved as well (backend uses 'paid' after admin approval)
  const bannerIsPaid = Boolean(
    bannerSvc && orders.some((o) => (o.statusKey === 'paid' || /paid/i.test(String(o.status))) && ((o.serviceId && String(o.serviceId) === String(bannerSvc.id)) || (o.serviceName && o.serviceName === bannerSvc.name))),
  );
  // Compute a stable key for the currently visible banner so users can dismiss it
  const currentBannerKey = bannerSvc
    ? (bannerIsApproved || bannerIsPaid)
      ? `approved-${bannerSvc.id ?? bannerSvc.name}`
      : (unpaidNamesFinal.length || nearExpiredServices.length)
      ? `critical-${bannerSvc.id ?? bannerSvc.name}`
      : (!unpaidNamesFinal.length && !nearExpiredServices.length && approvalPendingServicesFiltered.length)
      ? `pending-${approvalPendingServicesFiltered.join(',')}`
      : null
    : null;
  const hasCancellationReason = cancellationReason.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(filteredServices.length / SERVICES_PER_PAGE));
  const paginatedServices = filteredServices.slice((currentPage - 1) * SERVICES_PER_PAGE, currentPage * SERVICES_PER_PAGE);

  const getRecordTimestamp = (record) => {
    const value = record?.createdAt ?? record?.date ?? record?.updatedAt ?? 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const expiringAlertPreviewItems = useMemo(
    () => nearExpiredServices.map((service) => ({
      id: `current-expiring-${service.id}`,
      title: `${service.name} expiring soon`,
      message: `${service.name} is expiring in ${formatTimeRemaining(service.renewsOn)}.`,
      createdAt: service.renewsOn ?? new Date().toISOString(),
      isRead: false,
      type: 'danger',
      data: { serviceId: service.id, renewsOn: service.renewsOn },
      isDerived: true,
    })),
    [nearExpiredServices, countdownNow],
  );

  const alertPreviewItems = useMemo(
    () => {
      const remainingNotifications = nearExpiredServices.length
        ? notifications.filter((item) => !isExpiringNotification(item))
        : notifications;

      const sortedNotifications = [...remainingNotifications]
        .sort((left, right) => getRecordTimestamp(right) - getRecordTimestamp(left));

      return [...expiringAlertPreviewItems, ...sortedNotifications].slice(0, 6);
    },
    [expiringAlertPreviewItems, nearExpiredServices.length, notifications],
  );

  const pendingApprovalPreviewOrders = useMemo(
    () => [...approvalPendingOrders].sort((left, right) => getRecordTimestamp(right) - getRecordTimestamp(left)).slice(0, 6),
    [approvalPendingOrders],
  );

  const approvedPreviewOrders = useMemo(
    () => [...orders]
      .filter((order) => order.statusKey === 'paid' || /approved|paid/i.test(String(order.status)))
      .sort((left, right) => getRecordTimestamp(right) - getRecordTimestamp(left))
      .slice(0, 6),
    [orders],
  );

  const allPreviewOrders = useMemo(
    () => [...orders].sort((left, right) => getRecordTimestamp(right) - getRecordTimestamp(left)).slice(0, 6),
    [orders],
  );

  const openAlertsModal = () => setDashboardModal({ type: 'alerts' });
  const openOrdersModal = (scope = 'all') => setDashboardModal({ type: 'orders', scope });
  const closeDashboardModal = () => setDashboardModal(null);

  const orderModalConfig = useMemo(() => {
    if (dashboardModal?.type !== 'orders') {
      return null;
    }

    if (dashboardModal.scope === 'pending') {
      return {
        title: 'Orders awaiting approval',
        subtitle: 'Payments received and waiting for admin review.',
        items: pendingApprovalPreviewOrders,
      };
    }

    if (dashboardModal.scope === 'approved') {
      return {
        title: 'Recently approved orders',
        subtitle: 'Orders that are already approved or marked paid.',
        items: approvedPreviewOrders,
      };
    }

    return {
      title: 'Recent orders',
      subtitle: 'Your latest order activity in the portal.',
      items: allPreviewOrders,
    };
  }, [allPreviewOrders, approvedPreviewOrders, dashboardModal, pendingApprovalPreviewOrders]);

  useEffect(() => {
    if (!dashboardModal || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dashboardModal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, layoutMode]);

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

  // Ensure data is fresh when the dashboard mounts so status banners reflect admin actions
  useEffect(() => {
    try {
      refreshPortalData();
    } catch (e) {
      // ignore
    }
  }, []);

  // Notify the user when admin approves a pending payment (pending list shrinks)
  useEffect(() => {
    try {
      const prev = prevApprovalRef.current || [];
      const prevIds = prev.map((p) => p.id);
      const currIds = approvalPendingOrders.map((p) => p.id);

      if (prevIds.length > currIds.length) {
        // find which order(s) were removed
        const removed = prev.find((p) => !currIds.includes(p.id));
        const svcName = removed?.serviceName || `order #${removed?.id}`;
        setToastMessage(`Payment for ${svcName} approved by admin. Provisioning will begin shortly.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 6000);
        // Ensure portal data (services/orders) are refreshed so banners and lists update
        (async () => {
          try {
            await refreshPortalData();
          } catch (err) {
            // ignore
          }
        })();
        // show a temporary approved banner
        setApprovedBannerMessage(`Your order ${removed?.orderNumber ?? removed?.id} has been approved by admin.`);
        setApprovedBannerVisible(true);
        setTimeout(() => setApprovedBannerVisible(false), 8000);
      }
    } catch (e) {
      // ignore
    } finally {
      prevApprovalRef.current = approvalPendingOrders;
    }
  }, [approvalPendingOrders]);

  // If there are orders awaiting admin approval, poll for updates so the UI reflects admin actions quickly
  useEffect(() => {
    if (!approvalPendingOrders.length) return undefined;

    const iv = setInterval(() => {
      try {
        refreshPortalData();
      } catch (e) {
        // ignore
      }
    }, 8000);

    return () => clearInterval(iv);
  }, [approvalPendingOrders.length]);

  // Restore persisted dismissed banner for this browser (persist across refresh)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BANNER_DISMISS_KEY);
      if (stored && currentBannerKey && stored === currentBannerKey) {
        setDismissedBannerKey(stored);
      } else {
        // reset dismissal when banner key changes
        setDismissedBannerKey(null);
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }, [currentBannerKey]);

  const dismissBanner = (key) => {
    try {
      window.localStorage.setItem(BANNER_DISMISS_KEY, key ?? '');
    } catch (e) {
      // ignore
    }
    setDismissedBannerKey(key);
  };

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div>
      <PageHeader
        eyebrow="Customer Dashboard"
        title="Account Overview"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link to="/dashboard/services" className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
          <StatCard
            label="Purchased Services"
            value={myServices.length}
            helper="Across hosting, security, and domain products"
            accent="cyan"
            className="h-full cursor-pointer transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-slate-950/15"
          />
        </Link>
        <Link to="/dashboard/services" state={{ statusFilter: 'Active' }} className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
          <StatCard
            label="Active Services"
            value={stats.activeServices}
            helper="Live customer environments"
            accent="emerald"
            className="h-full cursor-pointer transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-slate-950/15"
          />
        </Link>
        <Link to="/dashboard/billing" className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
          <StatCard
            label="Monthly Spend"
            value={formatCurrency(stats.totalRevenue / Math.max(orders.length, 1))}
            helper="Average payment amount"
            accent="violet"
            className="h-full cursor-pointer transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-slate-950/15"
          />
        </Link>
        <Link to="/dashboard/orders" className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
          <StatCard
            label="Orders Logged"
            value={orders.length}
            helper="Recorded purchase history in phase 1"
            accent="amber"
            className="h-full cursor-pointer transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl hover:shadow-slate-950/15"
          />
        </Link>
      </div>

      <div className="mt-6 space-y-6">
        <div className="space-y-3">
          {(bannerIsApproved || bannerIsPaid) && dismissedBannerKey !== currentBannerKey ? (
            <div className="rounded-3xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-4 shadow-sm shadow-emerald-900/10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700">Order approved</p>
                    <p className="text-sm text-emerald-800">An approved order exists for the service shown. Provisioning will begin shortly.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => openOrdersModal('approved')} className="btn-secondary px-4 py-2">View Orders</button>
                  <button type="button" onClick={() => setDismissedBannerKey(currentBannerKey)} aria-label="Dismiss banner" className="ml-2 rounded px-3 py-2 text-slate-300 hover:text-white">×</button>
                </div>
              </div>
            </div>
          ) : (unpaidNamesFinal.length || nearExpiredServices.length) && dismissedBannerKey !== currentBannerKey ? (
            <div className="rounded-3xl border border-red-400/35 bg-red-400/10 px-4 py-4 shadow-sm shadow-red-900/10 alert-danger">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500 text-white shadow-sm shadow-red-900/15">
                    <CircleAlert size={18} strokeWidth={2.25} stroke="#ffffff" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-300">Critical Action Required</p>
                    <p className="text-sm text-red-200">
                      {unpaidNamesFinal.length ? `${unpaidNamesFinal.length} service${unpaidNamesFinal.length > 1 ? 's are' : ' is'} currently unpaid.` : ''}
                      {unpaidNamesFinal.length && nearExpiredServices.length ? ' ' : ''}
                      {nearExpiredServices.length ? `${nearExpiredServices.length} ${nearExpiredServices.length > 1 ? 'services are' : 'service is'} expiring soon.` : ''}
                      {' '}Please settle outstanding dues or renew services that are expiring soon to avoid service disruption.
                    </p>
                    <div className="mt-1 text-sm text-red-100/90">
                      {unpaidNamesFinal.length ? (
                        <p className="truncate">Unpaid: {unpaidNamesFinal.slice(0,3).join(', ')}{unpaidNamesFinal.length > 3 ? ` +${unpaidNamesFinal.length - 3} more` : ''}</p>
                      ) : null}
                      {nearExpiredServices.length ? (
                        <p className="truncate">Expiring soon: {nearExpiredServices.map((s) => `${s.name} (${formatTimeRemaining(s.renewsOn)})`).slice(0,3).join(', ')}{nearExpiredServices.length > 3 ? ` +${nearExpiredServices.length - 3} more` : ''}</p>
                      ) : null}
                      {approvalPendingServicesFiltered.length ? (
                        <p className="truncate">Payment received (awaiting admin approval): {approvalPendingServicesFiltered.slice(0,3).join(', ')}{approvalPendingServicesFiltered.length > 3 ? ` +${approvalPendingServicesFiltered.length - 3} more` : ''}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setDismissedBannerKey(currentBannerKey)} aria-label="Dismiss banner" className="rounded px-3 py-2 text-slate-300 hover:text-white">×</button>
                      {bannerHasPending ? (
                        <button type="button" onClick={() => openOrdersModal('pending')} className="btn-secondary px-4 py-2">
                          Payment pending approval
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              // pick unpaid first (representative), otherwise a near-expiring service
                              const svc = unpaidRepresentative ?? nearExpiredServices[0];
                              if (svc) {
                                const catalog = services.find((s) => s.id === svc.service_id || s.id === svc.id || s.name === svc.name);
                                const item = {
                                  id: catalog?.id ?? svc.service_id ?? svc.id,
                                  name: catalog?.name ?? svc.name,
                                  category: catalog?.category ?? svc.category ?? 'Service',
                                  price: catalog?.price ?? svc.price ?? 0,
                                  billing: catalog?.billing ?? svc.billing ?? {},
                                  configurations: catalog?.configurations ?? svc.configurations ?? [],
                                  addons: catalog?.addons ?? svc.addons ?? [],
                                };

                                // If there's already a pending admin approval order for this service, don't add to cart
                                const alreadyPending = approvalPendingOrders.some((o) =>
                                  (o.serviceId && String(o.serviceId) === String(svc.id)) || (o.serviceName && o.serviceName === svc.name),
                                );
                                if (alreadyPending) {
                                  setToastMessage('Payment already received and is pending admin approval.');
                                  setShowToast(true);
                                  setTimeout(() => setShowToast(false), 4000);
                                  navigate('/dashboard/orders');
                                  return;
                                }

                                addToCart(item, item.configurations?.[0] ?? 'Standard', item.addons?.[0] ?? '');

                                // Refresh portal data so banners reflect this action immediately
                                (async () => {
                                  try {
                                    await refreshPortalData();
                                  } catch (err) {
                                    // ignore
                                  }
                                })();
                              }
                              navigate('/checkout');
                            } catch (e) {
                              navigate('/checkout');
                            }
                          }}
                          className="btn-primary px-4 py-2"
                        >
                          {unpaidNamesFinal.length ? 'Settle Now' : 'Renew Now'}
                        </button>
                      )}
                    </div>
              </div>
            </div>
          ) : null}
          {approvedBannerVisible ? (
            <div className="rounded-3xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-4 shadow-sm shadow-emerald-900/10">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700">Order approved</p>
                    <p className="text-sm text-emerald-800">{approvedBannerMessage}</p>
                  </div>
                </div>
                <div>
                  <button type="button" onClick={() => openOrdersModal('approved')} className="btn-secondary px-5 py-2">View Orders</button>
                </div>
              </div>
            </div>
          ) : null}
          {topOperationalAlert ? (
            <div className={`rounded-3xl px-4 py-4 shadow-sm ${topOperationalAlert.isCritical ? 'border border-red-400/35 bg-red-400/10 shadow-red-900/10 alert-danger' : 'border border-amber-300/40 bg-amber-300/20 shadow-amber-900/10 alert-warning'}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl ${topOperationalAlert.visual?.iconClassName ?? ''}`}>
                    {topOperationalAlert.visual ? <topOperationalAlert.visual.Icon size={18} strokeWidth={topOperationalAlert.visual.strokeWidth} stroke={topOperationalAlert.visual.stroke} /> : null}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`font-semibold ${topOperationalAlert.isCritical ? 'text-red-200' : 'text-amber-100'}`}>{topOperationalAlert.title}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${topOperationalAlert.isCritical ? 'text-red-100/90' : 'text-amber-50/90'}`}>
                        {topOperationalAlert.message}
                        {topOperationalAlert.countdown ? (
                          <span className={`ml-2 font-medium ${topOperationalAlert.isCritical ? 'text-red-200' : 'text-amber-100'}`}>
                            {topOperationalAlert.countdownLabel}{' '}
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 shadow-sm ${topOperationalAlert.isCritical ? 'border-red-200/70 bg-white/85 text-red-700' : 'border-amber-200/70 bg-white/85 text-amber-700'}`}>
                              {topOperationalAlert.countdown}
                            </span>
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={openAlertsModal} className="btn-secondary whitespace-nowrap px-5 py-2">
                  View Alerts
                </button>
              </div>
            </div>
          ) : null}
          {/* Show a dedicated banner when payment was received and is awaiting admin approval */}
          {!unpaidNamesFinal.length && !nearExpiredServices.length && approvalPendingServicesFiltered.length ? (
            <div className="rounded-3xl border border-amber-300/40 bg-amber-300/10 px-4 py-4 shadow-sm shadow-amber-900/10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-slate-950">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-700">Payment pending admin approval</p>
                    <p className="text-sm text-amber-800">We received payment for {approvalPendingServicesFiltered.slice(0,3).join(', ')}{approvalPendingServicesFiltered.length > 3 ? ` +${approvalPendingServicesFiltered.length - 3} more` : ''}. Admin review is pending; provisioning will begin after approval.</p>
                  </div>
                </div>
                <button type="button" onClick={() => openOrdersModal('pending')} className="btn-secondary whitespace-nowrap px-5 py-2">View Orders</button>
              </div>
            </div>
          ) : null}
        </div>

        <section className="panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FolderKanban className="text-sky-300" />
                <h2 className="text-xl font-semibold text-white">Service Status</h2>
              </div>

              <Link to="/services" className="btn-primary inline-flex items-center gap-2 px-4 py-2">
                <Plus size={16} />
                Add Service
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <div className="relative" ref={statusRef}>
                <button
                  type="button"
                  onClick={() => setStatusOpen((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
                >
                  <span className="text-sm text-slate-200">{statusFilter}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {statusOpen && statusMenuStyle
                  ? createPortal(
                      <div ref={statusMenuRef} style={statusMenuStyle} className="rounded-lg border border-white/6 bg-slate-900 shadow">
                        {filters.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setStatusFilter(item);
                              setStatusOpen(false);
                              setCurrentPage(1);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                          >
                            {item}
                          </button>
                        ))}
                      </div>,
                      document.body,
                    )
                  : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLayoutMode('list')}
                  className={layoutMode === 'list' ? 'btn-primary px-3 py-2' : 'btn-secondary px-3 py-2'}
                  aria-label="List layout"
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('grid')}
                  className={layoutMode === 'grid' ? 'btn-primary px-3 py-2' : 'btn-secondary px-3 py-2'}
                  aria-label="Grid layout"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className={layoutMode === 'grid' ? 'mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'mt-6 space-y-4'}>
            {paginatedServices.map((service) => {
              const serviceDisplayStatus = getServiceDisplayStatus(service, countdownNow);
              const isDisplayActive = serviceDisplayStatus === 'Active' || serviceDisplayStatus === 'Expiring Soon';
              const addonEntries = getServiceAddonEntries(service);
              const visibleAddonEntries = addonEntries.slice(0, 2);

              return (
              <div
                key={service.id}
                className={`panel-muted p-4 group relative overflow-hidden ${
                  layoutMode === 'grid' ? 'flex h-full flex-col justify-between gap-5' : 'flex flex-col gap-4 md:flex-row md:items-center md:justify-between'
                }`}
                style={layoutMode === 'list' ? { height: '110px' } : {}}
              >
                <div>
                  <p className="text-lg font-medium text-white">{service.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{service.category} · Plan: {service.plan}</p>
                  {addonEntries.length ? (
                    layoutMode === 'grid' ? (
                      <div className="mt-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected Add-ons</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {visibleAddonEntries.map((addonEntry) => (
                            <span key={`${service.id}-${addonEntry.label}`} className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                              {addonEntry.label} • {getAddonBillingCycleLabel(addonEntry.billingCycle, 'Recurring')}
                            </span>
                          ))}
                          {addonEntries.length > visibleAddonEntries.length ? (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
                              +{addonEntries.length - visibleAddonEntries.length} more
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        Add-ons: {visibleAddonEntries.map((addonEntry) => `${addonEntry.label} (${getAddonBillingCycleLabel(addonEntry.billingCycle, 'Recurring')})`).join(', ')}
                        {addonEntries.length > visibleAddonEntries.length ? ` +${addonEntries.length - visibleAddonEntries.length} more` : ''}
                      </p>
                    )
                  ) : null}
                </div>
                <div className={`flex ${layoutMode === 'grid' ? 'items-end justify-between' : 'items-center gap-4'}`}>
                  <div className={`text-sm text-slate-400 ${layoutMode === 'grid' ? '' : 'text-right'}`}>
                    {(() => {
                      const renewalMeta = getRenewalCountdownMeta(service);

                      if (renewalMeta.isInteractive) {
                        return (
                          <>
                            <p>{renewalMeta.label}</p>
                            <button
                              type="button"
                              onClick={() => setSelectedSchedule({
                                title: service.name,
                                subtitle: `${service.category} • ${service.plan}`,
                                label: 'Renewal Schedule',
                                value: renewalMeta.value,
                              })}
                              className="mt-1 text-left text-white underline decoration-sky-400/40 underline-offset-4 transition hover:text-sky-200"
                            >
                              {formatDateTime(renewalMeta.value)}
                            </button>
                            <div className="mt-1 text-xs text-slate-400">{formatTimeRemaining(renewalMeta.value)}</div>
                          </>
                        );
                      }

                      return (
                        <>
                          <p>{renewalMeta.label}</p>
                          <p className="mt-1 text-white">{renewalMeta.value}</p>
                          <div className="mt-1 text-xs text-slate-400">{renewalMeta.helper}</div>
                        </>
                      );
                    })()}
                  </div>
                  <StatusBadge status={serviceDisplayStatus} />
                </div>

                {/* Hover overlay: status-specific CTA / icons for customers */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition">
                  {/* Blurred/dim background */}
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-all"></div>
                  <div className="relative pointer-events-auto flex flex-col items-center">
                    {service.status === 'Unpaid' ? (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const catalog = services.find((s) => s.id === service.service_id || s.id === service.id || s.name === service.name);
                            const item = {
                              id: catalog?.id ?? service.service_id ?? service.id,
                              name: catalog?.name ?? service.name,
                              category: catalog?.category ?? service.category ?? 'Service',
                              price: catalog?.price ?? service.price ?? 0,
                              billing: catalog?.billing ?? service.billing ?? {},
                              configurations: catalog?.configurations ?? service.configurations ?? [],
                              addons: catalog?.addons ?? service.addons ?? [],
                            };
                            // If there's already a pending admin approval order for this service, don't add to cart
                            const alreadyPending = approvalPendingOrders.some((o) =>
                              (o.serviceId && String(o.serviceId) === String(service.id)) || (o.serviceName && o.serviceName === service.name),
                            );
                            if (alreadyPending) {
                              setToastMessage('Payment already received and is pending admin approval.');
                              setShowToast(true);
                              setTimeout(() => setShowToast(false), 4000);
                              navigate('/dashboard/orders');
                            } else {
                              addToCart(item, item.configurations?.[0] ?? 'Standard', item.addons?.[0] ?? '');

                              (async () => {
                                try {
                                  await refreshPortalData();
                                } catch (err) {
                                  // ignore
                                }
                              })();
                            }
                          } catch (e) {
                            // ignore
                          }
                          navigate('/checkout');
                        }}
                        className="btn-primary whitespace-nowrap px-6 py-2"
                      >
                        Pay Now
                      </button>
                    ) : isDisplayActive ? (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-3 mb-3">
                          {/* <button
                            title="Service support"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900"
                            onClick={() => setSelectedSupportService(service)}
                          >
                            <Headphones size={16} />
                          </button> */}

                          <button
                            title="View orders"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900"
                            onClick={() => navigate('/dashboard/orders')}
                          >
                            <CheckCircle2 size={16} />
                          </button>

                          <button
                            title="View service agreement"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900"
                            onClick={() => setSelectedAgreementService(service)}
                          >
                            <FileText size={16} />
                          </button>
                        </div>
                        <button
                          className="inline-flex items-center justify-center rounded-full bg-red-500 text-white px-5 py-2 font-semibold shadow-sm hover:bg-red-600 transition"
                          onClick={() => setSelectedCancellationService(service)}
                          disabled={Boolean(service.cancellationRequest?.statusKey === 'pending')}
                        >
                          {service.cancellationRequest?.statusKey === 'pending' ? 'Cancellation Pending' : 'Cancel Service'}
                        </button>
                      </div>
                    ) : service.status === 'Undergoing Provisioning' ? (
                      <div className="flex items-center gap-3">
                        {/* <button
                          title="Service support"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900"
                          onClick={() => setSelectedSupportService(service)}
                        >
                          <Headphones size={16} />
                        </button> */}

                        <button
                          title="View orders"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900"
                          onClick={() => navigate('/dashboard/orders')}
                        >
                          <CheckCircle2 size={16} />
                        </button>

                        <button
                          title="View service agreement"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900"
                          onClick={() => setSelectedAgreementService(service)}
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    ) : serviceDisplayStatus === 'Expired' ? (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const catalog = services.find((s) => s.id === service.service_id || s.id === service.id || s.name === service.name);
                            const item = {
                              id: catalog?.id ?? service.service_id ?? service.id,
                              name: catalog?.name ?? service.name,
                              category: catalog?.category ?? service.category ?? 'Service',
                              price: catalog?.price ?? service.price ?? 0,
                              billing: catalog?.billing ?? service.billing ?? {},
                              configurations: catalog?.configurations ?? service.configurations ?? [],
                              addons: catalog?.addons ?? service.addons ?? [],
                            };
                            // If there's already a pending admin approval order for this service, don't add to cart
                            const alreadyPending = approvalPendingOrders.some((o) =>
                              (o.serviceId && String(o.serviceId) === String(service.id)) || (o.serviceName && o.serviceName === service.name),
                            );
                            if (alreadyPending) {
                              setToastMessage('Payment already received and is pending admin approval.');
                              setShowToast(true);
                              setTimeout(() => setShowToast(false), 4000);
                              navigate('/dashboard/orders');
                            } else {
                              addToCart(item, item.configurations?.[0] ?? 'Standard', item.addons?.[0] ?? '');

                              (async () => {
                                try {
                                  await refreshPortalData();
                                } catch (err) {
                                  // ignore
                                }
                              })();
                            }
                          } catch (e) {
                            // ignore and continue to checkout
                          }
                          navigate('/checkout');
                        }}
                        className="btn-primary whitespace-nowrap px-6 py-2"
                      >
                        Renew Now
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );})}

            {!filteredServices.length ? (
              <div className="panel-muted p-8 text-center text-sm text-slate-400">
                No services match the selected filter.
              </div>
            ) : null}
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </section>

        <section>
          <div className="panel p-6">
            <div className="flex items-center gap-3">
              <ReceiptText className="text-sky-300" />
              <h2 className="text-xl font-semibold text-white">Customer functions</h2>
            </div>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-400">
              <li>• View and manage your phase 1 purchased services.</li>
              <li>• Open detailed order records with PDF export from the orders page.</li>
              <li>• Update account profile, password, and profile picture.</li>
              <li>• Go to checkout anytime to complete a new service order.</li>
            </ul>
          </div>
        </section>
      </div>

      <div className="mt-6 panel p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-sky-300" />
          <h2 className="text-xl font-semibold text-white">Suggested temporary automation</h2>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          For phase 1, fresh chat and guided onboarding prompts can be used to help customers discover services,
          compare packages, and reach checkout faster while deeper support modules are prepared for phase 2.
        </p>
      </div>

      {dashboardModal?.type === 'alerts' && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Recent portal alerts"
              onClick={closeDashboardModal}
            >
              <div className="panel flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden p-6" onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Alerts Preview</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Recent portal alerts</h2>
                      <p className="mt-2 text-sm text-slate-400">Review the latest notifications without leaving the dashboard.</p>
                    </div>
                    <button type="button" onClick={closeDashboardModal} className="btn-secondary px-4">Close</button>
                  </div>

                  <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-2">
                    <div className="space-y-3">
                      {alertPreviewItems.length ? alertPreviewItems.map((item) => {
                        const visual = getNotificationVisual(item);

                        return (
                          <div key={item.id} className="panel-muted rounded-3xl p-4">
                            <div className="flex gap-4">
                              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${visual.iconClassName}`}>
                                <visual.Icon size={18} strokeWidth={visual.strokeWidth} stroke={visual.stroke} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3">
                                  <p className="text-base font-semibold text-white">{item.title}</p>
                                  {!item.isRead ? (
                                    <span
                                      className="inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                                      style={{
                                        backgroundColor: 'rgba(62, 100, 255, 0.12)',
                                        borderColor: 'rgba(62, 100, 255, 0.22)',
                                        color: 'var(--accent)',
                                      }}
                                    >
                                      New
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-sm text-slate-400">{item.message}</p>
                                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatDateTime(item.createdAt)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="panel-muted rounded-3xl p-6 text-sm text-slate-400">
                          No alerts are available right now.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            </div>,
            document.body,
          )
        : null}

      {dashboardModal?.type === 'orders' && orderModalConfig && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label={orderModalConfig.title}
              onClick={closeDashboardModal}
            >
              <div className="panel flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden p-6" onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Orders Preview</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{orderModalConfig.title}</h2>
                      <p className="mt-2 text-sm text-slate-400">{orderModalConfig.subtitle}</p>
                    </div>
                    <button type="button" onClick={closeDashboardModal} className="btn-secondary px-4">Close</button>
                  </div>

                  <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-2">
                    <div className="space-y-3">
                      {orderModalConfig.items.length ? orderModalConfig.items.map((order) => (
                        <div key={order.id} className="panel-muted rounded-3xl p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Order {order.orderNumber ?? order.id}</p>
                              <p className="mt-2 text-lg font-semibold text-white">{order.serviceName}</p>
                              <p className="mt-2 text-sm text-slate-400">{order.paymentMethod} • {formatDateTime(order.date ?? order.createdAt)}</p>
                            </div>
                            <div className="flex flex-col items-start gap-3 md:items-end">
                              <StatusBadge status={order.status} />
                              <p className="text-lg font-semibold text-sky-300">{formatCurrency(order.amount)}</p>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="panel-muted rounded-3xl p-6 text-sm text-slate-400">
                          No orders match this view yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={() => { closeDashboardModal(); navigate('/dashboard/orders'); }} className="btn-secondary px-4">Open Page</button>
                  </div>
                </div>
            </div>,
            document.body,
          )
        : null}

      {selectedSchedule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Schedule Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedSchedule.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{selectedSchedule.subtitle}</p>
              </div>
              <button type="button" onClick={() => setSelectedSchedule(null)} className="btn-secondary px-4">
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{selectedSchedule.label}</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatDateTime(selectedSchedule.value)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {selectedCancellationService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Cancel service</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Request cancellation for {selectedCancellationService.name}</h2>
                <p className="mt-2 text-sm text-slate-400">Requests will be submitted for admin approval. You will be notified when an admin approves or rejects this cancellation.</p>
              </div>
              <button type="button" onClick={() => setSelectedCancellationService(null)} className="btn-secondary px-4">Close</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();

              if (!hasCancellationReason) {
                setToastMessage('Please tell us why you want to cancel this service.');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 5000);
                return;
              }

              setIsRequestingCancellation(true);

              try {
                const res = await requestServiceCancellation(selectedCancellationService.id, cancellationReason);
                setSelectedCancellationService(null);
                setCancellationReason('');
                setToastMessage(res?.message ?? 'Cancellation request sent — waiting for admin approval. Admin will be notified.');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 4000);
                // Broadcast to other tabs (so admins get an immediate refresh if they have the app open)
                try {
                  if (typeof BroadcastChannel !== 'undefined') {
                    const ch = new BroadcastChannel('wsi-portal');
                    ch.postMessage({ type: 'cancellation-request', serviceId: selectedCancellationService.id, serviceName: selectedCancellationService.name });
                    ch.close();
                  }
                } catch (e) {
                  // ignore broadcast failures
                }
              } catch (err) {
                setToastMessage(err.message || 'Unable to submit cancellation request');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 5000);
              } finally {
                setIsRequestingCancellation(false);
              }
            }}>
              <div className="mt-6">
                <label className="block text-sm text-slate-300">Reason for cancellation
                  <textarea
                    required
                    rows={4}
                    className="input mt-2"
                    value={cancellationReason}
                    onChange={(ev) => setCancellationReason(ev.target.value)}
                    placeholder="Tell us why you're cancelling this service"
                  />
                </label>
                <p className="mt-2 text-sm text-slate-400">A cancellation reason is required before you can submit this request.</p>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setSelectedCancellationService(null)} className="btn-secondary">Close</button>
                <button type="submit" disabled={isRequestingCancellation || !hasCancellationReason} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                  {isRequestingCancellation ? 'Requesting...' : 'Submit cancellation request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedSupportService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-md p-6 relative">
            <button type="button" onClick={() => setSelectedSupportService(null)} className="absolute right-4 top-4 btn-secondary px-3">Close</button>

            <div className="">
              <h3 className="text-lg font-semibold text-white">Service Support</h3>
              <p className="mt-1 text-sm text-slate-400">Technical ticket for: <strong className="text-white">{selectedSupportService.name}</strong></p>

              <textarea
                className="input mt-4 h-32 w-full"
                placeholder="Describe the issue you're experiencing..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
              />

              <div className="mt-4">
                <button
                  className="btn-primary w-full"
                  disabled={isReportingSupport}
                  onClick={async () => {
                    setIsReportingSupport(true);
                    try {
                      await reportServiceIssue(selectedSupportService.id, supportMessage.trim());
                      setSelectedSupportService(null);
                      setSupportMessage('');
                      setToastMessage('Support ticket submitted. We will respond shortly.');
                      setShowToast(true);
                      setTimeout(() => setShowToast(false), 4000);
                    } catch (err) {
                      setToastMessage(err.message || 'Unable to submit ticket');
                      setShowToast(true);
                      setTimeout(() => setShowToast(false), 5000);
                    } finally {
                      setIsReportingSupport(false);
                    }
                  }}
                >
                  {isReportingSupport ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedAgreementService ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6 relative">
            <button type="button" onClick={() => setSelectedAgreementService(null)} className="absolute right-4 top-4 btn-secondary px-4">Close</button>

            <div className="flex flex-col items-center">
              <div className="-mt-10 mb-3">
                <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 6h10l2 3v8a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                </div>
              </div>

              <div className="w-full text-left">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Service Agreement</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedAgreementService.name}</h2>
                <p className="mt-2 text-sm text-slate-400">This agreement constitutes a legal contract between CloudHost PH and the user regarding the provision of managed services. You may download the signed agreement as a PDF.</p>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white mb-3 text-center">Subject: {selectedAgreementService.name}</p>
                  <p className="text-sm text-slate-300 mb-6 text-center">This agreement outlines service terms, SLAs, and privacy commitments for the selected service.</p>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const url = selectedAgreementService.agreementUrl ?? `/api/services/${selectedAgreementService.id}/agreement.pdf`;
                          window.open(url, '_blank');
                        } catch (e) {
                          setSelectedAgreementService(null);
                        }
                      }}
                      className="px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md"
                    >
                      Download PDF(Signed)
                    </button>
                  </div>
                </div>

                {getServiceAddonEntries(selectedAgreementService).length ? (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm font-semibold text-white">Selected Add-ons</p>
                    <p className="mt-2 text-sm text-slate-400">Billing cycle and renewal details for the add-ons attached to this service.</p>
                    <div className="mt-4 space-y-3">
                      {getServiceAddonEntries(selectedAgreementService).map((addonEntry) => {
                        const addonExpirationMeta = getAddonExpirationMeta(addonEntry, selectedAgreementService, countdownNow);

                        return (
                          <div key={`${selectedAgreementService.id}-${addonEntry.label}`} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-sm font-medium text-white">{addonEntry.label}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{getAddonBillingCycleLabel(addonEntry.billingCycle, 'Recurring')}</p>
                              </div>
                              <div className="text-left md:text-right">
                                {typeof addonEntry.price === 'number' ? <p className="text-sm font-semibold text-sky-300">{formatCurrency(addonEntry.price)}</p> : null}
                                <p className={`mt-1 text-sm ${addonExpirationMeta.isExpired ? 'text-rose-300' : 'text-white'}`}>{addonExpirationMeta.value}</p>
                                <p className={`mt-1 text-xs ${addonExpirationMeta.isExpired ? 'text-rose-300' : 'text-slate-400'}`}>{addonExpirationMeta.helper}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showToast ? (
        <div className="fixed right-6 bottom-6 z-50 w-auto max-w-sm">
          <div className="rounded-xl bg-slate-900/95 px-4 py-3 shadow-lg text-sm text-white">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
}
