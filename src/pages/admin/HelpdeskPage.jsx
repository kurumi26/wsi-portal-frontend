import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, LifeBuoy, Mail, MessageSquareText, PencilLine, Save, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { usePortal } from '../../context/PortalContext';
import { useTheme } from '../../context/ThemeContext';
import { appendTicketConversationMessage, buildHelpdeskSyncKey, getStoredOverrideForTicket, getTicketConversation, HELP_DESK_OVERRIDES_KEY, loadTicketOverrides, mergeTicketOverride } from '../../utils/helpdesk';
import { formatDateTime } from '../../utils/format';

const SUPPORT_COLLECTION_KEYS = [
  'supportTickets',
  'support_tickets',
  'supportRequests',
  'support_requests',
  'supportRequest',
  'support_request',
  'issueReports',
  'issue_reports',
  'issueReport',
  'issue_report',
  'serviceIssues',
  'service_issues',
  'tickets',
  'ticket',
  'helpdesk',
  'helpdeskTicket',
  'helpdesk_ticket',
  'incidents',
  'incident',
];
const DIRECT_MESSAGE_KEYS = [
  'supportMessage',
  'support_message',
  'issueMessage',
  'issue_message',
  'reportedIssue',
  'reported_issue',
  'latestIssue',
  'latest_issue',
  'lastSupportMessage',
  'last_support_message',
];
const TITLE_KEYS = ['title', 'subject', 'label', 'name', 'issueSubject', 'issue_subject', 'supportSubject', 'support_subject'];
const MESSAGE_KEYS = ['message', 'description', 'details', 'issue', 'body', 'content', 'note', 'report', 'summary'];
const STATUS_KEYS = ['status', 'state', 'ticketStatus', 'ticket_status', 'supportStatus', 'support_status', 'issueStatus', 'issue_status'];
const CREATED_AT_KEYS = ['createdAt', 'created_at', 'reportedAt', 'reported_at', 'submittedAt', 'submitted_at', 'openedAt', 'opened_at', 'date'];
const UPDATED_AT_KEYS = ['updatedAt', 'updated_at', 'respondedAt', 'responded_at', 'resolvedAt', 'resolved_at'];
const ASSIGNEE_KEYS = ['assignedTo', 'assigned_to', 'owner', 'handledBy', 'handled_by', 'agent', 'supportAgent', 'support_agent'];
const CLIENT_NAME_KEYS = ['client', 'clientName', 'client_name', 'customer', 'customerName', 'customer_name'];
const CLIENT_EMAIL_KEYS = ['clientEmail', 'client_email', 'customerEmail', 'customer_email', 'email'];
const CLIENT_ID_KEYS = ['userId', 'user_id', 'clientId', 'client_id', 'customerId', 'customer_id'];
const REFERENCE_KEYS = ['reference', 'ticketNumber', 'ticket_number', 'ticketId', 'ticket_id', 'caseNumber', 'case_number'];
const CATEGORY_KEYS = ['category', 'ticketCategory', 'ticket_category', 'issueCategory', 'issue_category', 'queue'];
const SERVICE_ID_KEYS = ['serviceId', 'service_id'];
const SUPPORT_KEYWORDS = ['support', 'ticket', 'issue', 'incident', 'helpdesk'];
const WORKFLOW_STATUS_OPTIONS = ['Open', 'In Progress', 'Escalated', 'Resolved', 'Closed'];

const normalizeText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getFirstPresent = (record, keys) => {
  if (!record || typeof record !== 'object') {
    return undefined;
  }

  return keys.reduce((found, key) => {
    if (found !== undefined) {
      return found;
    }

    const value = record[key];
    return value === undefined || value === null || value === '' ? undefined : value;
  }, undefined);
};

const toArray = (value) => {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const buildSupportSyncKey = ({ serviceId, serviceName, createdAt, reference, title, message }) => {
  return buildHelpdeskSyncKey({ serviceId, serviceName, createdAt, reference, title, message });
};

const pickMeaningfulText = (values, ignoredValues = []) => {
  for (const value of values) {
    const text = String(value ?? '').trim();

    if (!text) {
      continue;
    }

    const normalized = normalizeText(text);

    if (ignoredValues.includes(normalized)) {
      continue;
    }

    return text;
  }

  return undefined;
};

const toTitleLabel = (value) => String(value ?? '')
  .trim()
  .replace(/[_-]+/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const getAgentRoleLabel = (user) => {
  const directRole = String(user?.role ?? user?.roleLabel ?? '').trim();

  if (directRole) {
    return directRole;
  }

  const keyedRole = String(user?.roleKey ?? '').trim();

  if (keyedRole) {
    return toTitleLabel(keyedRole);
  }

  return 'Role unavailable';
};

const buildAgentDisplayLabel = (name, roleLabel) => {
  if (!name) {
    return 'Unassigned';
  }

  if (!roleLabel || roleLabel === 'Role unavailable') {
    return name;
  }

  return `${name} (${roleLabel})`;
};

const normalizeHelpdeskStatus = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return 'Open';
  }

  if (normalized.includes('resolved') || normalized.includes('fixed') || normalized.includes('done')) {
    return 'Resolved';
  }

  if (normalized.includes('closed')) {
    return 'Closed';
  }

  if (normalized.includes('progress') || normalized.includes('assigned') || normalized.includes('working') || normalized.includes('reviewed')) {
    return 'In Progress';
  }

  if (normalized.includes('escalated') || normalized.includes('urgent') || normalized.includes('critical')) {
    return 'Escalated';
  }

  return 'Open';
};

const getTicketSortTime = (ticket) => {
  const time = new Date(ticket?.updatedAt ?? ticket?.createdAt ?? 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getDateTimeValue = (value) => {
  const time = new Date(value ?? 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getHoursDifference = (startValue, endValue) => {
  const start = new Date(startValue ?? 0).getTime();
  const end = new Date(endValue ?? 0).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return null;
  }

  return (end - start) / (1000 * 60 * 60);
};

const buildSupportTitle = (candidate, service) => {
  const explicitTitle = getFirstPresent(candidate, TITLE_KEYS);

  if (explicitTitle) {
    return String(explicitTitle).trim();
  }

  return `Support request for ${service?.name ?? 'service'}`;
};

const buildSupportTicketRecord = (candidate, service, index, clientDetails = {}) => {
  const message = typeof candidate === 'string'
    ? candidate.trim()
    : String(getFirstPresent(candidate, MESSAGE_KEYS) ?? '').trim();

  if (!message) {
    return null;
  }

  const createdAt = typeof candidate === 'object'
    ? getFirstPresent(candidate, CREATED_AT_KEYS) ?? service?.updatedAt ?? service?.createdAt ?? null
    : service?.updatedAt ?? service?.createdAt ?? null;
  const updatedAt = typeof candidate === 'object'
    ? getFirstPresent(candidate, UPDATED_AT_KEYS) ?? createdAt
    : createdAt;
  const assignedTo = typeof candidate === 'object' ? getFirstPresent(candidate, ASSIGNEE_KEYS) ?? null : null;
  const clientName = clientDetails.name ?? (typeof candidate === 'object'
    ? getFirstPresent(candidate, CLIENT_NAME_KEYS) ?? service?.client ?? service?.customer ?? 'Unknown client'
    : service?.client ?? service?.customer ?? 'Unknown client');
  const clientEmail = clientDetails.email ?? (typeof candidate === 'object'
    ? getFirstPresent(candidate, CLIENT_EMAIL_KEYS) ?? service?.clientEmail ?? service?.customer_email ?? 'No email'
    : service?.clientEmail ?? service?.customer_email ?? 'No email');
  const status = typeof candidate === 'object'
    ? normalizeHelpdeskStatus(getFirstPresent(candidate, STATUS_KEYS))
    : normalizeHelpdeskStatus(service?.supportStatus ?? service?.issueStatus ?? 'Open');
  const reference = typeof candidate === 'object' ? getFirstPresent(candidate, REFERENCE_KEYS) : undefined;
  const category = typeof candidate === 'object' ? getFirstPresent(candidate, CATEGORY_KEYS) : undefined;

  return {
    id: `service-ticket-${String((typeof candidate === 'object' && candidate?.id) ?? `${service?.id ?? 'unknown'}-${index}`)}`,
    syncKey: buildSupportSyncKey({
      serviceId: service?.id ?? null,
      serviceName: service?.name ?? 'unknown service',
      createdAt,
      reference,
      title: buildSupportTitle(candidate, service),
      message,
    }),
    dedupeKey: `${service?.id ?? 'service'}::${normalizeText(buildSupportTitle(candidate, service))}::${normalizeText(message)}`,
    title: buildSupportTitle(candidate, service),
    message,
    status,
    createdAt,
    updatedAt,
    assignedTo: assignedTo ? String(assignedTo) : null,
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? 'Unknown service',
    serviceCategory: service?.category ?? '',
    clientName,
    clientEmail,
    sourceLabel: 'Service report',
    reference: reference ? String(reference) : null,
    category: category ? String(category) : null,
  };
};

const extractSupportTicketsFromService = (service, resolveClientDetails) => {
  const candidates = [];

  SUPPORT_COLLECTION_KEYS.forEach((key) => {
    candidates.push(...toArray(service?.[key]));
  });

  DIRECT_MESSAGE_KEYS.forEach((key) => {
    const value = service?.[key];

    if (typeof value === 'string' && value.trim()) {
      candidates.push({
        title: `Support request for ${service?.name ?? 'service'}`,
        message: value.trim(),
        status: service?.supportStatus ?? service?.issueStatus ?? 'Open',
        createdAt: service?.updatedAt ?? service?.createdAt,
        updatedAt: service?.updatedAt ?? service?.createdAt,
      });
    }
  });

  return candidates
    .map((candidate, index) => buildSupportTicketRecord(
      candidate,
      service,
      index,
      resolveClientDetails ? resolveClientDetails(candidate, service, null) : undefined,
    ))
    .filter(Boolean);
};

const isSupportNotification = (notification) => {
  const haystack = normalizeText([notification?.title, notification?.message, notification?.type].filter(Boolean).join(' '));
  return SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
};

const buildTicketFromNotification = (notification, service, index, clientDetails = {}) => {
  const message = String(notification?.message ?? '').trim();

  if (!message) {
    return null;
  }

  return {
    id: `notification-ticket-${String(notification?.id ?? index)}`,
    syncKey: buildSupportSyncKey({
      serviceId: service?.id ?? notification?.data?.serviceId ?? null,
      serviceName: service?.name ?? notification?.title ?? 'support alert',
      createdAt: notification?.createdAt ?? null,
      reference: notification?.id ? `#N-${String(notification.id).padStart(3, '0')}` : null,
      title: notification?.title ?? 'Support alert',
      message,
    }),
    dedupeKey: `${service?.id ?? notification?.id ?? 'notification'}::${normalizeText(notification?.title ?? '')}::${normalizeText(message)}`,
    title: String(notification?.title ?? 'Support alert').trim(),
    message,
    status: normalizeHelpdeskStatus(notification?.status ?? (notification?.isRead ? 'In Progress' : 'Open')),
    createdAt: notification?.createdAt ?? null,
    updatedAt: notification?.updatedAt ?? notification?.createdAt ?? null,
    assignedTo: null,
    serviceId: service?.id ?? notification?.data?.serviceId ?? null,
    serviceName: service?.name ?? 'Unlinked service',
    serviceCategory: service?.category ?? '',
    clientName: clientDetails.name ?? service?.client ?? service?.customer ?? 'Unknown client',
    clientEmail: clientDetails.email ?? service?.clientEmail ?? service?.customer_email ?? 'No email',
    sourceLabel: 'Admin alert',
    reference: notification?.id ? `#N-${String(notification.id).padStart(3, '0')}` : null,
    category: notification?.type ?? null,
  };
};

const dedupeTickets = (tickets) => {
  const seen = new Set();

  return tickets.filter((ticket) => {
    if (!ticket?.dedupeKey || seen.has(ticket.dedupeKey)) {
      return false;
    }

    seen.add(ticket.dedupeKey);
    return true;
  });
};

const deriveTicketCategory = (ticket) => {
  const explicit = normalizeText(ticket?.category);

  if (explicit) {
    if (explicit.includes('bill')) return 'Billing';
    if (explicit.includes('access') || explicit.includes('account') || explicit.includes('login')) return 'Access';
    if (explicit.includes('domain')) return 'Domain';
    if (explicit.includes('sale')) return 'Sales';
    if (explicit.includes('tech') || explicit.includes('incident') || explicit.includes('support')) return 'Technical';
  }

  const haystack = normalizeText([ticket?.title, ticket?.message, ticket?.serviceName, ticket?.serviceCategory].filter(Boolean).join(' '));

  if (haystack.includes('payment') || haystack.includes('invoice') || haystack.includes('billing') || haystack.includes('subscription') || haystack.includes('refund')) {
    return 'Billing';
  }

  if (haystack.includes('password') || haystack.includes('login') || haystack.includes('access') || haystack.includes('account')) {
    return 'Access';
  }

  if (haystack.includes('domain') || haystack.includes('dns') || haystack.includes('transfer') || haystack.includes('whois')) {
    return 'Domain';
  }

  if (haystack.includes('website') || haystack.includes('hosting') || haystack.includes('server') || haystack.includes('ssl') || haystack.includes('ram') || haystack.includes('cpu') || haystack.includes('slow')) {
    return 'Technical';
  }

  return 'Technical';
};

const deriveDisplayStatus = (ticket) => {
  const normalizedStatus = normalizeText(ticket?.status);
  const haystack = normalizeText([ticket?.title, ticket?.message].filter(Boolean).join(' '));

  if (normalizedStatus === 'escalated') {
    return 'Critical';
  }

  if (normalizedStatus === 'resolved') {
    return 'Resolved';
  }

  if (normalizedStatus === 'closed') {
    return haystack.includes('cancel') ? 'Cancelled' : 'Resolved';
  }

  return 'Ongoing';
};

const getStatusMeta = (status) => {
  if (status === 'Critical') {
    return 'border border-rose-300/20 bg-rose-500/15 text-rose-300';
  }

  if (status === 'Resolved') {
    return 'border border-emerald-300/20 bg-emerald-500/15 text-emerald-300';
  }

  if (status === 'Cancelled') {
    return 'border border-slate-300/20 bg-slate-500/15 text-slate-300';
  }

  return 'border border-sky-300/20 bg-sky-400/15 text-sky-200';
};

const getAgingMeta = (ticket, now) => {
  const createdTime = new Date(ticket?.createdAt ?? 0).getTime();

  if (Number.isNaN(createdTime) || !createdTime) {
    return {
      label: '—',
      minutes: 0,
      classes: 'border border-slate-300/20 bg-slate-500/10 text-slate-300',
    };
  }

  const totalMinutes = Math.max(1, Math.ceil((now - createdTime) / (1000 * 60)));
  const totalHours = Math.max(1, Math.ceil(totalMinutes / 60));

  if (totalMinutes < 60) {
    return {
      label: `${totalMinutes}m`,
      minutes: totalMinutes,
      classes: 'border border-emerald-300/20 bg-emerald-500/10 text-emerald-300',
    };
  }

  if (totalHours <= 6) {
    return {
      label: `${totalHours}h`,
      minutes: totalMinutes,
      classes: 'border border-emerald-300/20 bg-emerald-500/10 text-emerald-300',
    };
  }

  if (totalHours <= 24) {
    return {
      label: `${totalHours}h`,
      minutes: totalMinutes,
      classes: 'border border-amber-300/20 bg-amber-500/10 text-amber-300',
    };
  }

  return {
    label: `${totalHours}h`,
    minutes: totalMinutes,
    classes: 'border border-rose-300/20 bg-rose-500/10 text-rose-300',
  };
};

const getAgentMeta = (ticket, agentDirectory) => {
  if (ticket?.assignedTo) {
    const matchedAgent = agentDirectory.get(normalizeText(ticket.assignedTo)) ?? null;
    const roleLabel = matchedAgent?.roleLabel ?? 'Role unavailable';

    return {
      label: ticket.assignedTo,
      roleLabel,
      displayLabel: buildAgentDisplayLabel(ticket.assignedTo, roleLabel),
      filterValue: ticket.assignedTo,
      classes: 'border border-white/10 bg-white/5 text-slate-200',
    };
  }

  return {
    label: 'Unassigned',
    roleLabel: 'No agent assigned',
    displayLabel: 'Unassigned',
    filterValue: 'Unassigned',
    classes: 'border border-slate-300/20 bg-slate-500/10 text-slate-400',
  };
};

const getActionButtonClasses = (variant, isDarkMode) => {
  const styles = {
    email: isDarkMode
      ? 'border-sky-300/25 bg-sky-400/12 text-sky-300 hover:bg-sky-400/18'
      : 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm hover:bg-sky-100',
    manage: isDarkMode
      ? 'border-cyan-300/25 bg-cyan-400/12 text-cyan-300 hover:bg-cyan-400/18'
      : 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm hover:bg-cyan-100',
    details: isDarkMode
      ? 'border-white/12 bg-white/7 text-slate-200 hover:bg-white/12'
      : 'border-slate-200 bg-slate-100 text-slate-700 shadow-sm hover:bg-slate-200',
    service: isDarkMode
      ? 'border-emerald-300/25 bg-emerald-400/12 text-emerald-300 hover:bg-emerald-400/18'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100',
  };

  return `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${styles[variant]}`;
};

const formatResolutionValue = (hours) => {
  if (hours === null || hours === undefined || Number.isNaN(hours)) {
    return '—';
  }

  return `${hours.toFixed(1)}h`;
};

const getWeeklyDelta = (tickets, now) => {
  const startOfThisWeek = now - 7 * 24 * 60 * 60 * 1000;
  const startOfLastWeek = now - 14 * 24 * 60 * 60 * 1000;

  const thisWeek = tickets.filter((ticket) => getTicketSortTime(ticket) >= startOfThisWeek).length;
  const lastWeek = tickets.filter((ticket) => {
    const time = getTicketSortTime(ticket);
    return time >= startOfLastWeek && time < startOfThisWeek;
  }).length;

  if (!lastWeek) {
    return thisWeek ? `+${thisWeek} this week` : 'No change this week';
  }

  const delta = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

  if (delta > 0) {
    return `+${delta}% vs last week`;
  }

  if (delta < 0) {
    return `${delta}% vs last week`;
  }

  return 'No change vs last week';
};

export default function HelpdeskPage() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const { adminServices, adminUsers, clients, notifications } = usePortal();
  const [now, setNow] = useState(() => Date.now());
  const [ticketOverrides, setTicketOverrides] = useState(() => loadTicketOverrides());
  const [draftFilters, setDraftFilters] = useState({
    client: 'All Clients',
    agent: 'All Agents',
    category: 'All Categories',
    status: 'All Statuses',
    dateFrom: '',
  });
  const [activeFilters, setActiveFilters] = useState({
    client: 'All Clients',
    agent: 'All Agents',
    category: 'All Categories',
    status: 'All Statuses',
    dateFrom: '',
  });
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [assignedAgentDraft, setAssignedAgentDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('Open');
  const [workflowFeedback, setWorkflowFeedback] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [replyFeedback, setReplyFeedback] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(HELP_DESK_OVERRIDES_KEY, JSON.stringify(ticketOverrides));
    } catch {
      // ignore storage write failures
    }
  }, [ticketOverrides]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleStorage = (event) => {
      if (event.key === HELP_DESK_OVERRIDES_KEY) {
        setTicketOverrides(loadTicketOverrides());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!selectedTicketId) {
      document.body.classList.remove('helpdesk-focus-modal-open');
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.classList.add('helpdesk-focus-modal-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('helpdesk-focus-modal-open');
      document.body.style.overflow = '';
    };
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicketId) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedTicketId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTicketId]);

  const adminServicesById = useMemo(
    () => new Map(adminServices.map((service) => [String(service.id), service])),
    [adminServices],
  );
  const clientsById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client])),
    [clients],
  );
  const clientsByEmail = useMemo(
    () => new Map(clients.filter((client) => client?.email).map((client) => [normalizeText(client.email), client])),
    [clients],
  );
  const clientsByName = useMemo(
    () => new Map(clients.filter((client) => client?.name).map((client) => [normalizeText(client.name), client])),
    [clients],
  );
  const agentDirectory = useMemo(() => {
    const directory = new Map();

    adminUsers.forEach((user) => {
      const name = String(user?.name ?? '').trim();

      if (!name) {
        return;
      }

      const key = normalizeText(name);

      if (!key || directory.has(key)) {
        return;
      }

      directory.set(key, {
        name,
        roleLabel: getAgentRoleLabel(user),
      });
    });

    return directory;
  }, [adminUsers]);

  const resolveClientDetails = (candidate, service, notification) => {
    const candidateName = typeof candidate === 'object' ? getFirstPresent(candidate, CLIENT_NAME_KEYS) : undefined;
    const candidateEmail = typeof candidate === 'object' ? getFirstPresent(candidate, CLIENT_EMAIL_KEYS) : undefined;
    const notificationName = getFirstPresent(notification?.data, CLIENT_NAME_KEYS) ?? getFirstPresent(notification, CLIENT_NAME_KEYS);
    const notificationEmail = getFirstPresent(notification?.data, CLIENT_EMAIL_KEYS) ?? getFirstPresent(notification, CLIENT_EMAIL_KEYS);
    const serviceName = service?.client ?? service?.clientName ?? service?.customer ?? service?.customerName;
    const serviceEmail = service?.clientEmail ?? service?.client_email ?? service?.customerEmail ?? service?.customer_email;
    const userId = [
      typeof candidate === 'object' ? getFirstPresent(candidate, CLIENT_ID_KEYS) : undefined,
      getFirstPresent(service, CLIENT_ID_KEYS),
      getFirstPresent(notification?.data, CLIENT_ID_KEYS),
      getFirstPresent(notification, CLIENT_ID_KEYS),
    ].find((value) => value !== undefined && value !== null && value !== '');
    const preferredName = pickMeaningfulText(
      [candidateName, notificationName, serviceName],
      ['unknown client', 'no client assigned'],
    );
    const preferredEmail = pickMeaningfulText(
      [candidateEmail, notificationEmail, serviceEmail],
      ['no email'],
    );

    let matchedClient = null;

    if (userId !== undefined) {
      matchedClient = clientsById.get(String(userId)) ?? null;
    }

    if (!matchedClient && preferredEmail) {
      matchedClient = clientsByEmail.get(normalizeText(preferredEmail)) ?? null;
    }

    if (!matchedClient && preferredName) {
      matchedClient = clientsByName.get(normalizeText(preferredName)) ?? null;
    }

    return {
      name: preferredName ?? matchedClient?.name ?? 'Unknown client',
      email: preferredEmail ?? matchedClient?.email ?? 'No email',
    };
  };

  const findLinkedServiceForNotification = (notification) => {
    const directServiceId = getFirstPresent(notification?.data, SERVICE_ID_KEYS) ?? getFirstPresent(notification, SERVICE_ID_KEYS);

    if (directServiceId !== undefined && directServiceId !== null && directServiceId !== '') {
      return adminServicesById.get(String(directServiceId)) ?? null;
    }

    const haystack = normalizeText([notification?.title, notification?.message].filter(Boolean).join(' '));

    if (!haystack) {
      return null;
    }

    return adminServices.find((service) => {
      return [service?.name, service?.serviceName, service?.domain]
        .filter(Boolean)
        .some((value) => {
          const normalizedValue = normalizeText(value);
          return normalizedValue && haystack.includes(normalizedValue);
        });
    }) ?? null;
  };

  const rawTickets = useMemo(() => {
    const serviceTickets = adminServices.flatMap((service) => extractSupportTicketsFromService(service, resolveClientDetails));
    const notificationTickets = notifications
      .filter((notification) => isSupportNotification(notification))
      .map((notification, index) => {
        const linkedService = findLinkedServiceForNotification(notification);
        return buildTicketFromNotification(
          notification,
          linkedService,
          index,
          resolveClientDetails(null, linkedService, notification),
        );
      })
      .filter(Boolean);

    return dedupeTickets([...serviceTickets, ...notificationTickets])
      .sort((left, right) => getTicketSortTime(right) - getTicketSortTime(left));
  }, [adminServices, adminServicesById, clientsByEmail, clientsById, clientsByName, notifications]);

  const tickets = useMemo(() => {
    const hydratedTickets = rawTickets.map((ticket, index) => {
      const override = getStoredOverrideForTicket(ticketOverrides, ticket);
      const status = normalizeHelpdeskStatus(override.status ?? ticket.status);
      const assignedTo = override.assignedTo === null
        ? null
        : (override.assignedTo ?? ticket.assignedTo ?? null);
      const updatedAt = override.updatedAt ?? ticket.updatedAt;
      const displayStatus = deriveDisplayStatus({ ...ticket, status });
      const createdTime = getTicketSortTime(ticket);
      const agent = getAgentMeta({ assignedTo }, agentDirectory);
      const conversation = getTicketConversation(ticket, override, { clientLabel: ticket.clientName });
      const latestConversationEntry = conversation[conversation.length - 1] ?? null;
      const isConversationOpen = !['Resolved', 'Closed'].includes(status);
      const hasUnreadClientMessage = Boolean(
        isConversationOpen
        && latestConversationEntry?.senderRole === 'client'
        && getDateTimeValue(latestConversationEntry.createdAt) > getDateTimeValue(override.lastAdminSeenAt)
      );

      return {
        ...ticket,
        assignedTo,
        status,
        updatedAt,
        reference: ticket.reference ?? `#T-${String(index + 101).padStart(3, '0')}`,
        categoryLabel: deriveTicketCategory(ticket),
        displayStatus,
        aging: getAgingMeta(ticket, now),
        agent,
        createdTime,
        conversation,
        hasUnreadClientMessage,
      };
    });

    return hydratedTickets.sort((left, right) => getTicketSortTime(right) - getTicketSortTime(left));
  }, [agentDirectory, now, rawTickets, ticketOverrides]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  const supportAgents = useMemo(() => {
    const dedicatedSupportAgents = adminUsers.filter((user) => normalizeText(user?.role).includes('technical support'));
    const sourceUsers = dedicatedSupportAgents.length ? dedicatedSupportAgents : adminUsers;
    const uniqueAgents = new Map();

    sourceUsers.forEach((user) => {
      const name = String(user?.name ?? '').trim();

      if (!name || uniqueAgents.has(name)) {
        return;
      }

      const roleLabel = getAgentRoleLabel(user);

      uniqueAgents.set(name, {
        name,
        roleLabel,
        displayLabel: buildAgentDisplayLabel(name, roleLabel),
      });
    });

    return Array.from(uniqueAgents.values());
  }, [adminUsers]);

  const selectedAssignedAgent = useMemo(
    () => (assignedAgentDraft ? agentDirectory.get(normalizeText(assignedAgentDraft)) ?? null : null),
    [agentDirectory, assignedAgentDraft],
  );

  useEffect(() => {
    if (!selectedTicket) {
      setAssignedAgentDraft('');
      setStatusDraft('Open');
      setWorkflowFeedback('');
      setReplyDraft('');
      setReplyFeedback(null);
      return;
    }

    setAssignedAgentDraft(selectedTicket.assignedTo ?? '');
    setStatusDraft(selectedTicket.status);
    setWorkflowFeedback('');
    setReplyDraft('');
    setReplyFeedback(null);
  }, [selectedTicket]);

  useEffect(() => {
    if (!selectedTicket?.hasUnreadClientMessage) {
      return;
    }

    const latestConversationEntry = selectedTicket.conversation[selectedTicket.conversation.length - 1] ?? null;

    if (!latestConversationEntry || latestConversationEntry.senderRole !== 'client') {
      return;
    }

    setTicketOverrides((current) => mergeTicketOverride(current, selectedTicket, {
      lastAdminSeenAt: latestConversationEntry.createdAt,
    }));
  }, [selectedTicket]);

  const clientOptions = useMemo(
    () => ['All Clients', ...Array.from(new Set(tickets.map((ticket) => ticket.clientName).filter(Boolean)))],
    [tickets],
  );
  const agentOptions = useMemo(() => {
    const options = [{ value: 'All Agents', label: 'All Agents' }];
    const seen = new Set(['All Agents']);

    supportAgents.forEach((agent) => {
      if (seen.has(agent.name)) {
        return;
      }

      seen.add(agent.name);
      options.push({ value: agent.name, label: agent.displayLabel });
    });

    tickets.forEach((ticket) => {
      const value = ticket.agent.filterValue;

      if (!value || seen.has(value)) {
        return;
      }

      seen.add(value);
      options.push({ value, label: ticket.agent.displayLabel });
    });

    return options;
  }, [supportAgents, tickets]);
  const categoryOptions = useMemo(
    () => ['All Categories', ...Array.from(new Set(tickets.map((ticket) => ticket.categoryLabel).filter(Boolean)))],
    [tickets],
  );
  const statusOptions = ['All Statuses', ...WORKFLOW_STATUS_OPTIONS];

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (activeFilters.client !== 'All Clients' && ticket.clientName !== activeFilters.client) {
        return false;
      }

      if (activeFilters.agent !== 'All Agents' && ticket.agent.filterValue !== activeFilters.agent) {
        return false;
      }

      if (activeFilters.category !== 'All Categories' && ticket.categoryLabel !== activeFilters.category) {
        return false;
      }

      if (activeFilters.status !== 'All Statuses' && ticket.status !== activeFilters.status) {
        return false;
      }

      if (activeFilters.dateFrom) {
        const startTime = new Date(activeFilters.dateFrom).getTime();

        if (!Number.isNaN(startTime) && ticket.createdTime < startTime) {
          return false;
        }
      }

      return true;
    });
  }, [activeFilters, tickets]);

  const criticalTickets = useMemo(() => {
    return tickets.filter((ticket) => ticket.displayStatus === 'Critical' || ticket.aging.minutes >= 24 * 60).length;
  }, [tickets]);

  const totalOpen = useMemo(() => {
    return tickets.filter((ticket) => ticket.displayStatus === 'Ongoing' || ticket.displayStatus === 'Critical').length;
  }, [tickets]);

  const averageResolutionHours = useMemo(() => {
    const durations = tickets
      .filter((ticket) => ticket.displayStatus === 'Resolved' || ticket.displayStatus === 'Cancelled')
      .map((ticket) => getHoursDifference(ticket.createdAt, ticket.updatedAt))
      .filter((value) => value !== null);

    if (!durations.length) {
      return null;
    }

    return durations.reduce((sum, value) => sum + value, 0) / durations.length;
  }, [tickets]);

  const monthlyVolume = useMemo(() => {
    const current = new Date(now);
    const month = current.getMonth();
    const year = current.getFullYear();

    return tickets.filter((ticket) => {
      const time = new Date(ticket.createdAt ?? 0);
      return !Number.isNaN(time.getTime()) && time.getMonth() === month && time.getFullYear() === year;
    }).length;
  }, [now, tickets]);

  const summaryCards = [
    {
      label: 'Total Open',
      value: totalOpen,
      helper: getWeeklyDelta(tickets, now),
      helperClass: 'text-sky-300',
      accentClass: 'border-l-[3px] border-l-sky-400',
    },
    {
      label: 'Critical Tickets',
      value: criticalTickets,
      helper: criticalTickets ? 'Action required' : 'No escalations',
      helperClass: criticalTickets ? 'text-rose-300' : 'text-slate-400',
      accentClass: 'border-l-[3px] border-l-rose-400',
    },
    {
      label: 'Avg Resolution',
      value: formatResolutionValue(averageResolutionHours),
      helper: averageResolutionHours === null ? 'Awaiting completed tickets' : 'Efficiency: monitored',
      helperClass: 'text-emerald-300',
      accentClass: 'border-l-[3px] border-l-emerald-400',
    },
    {
      label: 'Monthly Volume',
      value: monthlyVolume,
      helper: monthlyVolume ? `${monthlyVolume} logged this month` : 'No tickets this month',
      helperClass: 'text-slate-400',
      accentClass: 'border-l-[3px] border-l-cyan-400',
    },
  ];

  const applyFilters = () => {
    setActiveFilters(draftFilters);
  };

  const handleSaveWorkflow = () => {
    if (!selectedTicket) {
      return;
    }

    setTicketOverrides((current) => mergeTicketOverride(current, selectedTicket, {
      assignedTo: assignedAgentDraft || null,
      status: statusDraft,
      updatedAt: new Date().toISOString(),
    }));
    setWorkflowFeedback('Assignment and status updated.');
  };

  const handleSendReply = () => {
    if (!selectedTicket) {
      return;
    }

    const normalizedReply = replyDraft.trim();

    if (!normalizedReply) {
      setReplyFeedback({ type: 'error', message: 'Enter a reply before sending it to the client.' });
      return;
    }

    const nextStatus = selectedTicket.status === 'Open' ? 'In Progress' : selectedTicket.status;

    setTicketOverrides((current) => appendTicketConversationMessage(current, selectedTicket, {
      message: normalizedReply,
      senderRole: 'admin',
      senderLabel: user?.name ? `${user.name} (Admin)` : 'Support team',
      status: nextStatus,
    }));
    setStatusDraft(nextStatus);
    setReplyDraft('');
    setReplyFeedback({ type: 'success', message: 'Reply added to the ticket conversation.' });
  };

  return (
    <div>
      <PageHeader title="Tickets Central" />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`panel rounded-3xl p-4 ${card.accentClass}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
            <p className="mt-2 text-4xl font-semibold text-white">{card.value}</p>
            <p className={`mt-1 text-sm ${card.helperClass}`}>{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="panel mb-6 rounded-3xl p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.15fr_1.15fr_1fr_1fr_1.1fr_auto]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Client</span>
            <select
              value={draftFilters.client}
              onChange={(event) => setDraftFilters((current) => ({ ...current, client: event.target.value }))}
              className="input mt-2 h-11 py-2.5"
            >
              {clientOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Agent</span>
            <select
              value={draftFilters.agent}
              onChange={(event) => setDraftFilters((current) => ({ ...current, agent: event.target.value }))}
              className="input mt-2 h-11 py-2.5"
            >
              {agentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Category</span>
            <select
              value={draftFilters.category}
              onChange={(event) => setDraftFilters((current) => ({ ...current, category: event.target.value }))}
              className="input mt-2 h-11 py-2.5"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ticket Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
              className="input mt-2 h-11 py-2.5"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Date Range</span>
            <div className="relative mt-2">
              <CalendarDays size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={draftFilters.dateFrom}
                onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                className="input h-11 py-2.5 pl-11"
              />
            </div>
          </label>

          <div className="flex items-end">
            <button type="button" onClick={applyFilters} className="btn-primary h-11 min-w-28 px-5 py-2.5">
              Filter
            </button>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden rounded-3xl">
        {filteredTickets.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-4">Ticket Info</th>
                  <th className="px-4 py-4">Client</th>
                  <th className="px-4 py-4">Agent</th>
                  <th className="px-4 py-4">Aging</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="table-row-hoverable border-b border-white/6 align-top last:border-b-0">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-sky-300">{ticket.reference}</p>
                      <p className="mt-1 font-medium text-white">{ticket.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{ticket.categoryLabel}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">{ticket.clientName}</p>
                      <p className="mt-1 text-xs text-slate-500">{ticket.clientEmail}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ticket.agent.classes}`}>
                          {ticket.agent.label}
                        </span>
                        <span className="text-xs text-slate-500">{ticket.agent.roleLabel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${ticket.aging.classes}`}>
                        {ticket.aging.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <StatusBadge status={ticket.status} />
                        <span className="text-xs text-slate-500">{ticket.displayStatus}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className={`${getActionButtonClasses('email', isDarkMode)} relative`}
                          title={ticket.hasUnreadClientMessage ? 'Open ticket conversation (new client reply)' : 'Open ticket conversation'}
                          aria-label={ticket.hasUnreadClientMessage ? `Open conversation for ${ticket.reference} with new client reply` : `Open conversation for ${ticket.reference}`}
                        >
                          <MessageSquareText size={16} strokeWidth={2.25} />
                          {ticket.hasUnreadClientMessage ? (
                            <span className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-rose-500" aria-hidden="true" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className={getActionButtonClasses('manage', isDarkMode)}
                          title="Assign agent and edit status"
                          aria-label={`Manage workflow for ${ticket.reference}`}
                        >
                          <PencilLine size={16} strokeWidth={2.25} />
                        </button>
                        {ticket.serviceId ? (
                          <Link
                            to="/admin/client-services"
                            className={getActionButtonClasses('service', isDarkMode)}
                            title="Open client service"
                            aria-label={`Open client service for ${ticket.reference}`}
                          >
                            <ArrowUpRight size={16} strokeWidth={2.25} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedTicketId(ticket.id)}
                            className={getActionButtonClasses('service', isDarkMode)}
                            title="Review ticket"
                            aria-label={`Review ${ticket.reference}`}
                          >
                            <ArrowUpRight size={16} strokeWidth={2.25} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
              <LifeBuoy size={24} />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">No tickets found</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Support tickets will appear here after customers submit service issues, or when support alerts are routed into the admin queue.
            </p>
          </div>
        )}
      </div>

      {selectedTicket ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-md sm:p-5 lg:p-6">
          <div className="panel support-ticket-modal-panel ticket-modal-shell flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl">
            <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-start lg:justify-between lg:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedTicket.status} />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                    {selectedTicket.categoryLabel}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-white">{selectedTicket.reference} · {selectedTicket.title}</h3>
              </div>
              <button type="button" onClick={() => setSelectedTicketId(null)} className="btn-secondary px-4">Close</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-5 lg:px-6 lg:pb-6">
              <div className="grid gap-4 lg:items-start lg:grid-cols-[1.05fr_0.95fr]">
                <div className="ticket-modal-section rounded-3xl border border-white/10 bg-white/5 p-5 lg:self-start">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ticket conversation</p>
                    <span className="ticket-modal-chip rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {selectedTicket.conversation.length} message{selectedTicket.conversation.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="ticket-thread-shell mt-4 max-h-[22rem] space-y-3 overflow-y-auto rounded-2xl border border-sky-300/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(255,255,255,0.05)_60%,rgba(251,146,60,0.08))] p-4">
                    {selectedTicket.conversation.map((entry) => {
                      const isAdminMessage = entry.senderRole === 'admin';

                      return (
                        <div key={entry.id} className={`flex ${isAdminMessage ? 'justify-end' : 'justify-start'}`}>
                          <div className={`ticket-thread-message max-w-[88%] rounded-2xl border px-4 py-3 ${isAdminMessage ? 'ticket-thread-message--admin border-cyan-300/30 bg-cyan-400/15 text-slate-50' : 'ticket-thread-message--client border-white/10 bg-slate-950/30 text-slate-100'}`}>
                            <div className="ticket-thread-meta">
                              <span className="ticket-thread-role">{isAdminMessage ? 'Admin' : 'Client'}</span>
                              <span className="ticket-thread-author">{entry.senderLabel}</span>
                            </div>
                            <p className="ticket-thread-copy mt-2 whitespace-pre-wrap text-sm leading-6 text-current">{entry.message}</p>
                            <p className="ticket-thread-time mt-2 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="ticket-compose-panel mt-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Reply to client</span>
                      <textarea
                        value={replyDraft}
                        onChange={(event) => setReplyDraft(event.target.value)}
                        className="input ticket-compose-input mt-2 min-h-28"
                        placeholder="Write an update, question, or resolution note for the client..."
                      />
                    </label>

                    {replyFeedback ? (
                      <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${replyFeedback.type === 'success' ? 'border-emerald-300/20 bg-emerald-500/10 text-emerald-200' : 'border-rose-300/20 bg-rose-500/10 text-rose-200'}`}>
                        {replyFeedback.message}
                      </div>
                    ) : null}

                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={handleSendReply} className="btn-primary gap-2 px-4 py-3">
                        <MessageSquareText size={16} /> Send reply
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="ticket-modal-section rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ticket details</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div>
                        <p className="text-slate-500">Client</p>
                        <p className="mt-1 flex items-center gap-2 text-white"><UserRound size={14} className="text-slate-400" /> {selectedTicket.clientName}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Email</p>
                        <p className="mt-1 flex items-center gap-2 text-white"><Mail size={14} className="text-slate-400" /> {selectedTicket.clientEmail}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Assigned agent</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-white">{selectedTicket.agent.label}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                            {selectedTicket.agent.roleLabel}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500">Reported</p>
                        <p className="mt-1 text-white">{formatDateTime(selectedTicket.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Last update</p>
                        <p className="mt-1 text-white">{formatDateTime(selectedTicket.updatedAt)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="ticket-modal-section rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assignment & workflow</p>
                    <div className="mt-4 space-y-4">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assigned agent</span>
                        <select
                          value={assignedAgentDraft}
                          onChange={(event) => setAssignedAgentDraft(event.target.value)}
                          className="input mt-2 h-11 py-2.5"
                        >
                          <option value="">Unassigned</option>
                          {supportAgents.map((agent) => (
                            <option key={agent.name} value={agent.name}>{agent.name}</option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                          {selectedAssignedAgent ? `Role: ${selectedAssignedAgent.roleLabel}` : 'Role will appear after you select an agent.'}
                        </p>
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ticket status</span>
                        <select
                          value={statusDraft}
                          onChange={(event) => setStatusDraft(event.target.value)}
                          className="input mt-2 h-11 py-2.5"
                        >
                          {WORKFLOW_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>

                      {workflowFeedback ? (
                        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                          {workflowFeedback}
                        </div>
                      ) : null}

                      <button type="button" onClick={handleSaveWorkflow} className="btn-primary gap-2 px-4 py-3">
                        <Save size={16} /> Save workflow
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
