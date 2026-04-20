import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BellRing, BookOpen, Clock3, FileText, Headphones, LifeBuoy, Mail, MessageSquareText, PhoneCall } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { usePortal } from '../../context/PortalContext';
import { appendTicketConversationMessage, buildHelpdeskSyncKey, getStoredOverrideForTicket, getTicketConversation, HELP_DESK_OVERRIDES_KEY, loadTicketOverrides } from '../../utils/helpdesk';
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
const REFERENCE_KEYS = ['reference', 'ticketNumber', 'ticket_number', 'ticketId', 'ticket_id', 'caseNumber', 'case_number'];
const CATEGORY_KEYS = ['category', 'ticketCategory', 'ticket_category', 'issueCategory', 'issue_category', 'queue'];
const SERVICE_ID_KEYS = ['serviceId', 'service_id'];
const SUPPORT_KEYWORDS = ['support', 'ticket', 'issue', 'incident', 'helpdesk'];
const TICKET_FILTERS = ['All', 'Open', 'In Progress', 'Escalated', 'Resolved', 'Closed'];

const SUPPORT_CONTACT = {
  company: 'WebFocus Support Desk',
  supportEmail: 'support@wsiportal.com',
  billingEmail: 'billing@wsiportal.com',
  hotlineLabel: '+63 (2) 7000 9000',
  hotlineHref: 'tel:+63270009000',
  mobileLabel: '+63 917 800 9000',
  mobileHref: 'tel:+639178009000',
  hours: 'Mon to Fri, 8:30 AM to 6:00 PM',
  freshdeskUrl: import.meta.env.VITE_FRESHDESK_URL || 'https://support.freshdesk.com/support/home',
};

const KNOWLEDGE_BASE_ITEMS = [
  {
    title: 'Hosting & Website Care',
    description: 'Troubleshooting guides for deployment, SSL, downtime, and website performance checks.',
    topics: ['Site checks', 'SSL issues', 'Performance review'],
  },
  {
    title: 'Domain, DNS & Email',
    description: 'Step-by-step help for domain renewals, nameserver changes, DNS records, and business email setup.',
    topics: ['DNS records', 'Renewals', 'Mailbox setup'],
  },
  {
    title: 'Billing & Renewals',
    description: 'Answers for invoices, proof of payment, pending approvals, and renewal reminders.',
    topics: ['Invoices', 'Payment proof', 'Renewal timelines'],
  },
];

const FAQ_ITEMS = [
  {
    question: 'How do I submit a support ticket?',
    answer: 'Choose the affected service, select the concern type, describe the issue clearly, then submit the ticket. The request is linked to your service record so admin can review it from Helpdesk.',
  },
  {
    question: 'When should I use Freshdesk chat instead of email?',
    answer: 'Use Freshdesk chat for urgent troubleshooting, provisioning follow-up, or live guidance. Use email when you need to attach context, request a callback, or document a longer issue trail.',
  },
  {
    question: 'How do I track updates after submitting a ticket?',
    answer: 'Your submitted service issues appear in the ticket tracker below. Support-related notifications also continue to appear in your Notifications page so you can follow changes in one place.',
  },
  {
    question: 'What details help support respond faster?',
    answer: 'Include the exact service, what changed, when the issue started, any error text, and the preferred response channel. If this is billing-related, mention the invoice or order reference when available.',
  },
];

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

const normalizeSupportStatus = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return 'Open';
  }

  if (normalized.includes('resolved') || normalized.includes('fixed') || normalized.includes('done')) {
    return 'Resolved';
  }

  if (normalized.includes('closed') || normalized.includes('cancelled') || normalized.includes('canceled')) {
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

const buildSupportTitle = (candidate, service) => {
  const explicitTitle = getFirstPresent(candidate, TITLE_KEYS);

  if (explicitTitle) {
    return String(explicitTitle).trim();
  }

  return `Support request for ${service?.name ?? 'service'}`;
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

  return 'Technical';
};

const buildSupportTicketRecord = (candidate, service, index) => {
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
  const status = typeof candidate === 'object'
    ? normalizeSupportStatus(getFirstPresent(candidate, STATUS_KEYS))
    : normalizeSupportStatus(service?.supportStatus ?? service?.issueStatus ?? 'Open');
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
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? 'Unknown service',
    serviceCategory: service?.category ?? '',
    reference: reference ? String(reference) : null,
    category: category ? String(category) : null,
    sourceLabel: 'Service ticket',
  };
};

const extractSupportTicketsFromService = (service) => {
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
    .map((candidate, index) => buildSupportTicketRecord(candidate, service, index))
    .filter(Boolean);
};

const isSupportNotification = (notification) => {
  const haystack = normalizeText([notification?.title, notification?.message, notification?.type].filter(Boolean).join(' '));
  return SUPPORT_KEYWORDS.some((keyword) => haystack.includes(keyword));
};

const buildTicketFromNotification = (notification, service, index) => {
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
    status: normalizeSupportStatus(notification?.status ?? (notification?.isRead ? 'In Progress' : 'Open')),
    createdAt: notification?.createdAt ?? null,
    updatedAt: notification?.updatedAt ?? notification?.createdAt ?? null,
    serviceId: service?.id ?? notification?.data?.serviceId ?? null,
    serviceName: service?.name ?? 'General support',
    serviceCategory: service?.category ?? '',
    reference: notification?.id ? `#N-${String(notification.id).padStart(3, '0')}` : null,
    category: notification?.type ?? null,
    sourceLabel: 'Support notification',
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

const getDisplayTime = (value) => {
  if (!value) {
    return 'Awaiting update';
  }

  return formatDateTime(value);
};

export default function HelpCommunicationPage() {
  const { user } = useAuth();
  const { myServices, notifications, reportServiceIssue } = usePortal();
  const [ticketOverrides, setTicketOverrides] = useState(() => loadTicketOverrides());
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Technical');
  const [preferredChannel, setPreferredChannel] = useState('Freshdesk Chat');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketFilter, setTicketFilter] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyFeedback, setReplyFeedback] = useState(null);

  useEffect(() => {
    if (!selectedTicket) {
      document.body.classList.remove('support-ticket-modal-open');
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.classList.add('support-ticket-modal-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('support-ticket-modal-open');
      document.body.style.overflow = '';
    };
  }, [selectedTicket]);

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
    if (selectedServiceId && myServices.some((service) => String(service.id) === selectedServiceId)) {
      return;
    }

    if (myServices.length) {
      setSelectedServiceId(String(myServices[0].id));
      return;
    }

    setSelectedServiceId('');
  }, [myServices, selectedServiceId]);

  useEffect(() => {
    if (!selectedTicket) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedTicket(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTicket]);

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
    setReplyDraft('');
    setReplyFeedback(null);
  }, [selectedTicket]);

  const servicesById = useMemo(
    () => new Map(myServices.map((service) => [String(service.id), service])),
    [myServices],
  );

  const findLinkedServiceForNotification = (notification) => {
    const directServiceId = getFirstPresent(notification?.data, SERVICE_ID_KEYS) ?? getFirstPresent(notification, SERVICE_ID_KEYS);

    if (directServiceId !== undefined && directServiceId !== null && directServiceId !== '') {
      return servicesById.get(String(directServiceId)) ?? null;
    }

    const haystack = normalizeText([notification?.title, notification?.message].filter(Boolean).join(' '));

    if (!haystack) {
      return null;
    }

    return myServices.find((service) => {
      return [service?.name, service?.serviceName, service?.domain]
        .filter(Boolean)
        .some((value) => {
          const normalizedValue = normalizeText(value);
          return normalizedValue && haystack.includes(normalizedValue);
        });
    }) ?? null;
  };

  const supportNotifications = useMemo(
    () => notifications.filter((notification) => isSupportNotification(notification)),
    [notifications],
  );

  const tickets = useMemo(() => {
    const serviceTickets = myServices.flatMap((service) => extractSupportTicketsFromService(service));
    const notificationTickets = supportNotifications
      .map((notification, index) => buildTicketFromNotification(notification, findLinkedServiceForNotification(notification), index))
      .filter(Boolean);

    return dedupeTickets([...serviceTickets, ...notificationTickets])
      .sort((left, right) => getTicketSortTime(right) - getTicketSortTime(left))
      .map((ticket, index) => {
        const override = getStoredOverrideForTicket(ticketOverrides, ticket);
        const status = normalizeSupportStatus(override.status ?? ticket.status);
        const conversation = getTicketConversation(ticket, override, { clientLabel: user?.name ?? 'Client' });

        return {
          ...ticket,
          status,
          updatedAt: override.updatedAt ?? ticket.updatedAt,
          reference: ticket.reference ?? `#C-${String(index + 101).padStart(3, '0')}`,
          categoryLabel: deriveTicketCategory(ticket),
          conversation,
        };
      });
  }, [myServices, servicesById, supportNotifications, ticketOverrides, user?.name]);

  useEffect(() => {
    if (!selectedTicket) {
      return;
    }

    const refreshedTicket = tickets.find((ticket) => ticket.id === selectedTicket.id);

    if (
      refreshedTicket
      && (
        refreshedTicket.status !== selectedTicket.status
        || refreshedTicket.updatedAt !== selectedTicket.updatedAt
        || refreshedTicket.reference !== selectedTicket.reference
        || refreshedTicket.conversation.length !== (selectedTicket.conversation?.length ?? 0)
      )
    ) {
      setSelectedTicket(refreshedTicket);
    }
  }, [selectedTicket, tickets]);

  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'All') {
      return tickets;
    }

    return tickets.filter((ticket) => ticket.status === ticketFilter);
  }, [ticketFilter, tickets]);

  const callbackRequestHref = useMemo(() => {
    const subject = encodeURIComponent('Phone support request');
    const body = encodeURIComponent([
      `Name: ${user?.name ?? ''}`,
      `Email: ${user?.email ?? ''}`,
      `Preferred callback window: `,
      `Service: ${servicesById.get(selectedServiceId)?.name ?? ''}`,
      '',
      'Brief issue summary:',
    ].join('\n'));

    return `mailto:${SUPPORT_CONTACT.supportEmail}?subject=${subject}&body=${body}`;
  }, [selectedServiceId, servicesById, user?.email, user?.name]);

  const handleSubmitTicket = async (event) => {
    event.preventDefault();

    if (!selectedServiceId) {
      setFormFeedback({ type: 'error', message: 'Select a service before submitting a support ticket.' });
      return;
    }

    const normalizedMessage = ticketMessage.trim();

    if (!normalizedMessage) {
      setFormFeedback({ type: 'error', message: 'Describe the issue before submitting the ticket.' });
      return;
    }

    setIsSubmitting(true);

    try {
      await reportServiceIssue(Number(selectedServiceId), [
        `Topic: ${ticketCategory}`,
        `Preferred channel: ${preferredChannel}`,
        normalizedMessage,
      ].join('\n\n'));

      setTicketMessage('');
      setPreferredChannel('Freshdesk Chat');
      setTicketCategory('Technical');
      setFormFeedback({ type: 'success', message: 'Support ticket submitted. Track updates in the ticket tracker above.' });
    } catch (error) {
      setFormFeedback({ type: 'error', message: error.message || 'Unable to submit the support ticket.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = () => {
    if (!selectedTicket) {
      return;
    }

    const normalizedReply = replyDraft.trim();

    if (!normalizedReply) {
      setReplyFeedback({ type: 'error', message: 'Enter a message before sending your reply.' });
      return;
    }

    const nextStatus = selectedTicket.status === 'Resolved' || selectedTicket.status === 'Closed'
      ? 'Open'
      : selectedTicket.status;

    setTicketOverrides((current) => appendTicketConversationMessage(current, selectedTicket, {
      message: normalizedReply,
      senderRole: 'client',
      senderLabel: user?.name ?? 'Client',
      status: nextStatus,
    }));
    setReplyDraft('');
    setReplyFeedback({ type: 'success', message: 'Your reply was added to the ticket conversation.' });
  };

  const selectedService = servicesById.get(selectedServiceId) ?? null;

  return (
    <div>
      <div>
        <div className="panel relative overflow-hidden rounded-3xl p-6 lg:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.14),transparent_40%)]" />
          <div className="relative">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">WebFocus contact details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{SUPPORT_CONTACT.company}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Reach the service desk for billing concerns, provisioning follow-up, technical incidents, and account assistance.
                </p>
              </div>
              <a href={SUPPORT_CONTACT.freshdeskUrl} target="_blank" rel="noreferrer" className="btn-primary gap-2 lg:shrink-0">
                <MessageSquareText size={16} /> Start Freshdesk chat
              </a>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { icon: Mail, label: 'Support email', value: SUPPORT_CONTACT.supportEmail },
                { icon: PhoneCall, label: 'Hotline', value: SUPPORT_CONTACT.hotlineLabel },
                { icon: Headphones, label: 'Mobile support', value: SUPPORT_CONTACT.mobileLabel },
                { icon: Clock3, label: 'Coverage hours', value: SUPPORT_CONTACT.hours },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sky-300">
                      <item.icon size={18} />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-white">{item.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="panel overflow-hidden rounded-3xl p-6 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ticket tracker</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Submit and track support tickets</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">Monitor submitted issues, status updates, and support notifications linked to your services.</p>
            </div>
            <label className="block lg:min-w-52">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</span>
              <select
                value={ticketFilter}
                onChange={(event) => setTicketFilter(event.target.value)}
                className="input mt-2 h-11 py-2.5"
              >
                {TICKET_FILTERS.map((filter) => (
                  <option key={filter} value={filter}>{filter}</option>
                ))}
              </select>
            </label>
          </div>

          {filteredTickets.length ? (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-4">Ticket</th>
                    <th className="px-4 py-4">Service</th>
                    <th className="px-4 py-4">Category</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Last update</th>
                    <th className="px-4 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="table-row-hoverable border-b border-white/6 align-top last:border-b-0">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-sky-300">{ticket.reference}</p>
                        <p className="mt-1 font-medium text-white">{ticket.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{ticket.sourceLabel}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-white">{ticket.serviceName}</p>
                        <p className="mt-1 text-xs text-slate-500">Created {getDisplayTime(ticket.createdAt)}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{ticket.categoryLabel}</td>
                      <td className="px-4 py-4"><StatusBadge status={ticket.status} /></td>
                      <td className="px-4 py-4 text-slate-300">{getDisplayTime(ticket.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          <button type="button" onClick={() => setSelectedTicket(ticket)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-sky-300/20 hover:bg-sky-300/10" aria-label={`Open messages for ${ticket.reference}`} title="Open messages">
                            <MessageSquareText size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                <LifeBuoy size={24} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">No support tickets yet</h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                Submit your first ticket using the form below, or start a Freshdesk chat for a live conversation with support.
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmitTicket} className="panel rounded-3xl p-6 lg:p-7">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-300">
              <Headphones size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Submit support ticket</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Create a request tied to your service</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Affected service</span>
              <select
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(event.target.value)}
                className="input mt-2 h-11 py-2.5"
                disabled={!myServices.length}
              >
                {!myServices.length ? <option value="">No active service available</option> : null}
                {myServices.map((service) => (
                  <option key={service.id} value={String(service.id)}>{service.name}</option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Concern type</span>
                <select value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value)} className="input mt-2 h-11 py-2.5">
                  {['Technical', 'Billing', 'Access', 'Domain', 'Sales'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Preferred response</span>
                <select value={preferredChannel} onChange={(event) => setPreferredChannel(event.target.value)} className="input mt-2 h-11 py-2.5">
                  {['Freshdesk Chat', 'Phone Call', 'Email'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Issue details</span>
              <textarea
                value={ticketMessage}
                onChange={(event) => setTicketMessage(event.target.value)}
                className="input mt-2 min-h-36"
                placeholder="Describe the issue, what changed, and any error messages you saw..."
                disabled={!myServices.length}
              />
            </label>

            {selectedService ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Ticket will be linked to <span className="font-semibold text-white">{selectedService.name}</span> so support can review the correct service history.
              </div>
            ) : null}

            {formFeedback ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${formFeedback.type === 'success' ? 'border-emerald-300/20 bg-emerald-500/10 text-emerald-200' : 'border-rose-300/20 bg-rose-500/10 text-rose-200'}`}>
                {formFeedback.message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={isSubmitting || !myServices.length} className="btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60">
                <MessageSquareText size={16} /> {isSubmitting ? 'Submitting...' : 'Submit ticket'}
              </button>
              {!myServices.length ? (
                <Link to="/services" className="btn-secondary gap-2">
                  <ArrowUpRight size={16} /> Browse services
                </Link>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="panel rounded-3xl p-6 lg:p-7">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-300">
              <BookOpen size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Knowledge Base</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Browse self-service articles</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {KNOWLEDGE_BASE_ITEMS.map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sky-300">
                  <FileText size={18} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.topics.map((topic) => (
                    <span key={topic} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">{topic}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-3xl p-6 lg:p-7">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-400/12 text-orange-300">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">FAQs & guides</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Quick answers before you escalate</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-white/10 bg-white/5 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-semibold text-white">
                  <span>{item.question}</span>
                  <span className="text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-7 text-slate-400">{item.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-orange-300/20 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(249,115,22,0.06)_55%,rgba(255,255,255,0.03))] p-4">
            <p className="text-sm font-medium text-white">Need billing help instead?</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">For invoice and payment-proof follow-up, you can also contact the billing desk directly.</p>
            <a href={`mailto:${SUPPORT_CONTACT.billingEmail}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-300 transition hover:text-white">
              Email billing support <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </div>

      {selectedTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="panel support-ticket-modal-panel ticket-modal-shell flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl p-6 lg:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedTicket.status} />
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                    {selectedTicket.categoryLabel}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold text-white">{selectedTicket.reference} · {selectedTicket.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{selectedTicket.serviceName} • {selectedTicket.sourceLabel}</p>
              </div>
              <button type="button" onClick={() => setSelectedTicket(null)} className="btn-secondary px-4">Close</button>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="ticket-modal-section rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Conversation history</p>
                  <span className="ticket-modal-chip rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {selectedTicket.conversation.length} message{selectedTicket.conversation.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="ticket-thread-shell mt-4 max-h-[22rem] space-y-3 overflow-y-auto rounded-2xl border border-sky-300/20 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(255,255,255,0.05)_60%,rgba(251,146,60,0.08))] p-4">
                  {selectedTicket.conversation.map((entry) => {
                    const isClientMessage = entry.senderRole !== 'admin';

                    return (
                      <div key={entry.id} className={`flex ${isClientMessage ? 'justify-end' : 'justify-start'}`}>
                        <div className={`ticket-thread-message max-w-[88%] rounded-2xl border px-4 py-3 ${isClientMessage ? 'ticket-thread-message--client border-sky-300/30 bg-sky-400/15 text-slate-50' : 'ticket-thread-message--admin border-white/10 bg-slate-950/30 text-slate-100'}`}>
                          <div className="ticket-thread-meta">
                            <span className="ticket-thread-role">{isClientMessage ? 'You' : 'Support'}</span>
                            <span className="ticket-thread-author">{entry.senderLabel}</span>
                          </div>
                          <p className="ticket-thread-copy mt-2 whitespace-pre-wrap text-sm leading-6 text-current">{entry.message}</p>
                          <p className="ticket-thread-time mt-2 text-xs text-slate-400">{getDisplayTime(entry.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="ticket-compose-panel mt-4 rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Send a reply</span>
                    <textarea
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      className="input ticket-compose-input mt-2 min-h-28"
                      placeholder="Add more details, answer support questions, or send a follow-up message..."
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

                <div className="ticket-modal-section rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ticket details</p>
                  <div className="mt-4 space-y-4 text-sm text-slate-300">
                    <div>
                      <p className="text-slate-500">Linked service</p>
                      <p className="mt-1 text-white">{selectedTicket.serviceName}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Reported</p>
                      <p className="mt-1 text-white">{getDisplayTime(selectedTicket.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Last update</p>
                      <p className="mt-1 text-white">{getDisplayTime(selectedTicket.updatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Preferred follow-up</p>
                      <p className="mt-1 text-white">Freshdesk chat, email, or callback request</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`mailto:${SUPPORT_CONTACT.supportEmail}`} className="btn-secondary gap-2 px-4 py-3">
                  <Mail size={16} /> Email support
                </a>
                <a href={SUPPORT_CONTACT.freshdeskUrl} target="_blank" rel="noreferrer" className="btn-secondary gap-2 px-4 py-3">
                  <MessageSquareText size={16} /> Open Freshdesk
                </a>
                <Link to="/dashboard/notifications" className="btn-secondary gap-2 px-4 py-3">
                  <BellRing size={16} /> View notifications
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
