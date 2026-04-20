export const HELP_DESK_OVERRIDES_KEY = 'wsi-helpdesk-ticket-overrides';

const normalizeText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getSupportSyncTime = (value) => {
  const time = new Date(value ?? 0).getTime();

  if (Number.isNaN(time) || !time) {
    return 'unknown-time';
  }

  return new Date(time).toISOString().slice(0, 16);
};

const extractTicketReferenceTokens = (values) => {
  const tokens = new Set();

  values.forEach((value) => {
    const text = String(value ?? '').trim();

    if (!text) {
      return;
    }

    const matches = text.match(/[A-Za-z]+-\d{2,}/g) ?? [];

    matches.forEach((match) => {
      tokens.add(match.toUpperCase());
    });
  });

  return Array.from(tokens);
};

const buildLegacySyncKey = ({ serviceId, serviceName, createdAt }) => {
  const normalizedServiceName = normalizeText(serviceName);
  const servicePart = serviceId ? `service-${serviceId}` : (normalizedServiceName || 'unlinked-service');
  return `${servicePart}::${getSupportSyncTime(createdAt)}`;
};

export const buildHelpdeskSyncKey = ({ serviceId, serviceName, createdAt, reference, title, message }) => {
  const normalizedServiceName = normalizeText(serviceName);
  const servicePart = serviceId ? `service-${serviceId}` : (normalizedServiceName || 'unlinked-service');
  const referenceToken = extractTicketReferenceTokens([title, message, reference])[0];

  if (referenceToken) {
    return `${servicePart}::ref-${referenceToken}`;
  }

  return buildLegacySyncKey({ serviceId, serviceName, createdAt });
};

const getTicketOverrideKeys = (ticket) => {
  const keys = [];
  const appendKey = (key) => {
    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  };

  appendKey(ticket?.syncKey ? `sync:${ticket.syncKey}` : null);
  appendKey(ticket?.id ?? null);

  const legacySyncKey = buildLegacySyncKey({
    serviceId: ticket?.serviceId ?? null,
    serviceName: ticket?.serviceName ?? ticket?.title ?? 'support alert',
    createdAt: ticket?.createdAt ?? ticket?.updatedAt ?? null,
  });
  appendKey(legacySyncKey ? `sync:${legacySyncKey}` : null);

  const sharedSyncKey = buildHelpdeskSyncKey({
    serviceId: ticket?.serviceId ?? null,
    serviceName: ticket?.serviceName ?? ticket?.title ?? 'support alert',
    createdAt: ticket?.createdAt ?? ticket?.updatedAt ?? null,
    reference: ticket?.reference ?? null,
    title: ticket?.title ?? null,
    message: ticket?.message ?? null,
  });
  appendKey(sharedSyncKey ? `sync:${sharedSyncKey}` : null);

  const referenceTokens = extractTicketReferenceTokens([ticket?.reference, ticket?.title, ticket?.message]);

  referenceTokens.forEach((token) => {
    appendKey(`ref:${token}`);

    if (ticket?.serviceId !== undefined && ticket?.serviceId !== null && ticket?.serviceId !== '') {
      appendKey(`service:${ticket.serviceId}:ref:${token}`);
    }
  });

  return keys;
};

const getTimestamp = (value) => {
  const time = new Date(value ?? 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const normalizeConversationEntry = (entry, index = 0) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const message = String(entry.message ?? entry.body ?? '').trim();

  if (!message) {
    return null;
  }

  const senderRole = entry.senderRole === 'admin' ? 'admin' : 'client';
  const defaultLabel = senderRole === 'admin' ? 'Support team' : 'Client';
  const senderLabel = String(entry.senderLabel ?? defaultLabel).trim() || defaultLabel;

  return {
    id: String(entry.id ?? `${senderRole}-${index + 1}`),
    senderRole,
    senderLabel,
    message,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };
};

export const loadTicketOverrides = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(HELP_DESK_OVERRIDES_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const getStoredOverrideForTicket = (overrides, ticket) => {
  if (!ticket) {
    return {};
  }

  return getTicketOverrideKeys(ticket).reduce((merged, key) => {
    return {
      ...merged,
      ...(overrides[key] ?? {}),
    };
  }, {});
};

export const mergeTicketOverride = (currentOverrides, ticket, overridePatch) => {
  const mergedOverride = getStoredOverrideForTicket(currentOverrides, ticket);
  const nextOverride = {
    ...mergedOverride,
    ...overridePatch,
  };

  return getTicketOverrideKeys(ticket).reduce((updatedOverrides, key) => {
    updatedOverrides[key] = {
      ...(updatedOverrides[key] ?? {}),
      ...nextOverride,
    };
    return updatedOverrides;
  }, { ...currentOverrides });
};

export const getTicketConversation = (ticket, override = {}, options = {}) => {
  const initialMessage = String(ticket?.message ?? '').trim();
  const initialSenderLabel = String(options.clientLabel ?? ticket?.clientName ?? 'Client').trim() || 'Client';
  const initialEntries = initialMessage
    ? [{
        id: `initial-${ticket?.id ?? 'ticket'}`,
        senderRole: 'client',
        senderLabel: initialSenderLabel,
        message: initialMessage,
        createdAt: ticket?.createdAt ?? ticket?.updatedAt ?? new Date().toISOString(),
        isInitial: true,
      }]
    : [];

  const storedEntries = Array.isArray(override?.messages)
    ? override.messages
      .map((entry, index) => normalizeConversationEntry(entry, index))
      .filter(Boolean)
    : [];

  return [...initialEntries, ...storedEntries].sort((left, right) => {
    const diff = getTimestamp(left.createdAt) - getTimestamp(right.createdAt);

    if (diff !== 0) {
      return diff;
    }

    if (left.isInitial) {
      return -1;
    }

    if (right.isInitial) {
      return 1;
    }

    return 0;
  });
};

export const appendTicketConversationMessage = (currentOverrides, ticket, payload) => {
  const message = String(payload?.message ?? '').trim();

  if (!message) {
    return currentOverrides;
  }

  const createdAt = payload?.createdAt ?? new Date().toISOString();
  const mergedOverride = getStoredOverrideForTicket(currentOverrides, ticket);
  const existingMessages = Array.isArray(mergedOverride.messages)
    ? mergedOverride.messages
      .map((entry, index) => normalizeConversationEntry(entry, index))
      .filter(Boolean)
    : [];
  const nextMessage = normalizeConversationEntry(
    {
      ...payload,
      id: payload?.id ?? `${payload?.senderRole === 'admin' ? 'admin' : 'client'}-${createdAt}`,
      message,
      createdAt,
    },
    existingMessages.length,
  );

  if (!nextMessage) {
    return currentOverrides;
  }

  const nextOverride = {
    ...mergedOverride,
    messages: [...existingMessages, nextMessage],
    updatedAt: createdAt,
  };

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'status')) {
    nextOverride.status = payload.status;
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, 'assignedTo')) {
    nextOverride.assignedTo = payload.assignedTo;
  }

  return mergeTicketOverride(currentOverrides, ticket, nextOverride);
};
