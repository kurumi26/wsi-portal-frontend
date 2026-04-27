import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  LayoutDashboard,
  Mail,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import StandardComboChart from '../../components/common/StandardComboChart';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { extractAddonEntries, getAddonBillingCycleLabel, getAddonExpirationMeta, matchCatalogService } from '../../utils/addons';
import { getServiceDisplayStatus } from '../../utils/services';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_ORDER_STATUSES = new Set(['pending', 'pending review', 'pending approval']);
const SURFACE_CLASS_NAME = 'panel overflow-hidden rounded-[26px]';
const NESTED_SURFACE_CLASS_NAME = 'panel rounded-[24px]';

const normalizeDashboardText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getTimestamp = (...values) => {
  const value = values.find((entry) => entry !== null && entry !== undefined && entry !== '');

  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
};

const getMoneyValue = (...values) => {
  const match = values.find((value) => value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value)));
  return match === undefined ? 0 : Number(match);
};

const formatDashboardDate = (value) => {
  const time = getTimestamp(value);

  if (!time) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(time)).replace(/ /g, '-');
};

const formatDashboardDateTime = (value) => {
  const time = getTimestamp(value);

  if (!time) {
    return '—';
  }

  const date = new Date(time);
  const dateLabel = formatDashboardDate(date);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${dateLabel}  ${timeLabel}`;
};

const getDaysLeft = (value, now = Date.now()) => {
  const time = getTimestamp(value);

  if (!time) {
    return '—';
  }

  const diff = time - now;

  if (diff <= 0) {
    return 'Due';
  }

  return Math.max(1, Math.ceil(diff / DAY_MS));
};

const getOrderReference = (purchase) => {
  const rawValue = purchase?.orderNumber ?? purchase?.order_number ?? purchase?.reference ?? purchase?.referenceNumber ?? purchase?.id;

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return '—';
  }

  const label = String(rawValue);
  return /^no-/i.test(label) ? label : `NO-${label}`;
};

const getOverdueReference = (purchase) => {
  const rawValue = purchase?.soaNumber ?? purchase?.soa_number ?? purchase?.invoiceNumber ?? purchase?.invoice_number ?? purchase?.reference ?? purchase?.id;

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return '—';
  }

  const label = String(rawValue);
  return /^soa-/i.test(label) ? label : `SOA-${label}`;
};

const toneStyles = {
  blue: {
    accent: 'text-blue-600',
    icon: 'border-blue-100 bg-blue-50 text-blue-600',
    footer: 'text-blue-600 hover:text-blue-700',
  },
  amber: {
    accent: 'text-amber-600',
    icon: 'border-amber-100 bg-amber-50 text-amber-600',
    footer: 'text-amber-600 hover:text-amber-700',
  },
  rose: {
    accent: 'text-rose-600',
    icon: 'border-rose-100 bg-rose-50 text-rose-600',
    footer: 'text-rose-600 hover:text-rose-700',
  },
};

const quickActionTones = {
  emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-600',
  blue: 'border-blue-200 bg-blue-50/60 text-blue-600',
  violet: 'border-violet-200 bg-violet-50/60 text-violet-600',
  orange: 'border-orange-200 bg-orange-50/60 text-orange-600',
};

const summaryTones = {
  emerald: {
    card: 'hover:border-slate-300',
    icon: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    label: 'text-emerald-600',
    value: 'text-slate-900',
    helper: 'text-slate-500',
  },
  amber: {
    card: 'hover:border-slate-300',
    icon: 'border-amber-200 bg-amber-50 text-amber-600',
    label: 'text-amber-600',
    value: 'text-slate-900',
    helper: 'text-slate-500',
  },
  rose: {
    card: 'hover:border-slate-300',
    icon: 'border-rose-200 bg-rose-50 text-rose-600',
    label: 'text-rose-600',
    value: 'text-slate-900',
    helper: 'text-slate-500',
  },
  violet: {
    card: 'hover:border-slate-300',
    icon: 'border-violet-200 bg-violet-50 text-violet-600',
    label: 'text-violet-600',
    value: 'text-slate-900',
    helper: 'text-slate-500',
  },
};

const QUICK_ACTIONS = [
  {
    key: 'add-service',
    to: '/admin/services',
    icon: Plus,
    label: 'Add New Service',
    hint: 'Catalog setup',
    tone: 'emerald',
  },
  {
    key: 'generate-soa',
    to: '/admin/reports/receivables',
    icon: FileText,
    label: 'Generate SOA',
    hint: 'Receivables',
    tone: 'emerald',
  },
  {
    key: 'send-reminder',
    to: '/admin/notifications',
    icon: Mail,
    label: 'Send Reminder',
    hint: 'Follow-ups',
    tone: 'violet',
  },
  {
    key: 'search',
    to: '/admin/clients',
    icon: Search,
    label: 'Search',
    hint: 'Clients & services',
    tone: 'blue',
  },
  {
    key: 'reports',
    to: '/admin/reports',
    icon: BarChart3,
    label: 'Reports',
    hint: 'Analytics center',
    tone: 'orange',
  },
  {
    key: 'upload-document',
    to: '/admin/contracts',
    icon: UploadCloud,
    label: 'Upload Document',
    hint: 'Contracts',
    tone: 'blue',
  },
];

const ADMIN_DASHBOARD_WIDGET_STORAGE_KEY = 'wsi-admin-dashboard-widgets-v1';

const DASHBOARD_WIDGETS = [
  {
    key: 'newOrders',
    label: 'New Orders',
    description: 'Show the newest order queue at the top of the dashboard.',
    icon: ReceiptText,
  },
  {
    key: 'expiringServices',
    label: 'Expiring Services',
    description: 'Keep the expiring service reminder table visible.',
    icon: CalendarClock,
  },
  {
    key: 'overdue',
    label: 'Overdue',
    description: 'Show overdue receivables and due-date pressure.',
    icon: CircleAlert,
  },
  {
    key: 'performanceChart',
    label: 'Performance Chart',
    description: 'Display projected renewals versus actual collection.',
    icon: BarChart3,
  },
  {
    key: 'quickActions',
    label: 'Quick Actions',
    description: 'Keep admin shortcuts like reports and upload actions visible.',
    icon: Plus,
  },
  {
    key: 'recentActivity',
    label: 'Recent Activity',
    description: 'Show the latest admin actions and status updates.',
    icon: ReceiptText,
  },
  {
    key: 'summaryActive',
    label: 'Active Summary',
    description: 'Keep the active services summary card visible.',
    icon: CheckCircle2,
  },
  {
    key: 'summaryExpiring',
    label: 'Expiring Summary',
    description: 'Keep the expiring services summary card visible.',
    icon: Clock3,
  },
  {
    key: 'summaryExpired',
    label: 'Expired Summary',
    description: 'Keep the expired services summary card visible.',
    icon: XCircle,
  },
  {
    key: 'summaryPendingOrders',
    label: 'Pending Orders Summary',
    description: 'Keep the pending orders summary card visible.',
    icon: ShoppingCart,
  },
];

const DEFAULT_DASHBOARD_WIDGET_KEYS = DASHBOARD_WIDGETS.map((widget) => widget.key);

const sanitizeDashboardWidgetKeys = (candidateKeys) => {
  const allowedKeys = new Set(DEFAULT_DASHBOARD_WIDGET_KEYS);
  const normalizedKeys = Array.isArray(candidateKeys)
    ? candidateKeys.filter((key) => allowedKeys.has(key))
    : [];

  if (!normalizedKeys.length) {
    return DEFAULT_DASHBOARD_WIDGET_KEYS;
  }

  const visibleSet = new Set(normalizedKeys);

  return DEFAULT_DASHBOARD_WIDGET_KEYS.filter((key) => visibleSet.has(key));
};

const readStoredDashboardWidgetKeys = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_DASHBOARD_WIDGET_KEYS;
  }

  try {
    const rawValue = window.localStorage.getItem(ADMIN_DASHBOARD_WIDGET_STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_DASHBOARD_WIDGET_KEYS;
    }

    return sanitizeDashboardWidgetKeys(JSON.parse(rawValue));
  } catch {
    return DEFAULT_DASHBOARD_WIDGET_KEYS;
  }
};

const writeStoredDashboardWidgetKeys = (widgetKeys) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      ADMIN_DASHBOARD_WIDGET_STORAGE_KEY,
      JSON.stringify(sanitizeDashboardWidgetKeys(widgetKeys)),
    );
  } catch {
    // Ignore storage failures so the dashboard stays usable.
  }
};

const getDashboardQueueGridClass = (count) => {
  if (count <= 1) {
    return 'grid gap-5';
  }

  if (count === 2) {
    return 'grid gap-5 xl:grid-cols-2';
  }

  return 'grid gap-5 xl:grid-cols-3';
};

const getSummaryGridClass = (count) => {
  if (count <= 1) {
    return 'grid gap-4';
  }

  if (count === 2) {
    return 'grid gap-4 md:grid-cols-2';
  }

  if (count === 3) {
    return 'grid gap-4 md:grid-cols-2 xl:grid-cols-3';
  }

  return 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';
};

function TinyStatus({ label }) {
  const normalized = normalizeDashboardText(label);
  const classes = {
    new: 'border-blue-100 bg-blue-50 text-blue-600',
    expiring: 'border-amber-100 bg-amber-50 text-amber-600',
    overdue: 'border-rose-100 bg-rose-50 text-rose-600',
    completed: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    sent: 'border-sky-100 bg-sky-50 text-sky-600',
    'in progress': 'border-orange-100 bg-orange-50 text-orange-600',
    active: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    pending: 'border-amber-100 bg-amber-50 text-amber-700',
  }[normalized] ?? 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function DashboardTableCard({ tone, icon: Icon, title, columns, rows, emptyLabel, footerLabel, to, renderRow }) {
  const styles = toneStyles[tone] ?? toneStyles.blue;

  return (
    <section className={`${SURFACE_CLASS_NAME} flex min-h-[300px] flex-col`}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${styles.icon}`}>
          <Icon size={20} />
        </div>
        <h2 className={`text-lg font-semibold uppercase tracking-[0.08em] ${styles.accent}`}>{title}</h2>
      </div>

      <div className="flex-1 px-4 pb-4 pt-3">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-left text-sm text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {columns.map((column) => (
                  <th key={column.label} className={`px-2 py-2 font-semibold ${column.className ?? ''}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(renderRow) : (
                <tr>
                  <td colSpan={columns.length} className="px-2 py-10 text-center text-sm text-slate-400">
                    {emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-3 text-center">
        <Link to={to} className={`text-sm font-semibold ${styles.footer}`}>
          {footerLabel}
        </Link>
      </div>
    </section>
  );
}

function QuickActionTile({ to, icon: Icon, label, hint, tone }) {
  return (
    <Link
      to={to}
      className="group panel rounded-[26px] p-4 text-center transition duration-200 hover:-translate-y-0.5 hover:border-slate-300"
    >
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border ${quickActionTones[tone] ?? quickActionTones.blue}`}>
        <Icon size={22} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Link>
  );
}

function SummaryCard({ tone, icon: Icon, label, value, helper, onClick }) {
  const styles = summaryTones[tone] ?? summaryTones.emerald;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`panel rounded-[24px] p-5 text-left transition duration-200 hover:-translate-y-0.5 ${styles.card}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full border ${styles.icon}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${styles.label}`}>{label}</p>
          <p className={`mt-2 text-4xl font-semibold ${styles.value}`}>{value}</p>
          <p className={`mt-1 text-sm ${styles.helper}`}>{helper}</p>
        </div>
      </div>
    </button>
  );
}

export default function AdminDashboardPage() {
  const { adminServices, adminPurchases, services } = usePortal();
  const [dashboardCustomizerOpen, setDashboardCustomizerOpen] = useState(false);
  const [visibleWidgetKeys, setVisibleWidgetKeys] = useState(() => readStoredDashboardWidgetKeys());
  const [selectedTimeline, setSelectedTimeline] = useState(null);
  const [selectedStatCard, setSelectedStatCard] = useState(null);
  const [attentionNow, setAttentionNow] = useState(() => Date.now());
  const [chartScope, setChartScope] = useState('This Month');

  const visibleWidgetSet = useMemo(() => new Set(visibleWidgetKeys), [visibleWidgetKeys]);

  useEffect(() => {
    writeStoredDashboardWidgetKeys(visibleWidgetKeys);
  }, [visibleWidgetKeys]);

  useEffect(() => {
    if (!adminServices.some((service) => service?.renewsOn)) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setAttentionNow(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timerId);
  }, [adminServices]);

  useEffect(() => {
    if (!selectedStatCard) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedStatCard(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStatCard]);

  useEffect(() => {
    if (!dashboardCustomizerOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDashboardCustomizerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dashboardCustomizerOpen]);

  useEffect(() => {
    if (!selectedStatCard) {
      document.body.classList.remove('service-summary-modal-open');
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.classList.add('service-summary-modal-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('service-summary-modal-open');
      document.body.style.overflow = '';
    };
  }, [selectedStatCard]);

  const serviceAddonEntriesById = useMemo(() => {
    return new Map(
      adminServices.map((service) => {
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
  }, [adminServices, services]);

  const getServiceAddonEntries = (service) => serviceAddonEntriesById.get(String(service?.id)) ?? [];

  const getServiceAddonSummary = (service) => {
    const addonEntries = getServiceAddonEntries(service);

    if (!addonEntries.length) {
      return 'No add-ons';
    }

    const preview = addonEntries
      .slice(0, 2)
      .map((addonEntry) => `${addonEntry.label} (${getAddonBillingCycleLabel(addonEntry.billingCycle, 'Recurring')})`)
      .join(', ');

    return addonEntries.length > 2 ? `${preview} +${addonEntries.length - 2} more` : preview;
  };

  const getServiceAddonExpirySummary = (service) => {
    const addonEntries = getServiceAddonEntries(service);

    if (!addonEntries.length) {
      return 'No add-ons';
    }

    const primaryMeta = getAddonExpirationMeta(addonEntries[0], service, attentionNow);

    return addonEntries.length > 1
      ? `${primaryMeta.value} • ${addonEntries.length - 1} more add-on${addonEntries.length - 1 === 1 ? '' : 's'} attached`
      : `${primaryMeta.value} • ${primaryMeta.helper}`;
  };

  const buildServiceDashboardRow = (service, timelineLabel, fallbackValue) => ({
    id: service.id,
    title: service.name,
    subtitle: service.client || service.clientEmail || service.category || 'Client service',
    badge: getServiceDisplayStatus(service, attentionNow),
    fields: [
      { label: 'Plan', value: service.plan || 'Not assigned' },
      { label: timelineLabel, value: service.renewsOn ? formatDateTime(service.renewsOn) : fallbackValue },
      { label: 'Add-ons', value: getServiceAddonSummary(service) },
      { label: 'Add-on Expiry', value: getServiceAddonExpirySummary(service) },
    ],
  });

  const activeServicesList = useMemo(
    () => adminServices.filter((service) => getServiceDisplayStatus(service, attentionNow) === 'Active'),
    [adminServices, attentionNow],
  );

  const expiringSoonServices = useMemo(
    () => adminServices
      .filter((service) => getServiceDisplayStatus(service, attentionNow) === 'Expiring Soon')
      .sort((left, right) => getTimestamp(left?.renewsOn) - getTimestamp(right?.renewsOn)),
    [adminServices, attentionNow],
  );

  const expiredServices = useMemo(
    () => adminServices
      .filter((service) => getServiceDisplayStatus(service, attentionNow) === 'Expired')
      .sort((left, right) => getTimestamp(right?.renewsOn) - getTimestamp(left?.renewsOn)),
    [adminServices, attentionNow],
  );

  const pendingPurchases = useMemo(
    () => adminPurchases.filter((purchase) => PENDING_ORDER_STATUSES.has(normalizeDashboardText(purchase?.status))),
    [adminPurchases],
  );

  const newestOrders = useMemo(() => {
    const source = pendingPurchases.length ? pendingPurchases : adminPurchases;

    return [...source]
      .sort((left, right) => getTimestamp(right?.date, right?.createdAt, right?.created_at) - getTimestamp(left?.date, left?.createdAt, left?.created_at))
      .slice(0, 3);
  }, [adminPurchases, pendingPurchases]);

  const expiringQueue = useMemo(() => {
    const source = expiringSoonServices.length
      ? expiringSoonServices
      : adminServices
        .filter((service) => getTimestamp(service?.renewsOn))
        .sort((left, right) => getTimestamp(left?.renewsOn) - getTimestamp(right?.renewsOn));

    return source.slice(0, 3);
  }, [adminServices, expiringSoonServices]);

  const overduePurchases = useMemo(() => {
    const now = Date.now();

    return adminPurchases
      .filter((purchase) => {
        const normalizedStatus = normalizeDashboardText(purchase?.status);

        if (/overdue|late|aging/.test(normalizedStatus)) {
          return true;
        }

        const dueTime = getTimestamp(
          purchase?.dueDate,
          purchase?.due_date,
          purchase?.dueOn,
          purchase?.due_on,
          purchase?.invoiceDueDate,
          purchase?.invoice_due_date,
        );

        if (!dueTime || /paid|completed|settled/.test(normalizedStatus)) {
          return false;
        }

        return dueTime < now;
      })
      .sort((left, right) => {
        const leftTime = getTimestamp(left?.dueDate, left?.due_date, left?.dueOn, left?.due_on, left?.date);
        const rightTime = getTimestamp(right?.dueDate, right?.due_date, right?.dueOn, right?.due_on, right?.date);
        return leftTime - rightTime;
      });
  }, [adminPurchases]);

  const overdueQueue = useMemo(() => {
    const source = overduePurchases.length
      ? overduePurchases
      : adminPurchases
        .filter((purchase) => !/paid|completed|settled/.test(normalizeDashboardText(purchase?.status)))
        .sort((left, right) => getTimestamp(left?.date, left?.createdAt, left?.created_at) - getTimestamp(right?.date, right?.createdAt, right?.created_at));

    return source.slice(0, 3);
  }, [adminPurchases, overduePurchases]);

  const chartSeries = useMemo(() => {
    const activeYear = new Date(attentionNow).getFullYear();
    const projected = Array(12).fill(0);
    const actual = Array(12).fill(0);

    adminServices.forEach((service) => {
      const renewalTime = getTimestamp(service?.renewsOn);

      if (!renewalTime) {
        return;
      }

      const renewalDate = new Date(renewalTime);

      if (renewalDate.getFullYear() !== activeYear) {
        return;
      }

      projected[renewalDate.getMonth()] += getMoneyValue(
        service?.totalPaid,
        service?.total_paid,
        service?.amount,
        service?.price,
        service?.basePrice,
        service?.base_price,
      );
    });

    adminPurchases.forEach((purchase) => {
      const purchaseTime = getTimestamp(purchase?.date, purchase?.createdAt, purchase?.created_at);

      if (!purchaseTime) {
        return;
      }

      const purchaseDate = new Date(purchaseTime);

      if (purchaseDate.getFullYear() !== activeYear) {
        return;
      }

      actual[purchaseDate.getMonth()] += getMoneyValue(purchase?.amount, purchase?.price);
    });

    const currentMonthIndex = new Date(attentionNow).getMonth();
    const rangeStart = chartScope === 'This Year'
      ? 0
      : chartScope === 'This Quarter'
        ? Math.floor(currentMonthIndex / 3) * 3
        : currentMonthIndex;
    const totalProjected = projected.slice(rangeStart, currentMonthIndex + 1).reduce((sum, value) => sum + value, 0);
    const totalActual = actual.slice(rangeStart, currentMonthIndex + 1).reduce((sum, value) => sum + value, 0);
    const collectionRate = totalProjected ? (totalActual / totalProjected) * 100 : 0;

    return {
      projected,
      actual,
      totalProjected,
      totalActual,
      collectionRate,
      currentMonthLabel: MONTH_LABELS[currentMonthIndex],
    };
  }, [adminPurchases, adminServices, attentionNow, chartScope]);

  const recentActivity = useMemo(() => {
    const purchaseActivity = adminPurchases.map((purchase) => {
      const normalizedStatus = normalizeDashboardText(purchase?.status);
      let activity = 'Order Update';
      let performedBy = 'Administrator';
      let status = purchase?.status || 'In Progress';

      if (/pending/.test(normalizedStatus)) {
        activity = 'New Order Received';
        status = 'In Progress';
      } else if (/paid|approved|completed/.test(normalizedStatus)) {
        activity = 'Payment Received';
        performedBy = 'System';
        status = 'Completed';
      } else if (/overdue|late|aging/.test(normalizedStatus)) {
        activity = 'Overdue Follow-up';
        status = 'In Progress';
      }

      return {
        id: `purchase-${purchase.id}`,
        date: purchase?.date ?? purchase?.createdAt ?? purchase?.created_at,
        activity,
        reference: getOrderReference(purchase),
        client: purchase?.client ?? purchase?.customer ?? '—',
        performedBy,
        status,
      };
    });

    const serviceActivity = adminServices.map((service) => {
      const displayStatus = getServiceDisplayStatus(service, attentionNow);
      let activity = 'Service Status Updated';
      let performedBy = 'System';
      let status = 'Completed';

      if (displayStatus === 'Expiring Soon') {
        activity = 'Service Renewal Reminder Sent';
        status = 'Sent';
      } else if (service.status === 'Undergoing Provisioning') {
        activity = 'Provisioning Update';
        status = 'In Progress';
      } else if (displayStatus === 'Active') {
        activity = 'New Service Added';
      } else if (displayStatus === 'Expired') {
        activity = 'Service Expired';
      }

      return {
        id: `service-${service.id}`,
        date: service?.updatedAt ?? service?.updated_at ?? service?.createdAt ?? service?.created_at,
        activity,
        reference: `SRV-${service.id}`,
        client: service?.client ?? service?.clientEmail ?? '—',
        performedBy,
        status,
      };
    });

    return [...purchaseActivity, ...serviceActivity]
      .filter((item) => getTimestamp(item.date))
      .sort((left, right) => getTimestamp(right.date) - getTimestamp(left.date))
      .slice(0, 5);
  }, [adminPurchases, adminServices, attentionNow]);

  const summaryCards = useMemo(
    () => [
      {
        widgetKey: 'summaryActive',
        label: 'Active',
        value: activeServicesList.length,
        helper: 'Total Active Services',
        tone: 'emerald',
        icon: CheckCircle2,
        modalTitle: 'Active Services',
        modalDescription: 'Services currently live and managed by the admin team.',
        rows: activeServicesList.map((service) => buildServiceDashboardRow(service, 'Renews On', 'Not scheduled')),
      },
      {
        widgetKey: 'summaryExpiring',
        label: 'Expiring',
        value: expiringSoonServices.length,
        helper: 'Services Expiring Soon',
        tone: 'amber',
        icon: Clock3,
        modalTitle: 'Expiring Services',
        modalDescription: 'Services nearing renewal and needing attention soon.',
        rows: expiringSoonServices.map((service) => buildServiceDashboardRow(service, 'Expiry Date', 'Not scheduled')),
      },
      {
        widgetKey: 'summaryExpired',
        label: 'Expired',
        value: expiredServices.length,
        helper: 'Services Already Expired',
        tone: 'rose',
        icon: XCircle,
        modalTitle: 'Expired Services',
        modalDescription: 'Services whose renewal date has already passed.',
        rows: expiredServices.map((service) => buildServiceDashboardRow(service, 'Expired On', 'Not scheduled')),
      },
      {
        widgetKey: 'summaryPendingOrders',
        label: 'Pending Orders',
        value: pendingPurchases.length,
        helper: 'Awaiting Approval',
        tone: 'violet',
        icon: ShoppingCart,
        modalTitle: 'Pending Orders',
        modalDescription: 'Orders still waiting for administrator review or approval.',
        rows: pendingPurchases.map((purchase) => ({
          id: purchase.id,
          title: purchase.serviceName || 'Pending Order',
          subtitle: purchase.client || purchase.customer || 'Customer order',
          badge: purchase.status,
          fields: [
            { label: 'Order ID', value: getOrderReference(purchase) },
            { label: 'Amount', value: formatCurrency(getMoneyValue(purchase.amount, purchase.price)) },
            { label: 'Created', value: purchase.date ? formatDateTime(purchase.date) : 'Not available' },
            { label: 'Status', value: purchase.status || 'Pending Review' },
          ],
        })),
      },
    ],
    [activeServicesList, expiredServices, expiringSoonServices, pendingPurchases, attentionNow],
  );

  const showNewOrders = visibleWidgetSet.has('newOrders');
  const showExpiringServices = visibleWidgetSet.has('expiringServices');
  const showOverdue = visibleWidgetSet.has('overdue');
  const showPerformanceChart = visibleWidgetSet.has('performanceChart');
  const showQuickActions = visibleWidgetSet.has('quickActions');
  const showRecentActivity = visibleWidgetSet.has('recentActivity');
  const visibleQueueCardCount = [showNewOrders, showExpiringServices, showOverdue].filter(Boolean).length;
  const visibleSummaryCards = useMemo(
    () => summaryCards.filter((card) => visibleWidgetSet.has(card.widgetKey)),
    [summaryCards, visibleWidgetSet],
  );

  const toggleDashboardWidget = (widgetKey) => {
    setVisibleWidgetKeys((current) => {
      const normalizedKeys = sanitizeDashboardWidgetKeys(current);
      const isVisible = normalizedKeys.includes(widgetKey);

      if (isVisible && normalizedKeys.length === 1) {
        return normalizedKeys;
      }

      const nextVisibleSet = isVisible
        ? new Set(normalizedKeys.filter((key) => key !== widgetKey))
        : new Set([...normalizedKeys, widgetKey]);

      return DEFAULT_DASHBOARD_WIDGET_KEYS.filter((key) => nextVisibleSet.has(key));
    });
  };

  const resetDashboardWidgets = () => {
    setVisibleWidgetKeys(DEFAULT_DASHBOARD_WIDGET_KEYS);
  };

  const statCardModal = selectedStatCard
    ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-stat-modal-title"
          onClick={() => setSelectedStatCard(null)}
        >
          <div
            className="panel flex max-h-[min(88vh,760px)] w-full max-w-4xl flex-col overflow-hidden p-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative border-b border-white/10 px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/80">Admin Overview</p>
                <h2 id="admin-stat-modal-title" className="mt-2 pr-28 text-2xl font-semibold text-white">
                  {selectedStatCard.modalTitle}
                </h2>
                <p className="mt-2 pr-28 text-sm text-slate-300">{selectedStatCard.modalDescription}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStatCard(null)}
                className="btn-secondary absolute right-6 top-5 shrink-0 px-4"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4 pr-1">
                {selectedStatCard.rows.length ? (
                  selectedStatCard.rows.map((row) => (
                    <div key={row.id} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{row.title}</h3>
                          <p className="mt-1 text-sm text-slate-300">{row.subtitle}</p>
                        </div>
                        {row.badge ? <StatusBadge status={row.badge} /> : null}
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                        {row.fields.map((field) => (
                          <div key={`${row.id}-${field.label}`}>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{field.label}</p>
                            <p className="mt-1 text-white">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
                    No records are available for this card right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const dashboardCustomizerModal = dashboardCustomizerOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-dashboard-customizer-title"
          onClick={() => setDashboardCustomizerOpen(false)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                  <LayoutDashboard size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dashboard Controls</p>
                  <h2 id="admin-dashboard-customizer-title" className="mt-1 text-2xl font-semibold text-slate-900">
                    Customize Admin View
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Choose which widgets stay visible on the admin dashboard.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDashboardCustomizerOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Visible Widgets</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {visibleWidgetKeys.length} of {DASHBOARD_WIDGETS.length} dashboard items selected
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetDashboardWidgets}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <RotateCcw size={15} />
                  Reset Default
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {DASHBOARD_WIDGETS.map((widget) => {
                  const isVisible = visibleWidgetSet.has(widget.key);
                  const isLastVisible = visibleWidgetKeys.length === 1 && isVisible;
                  const statusLabel = isLastVisible ? 'Required' : isVisible ? 'Visible' : 'Hidden';
                  const Icon = widget.icon;

                  return (
                    <button
                      key={widget.key}
                      type="button"
                      onClick={() => toggleDashboardWidget(widget.key)}
                      disabled={isLastVisible}
                      className={`flex items-start justify-between gap-4 rounded-[22px] border bg-white px-4 py-4 text-left transition ${
                        isVisible
                          ? 'border-sky-200 text-slate-900 shadow-[0_10px_24px_rgba(59,130,246,0.08)]'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]'
                      } ${isLastVisible ? 'cursor-not-allowed opacity-85' : ''}`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                          isVisible ? 'border-sky-200 bg-sky-50 text-sky-600' : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold">{widget.label}</p>
                          <p className="mt-1 text-sm text-slate-500">{widget.description}</p>
                        </div>
                      </div>

                      <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        isVisible
                          ? 'border-sky-200 bg-white text-sky-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}>
                        {isVisible ? <CheckCircle2 size={14} /> : null}
                        {statusLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="space-y-5">
      <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-[24px] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dashboard Display</p>
          <p className="mt-1 text-sm text-slate-500">Choose which widgets the admin wants to keep visible on this page.</p>
        </div>

        <button
          type="button"
          onClick={() => setDashboardCustomizerOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <SlidersHorizontal size={16} />
          Customize Dashboard
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {visibleWidgetKeys.length}
          </span>
        </button>
      </div>

      {visibleQueueCardCount ? (
        <div className={getDashboardQueueGridClass(visibleQueueCardCount)}>
          {showNewOrders ? (
            <DashboardTableCard
              tone="blue"
              icon={ReceiptText}
              title="New Orders"
              columns={[
                { label: 'Order ID' },
                { label: 'Client' },
                { label: 'Date Created' },
                { label: 'Amount', className: 'text-right' },
                { label: 'Status', className: 'text-right' },
              ]}
              rows={newestOrders}
              emptyLabel="No new orders in the queue."
              footerLabel="View All New Orders"
              to="/admin/approvals"
              renderRow={(purchase) => (
                <tr key={purchase.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-3 font-semibold text-slate-800">{getOrderReference(purchase)}</td>
                  <td className="px-2 py-3 text-slate-600">{purchase.client || purchase.customer || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">{formatDashboardDate(purchase.date || purchase.createdAt || purchase.created_at)}</td>
                  <td className="px-2 py-3 text-right font-medium text-slate-800">{formatCurrency(getMoneyValue(purchase.amount, purchase.price))}</td>
                  <td className="px-2 py-3 text-right"><TinyStatus label="New" /></td>
                </tr>
              )}
            />
          ) : null}

          {showExpiringServices ? (
            <DashboardTableCard
              tone="amber"
              icon={CalendarClock}
              title="Expiring Services"
              columns={[
                { label: 'Service' },
                { label: 'Client' },
                { label: 'Expiry Date' },
                { label: 'Days Left', className: 'text-center' },
                { label: 'Status', className: 'text-right' },
              ]}
              rows={expiringQueue}
              emptyLabel="No services are close to expiry."
              footerLabel="View All Expiring Services"
              to="/admin/client-services"
              renderRow={(service) => (
                <tr key={service.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-3 font-medium text-slate-800">{service.name}</td>
                  <td className="px-2 py-3 text-slate-600">{service.client || service.clientEmail || '—'}</td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTimeline({
                        title: service.name,
                        subtitle: service.client || service.clientEmail || 'Client service',
                        label: 'Expiry Date',
                        value: service.renewsOn,
                      })}
                      className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 transition hover:text-amber-600"
                    >
                      {formatDashboardDate(service.renewsOn)}
                    </button>
                  </td>
                  <td className="px-2 py-3 text-center font-medium text-slate-700">{getDaysLeft(service.renewsOn, attentionNow)}</td>
                  <td className="px-2 py-3 text-right"><TinyStatus label="Expiring" /></td>
                </tr>
              )}
            />
          ) : null}

          {showOverdue ? (
            <DashboardTableCard
              tone="rose"
              icon={CircleAlert}
              title="Overdue"
              columns={[
                { label: 'SOA / Ref #' },
                { label: 'Client' },
                { label: 'Due Date' },
                { label: 'Amount', className: 'text-right' },
                { label: 'Status', className: 'text-right' },
              ]}
              rows={overdueQueue}
              emptyLabel="No overdue receivables right now."
              footerLabel="View All Overdue"
              to="/admin/reports/receivables"
              renderRow={(purchase) => (
                <tr key={`overdue-${purchase.id}`} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-3 font-semibold text-slate-800">{getOverdueReference(purchase)}</td>
                  <td className="px-2 py-3 text-slate-600">{purchase.client || purchase.customer || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">
                    {formatDashboardDate(
                      purchase.dueDate
                      || purchase.due_date
                      || purchase.dueOn
                      || purchase.due_on
                      || purchase.invoiceDueDate
                      || purchase.invoice_due_date
                      || purchase.date,
                    )}
                  </td>
                  <td className="px-2 py-3 text-right font-medium text-slate-800">{formatCurrency(getMoneyValue(purchase.amount, purchase.price))}</td>
                  <td className="px-2 py-3 text-right"><TinyStatus label="Overdue" /></td>
                </tr>
              )}
            />
          ) : null}
        </div>
      ) : null}

      {showPerformanceChart && showQuickActions ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_360px]">
          <section className={SURFACE_CLASS_NAME}>
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold uppercase tracking-[0.08em] text-slate-800">Projected Renewals vs Actual Collection</h2>
              </div>

              <select
                value={chartScope}
                onChange={(event) => setChartScope(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="This Month">This Month</option>
                <option value="This Quarter">This Quarter</option>
                <option value="This Year">This Year</option>
              </select>
            </div>

            <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_220px]">
              <StandardComboChart
                labels={MONTH_LABELS}
                barValues={chartSeries.projected}
                lineValues={chartSeries.actual}
                barLabel="Projected Renewals (P)"
                lineLabel="Actual Collection (P)"
                valueFormatter={(value) => formatCurrency(Math.round(value || 0)).replace('.00', '')}
                wrapperClassName={`${NESTED_SURFACE_CLASS_NAME} p-4`}
                minWidth={680}
                plotHeight={176}
              />

              <aside className={`${NESTED_SURFACE_CLASS_NAME} p-5`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total ({chartScope})</p>
                <div className="mt-4 space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Projected Renewals</p>
                    <p className="mt-2 text-2xl font-semibold text-[#2f6dff]">{formatCurrency(chartSeries.totalProjected)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Actual Collection</p>
                    <p className="mt-2 text-2xl font-semibold text-[#22a745]">{formatCurrency(chartSeries.totalActual)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Collection Rate</p>
                    <p className="mt-2 text-4xl font-semibold text-slate-900">{chartSeries.collectionRate.toFixed(2)}%</p>
                    <p className="mt-2 text-sm text-slate-500">Based on {chartSeries.currentMonthLabel.toLowerCase()} renewals and collected receipts.</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className={SURFACE_CLASS_NAME}>
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-semibold uppercase tracking-[0.08em] text-slate-800">Quick Actions</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionTile
                  key={action.key}
                  to={action.to}
                  icon={action.icon}
                  label={action.label}
                  hint={action.hint}
                  tone={action.tone}
                />
              ))}
            </div>
          </section>
        </div>
      ) : showPerformanceChart ? (
        <section className={SURFACE_CLASS_NAME}>
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.08em] text-slate-800">Projected Renewals vs Actual Collection</h2>
            </div>

            <select
              value={chartScope}
              onChange={(event) => setChartScope(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
            >
              <option value="This Month">This Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="This Year">This Year</option>
            </select>
          </div>

          <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_220px]">
            <StandardComboChart
              labels={MONTH_LABELS}
              barValues={chartSeries.projected}
              lineValues={chartSeries.actual}
              barLabel="Projected Renewals (P)"
              lineLabel="Actual Collection (P)"
              valueFormatter={(value) => formatCurrency(Math.round(value || 0)).replace('.00', '')}
              wrapperClassName={`${NESTED_SURFACE_CLASS_NAME} p-4`}
              minWidth={680}
              plotHeight={176}
            />

            <aside className={`${NESTED_SURFACE_CLASS_NAME} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total ({chartScope})</p>
              <div className="mt-4 space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Projected Renewals</p>
                  <p className="mt-2 text-2xl font-semibold text-[#2f6dff]">{formatCurrency(chartSeries.totalProjected)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Actual Collection</p>
                  <p className="mt-2 text-2xl font-semibold text-[#22a745]">{formatCurrency(chartSeries.totalActual)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Collection Rate</p>
                  <p className="mt-2 text-4xl font-semibold text-slate-900">{chartSeries.collectionRate.toFixed(2)}%</p>
                  <p className="mt-2 text-sm text-slate-500">Based on {chartSeries.currentMonthLabel.toLowerCase()} renewals and collected receipts.</p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : showQuickActions ? (
        <section className={SURFACE_CLASS_NAME}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-semibold uppercase tracking-[0.08em] text-slate-800">Quick Actions</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3 xl:grid-cols-6">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionTile
                key={action.key}
                to={action.to}
                icon={action.icon}
                label={action.label}
                hint={action.hint}
                tone={action.tone}
              />
            ))}
          </div>
        </section>
      ) : null}

      {showRecentActivity ? (
        <section className={SURFACE_CLASS_NAME}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
            <ReceiptText size={20} />
          </div>
          <h2 className="text-lg font-semibold uppercase tracking-[0.08em] text-slate-800">Recent Activity</h2>
        </div>

        <div className="overflow-x-auto px-4 pb-4 pt-3">
          <table className="min-w-full table-auto text-left text-sm text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <th className="px-2 py-2 font-semibold">Date &amp; Time</th>
                <th className="px-2 py-2 font-semibold">Activity</th>
                <th className="px-2 py-2 font-semibold">Reference</th>
                <th className="px-2 py-2 font-semibold">Client</th>
                <th className="px-2 py-2 font-semibold">Performed By</th>
                <th className="px-2 py-2 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length ? recentActivity.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-3 text-slate-600">{formatDashboardDateTime(item.date)}</td>
                  <td className="px-2 py-3 font-medium text-slate-800">{item.activity}</td>
                  <td className="px-2 py-3 text-slate-600">{item.reference}</td>
                  <td className="px-2 py-3 text-slate-600">{item.client}</td>
                  <td className="px-2 py-3 text-slate-600">{item.performedBy}</td>
                  <td className="px-2 py-3 text-right"><TinyStatus label={item.status} /></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-2 py-10 text-center text-sm text-slate-400">
                    No recent admin activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-4 py-3 text-center">
          <Link to="/admin/notifications" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            View All Activity
          </Link>
        </div>
      </section>
      ) : null}

      {visibleSummaryCards.length ? (
        <div className={getSummaryGridClass(visibleSummaryCards.length)}>
          {visibleSummaryCards.map((card) => (
          <SummaryCard
            key={card.widgetKey}
            tone={card.tone}
            icon={card.icon}
            label={card.label}
            value={card.value}
            helper={card.helper}
            onClick={() => setSelectedStatCard(card)}
          />
          ))}
        </div>
      ) : null}

      {selectedTimeline ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Timeline Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedTimeline.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{selectedTimeline.subtitle}</p>
              </div>
              <button type="button" onClick={() => setSelectedTimeline(null)} className="btn-secondary px-4">
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{selectedTimeline.label}</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatDateTime(selectedTimeline.value)}</p>
            </div>
          </div>
        </div>
      ) : null}

      {statCardModal}
      {dashboardCustomizerModal}
    </div>
  );
}
