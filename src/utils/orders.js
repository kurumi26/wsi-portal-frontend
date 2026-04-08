export const desiredDomainRequiredMessage = 'Enter the desired domain for each domain order before completing payment.';

const cancellationNoteKeys = [
  'reason',
  'cancellationReason',
  'cancellation_reason',
  'customerNote',
  'customer_note',
  'customerComment',
  'customer_comment',
  'customerMessage',
  'customer_message',
  'note',
  'notes',
  'comment',
  'comments',
  'remark',
  'remarks',
  'message',
];

const desiredDomainKeys = [
  'desiredDomain',
  'desired_domain',
  'desiredDomainComment',
  'desired_domain_comment',
  'checkoutNote',
  'checkout_note',
  'orderNote',
  'order_note',
  'requestedDomain',
  'requested_domain',
  'requestedDomainComment',
  'requested_domain_comment',
  'domainName',
  'domain_name',
  'customerNote',
  'customer_note',
  'customerNotes',
  'customer_notes',
  'customerComment',
  'customer_comment',
  'customerMessage',
  'customer_message',
  'comment',
  'comments',
  'note',
  'notes',
  'remark',
  'remarks',
  'specialInstructions',
  'special_instructions',
  'instructions',
];

const nestedRecordKeys = [
  'meta',
  'metadata',
  'data',
  'details',
  'attributes',
  'payload',
  'response',
  'result',
  'resource',
  'record',
  'order',
  'portalOrder',
  'portal_order',
  'purchase',
  'purchaseOrder',
  'purchase_order',
  'item',
  'orderItem',
  'order_item',
  'items',
  'lineItem',
  'line_item',
  'lineItems',
  'line_items',
  'orderItems',
  'order_items',
  'cart',
  'cartItems',
  'cart_items',
  'cancellationRequest',
  'cancellation_request',
];

const normalizeTextValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeTextValue(entry))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    return '';
  }

  const normalized = String(value).trim();
  return normalized || '';
};

const collectRelatedRecords = (record) => {
  if (!record || typeof record !== 'object') {
    return [];
  }

  const queue = [record];
  const seen = new Set();
  const relatedRecords = [];

  while (queue.length) {
    const current = queue.shift();

    if (!current || typeof current !== 'object' || seen.has(current)) {
      continue;
    }

    seen.add(current);
    relatedRecords.push(current);

    nestedRecordKeys.forEach((key) => {
      const value = current[key];

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === 'object') {
            queue.push(entry);
          }
        });
        return;
      }

      if (value && typeof value === 'object') {
        queue.push(value);
      }
    });
  }

  return relatedRecords;
};

const collectDesiredDomainNotes = (records) => {
  const seen = new Set();
  const values = [];

  records.forEach((currentRecord) => {
    desiredDomainKeys.forEach((key) => {
      const normalized = normalizeTextValue(currentRecord?.[key]);

      if (!normalized || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      values.push(normalized);
    });
  });

  return values;
};

const collectCancellationNotes = (records) => {
  const seen = new Set();
  const values = [];

  records.forEach((currentRecord) => {
    cancellationNoteKeys.forEach((key) => {
      const normalized = normalizeTextValue(currentRecord?.[key]);

      if (!normalized || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      values.push(normalized);
    });
  });

  return values;
};

export const getDesiredDomainValue = (record) => {
  const relatedRecords = collectRelatedRecords(record);
  const nestedRecords = relatedRecords.filter((currentRecord) => currentRecord !== record);
  const nestedNotes = collectDesiredDomainNotes(nestedRecords);

  if (nestedNotes.length) {
    return nestedNotes.join('\n');
  }

  const directNotes = collectDesiredDomainNotes(relatedRecords);
  return directNotes.join('\n');
};

export const getCancellationReasonValue = (record) => {
  const relatedRecords = collectRelatedRecords(record);
  const nestedRecords = relatedRecords.filter((currentRecord) => currentRecord !== record);
  const nestedNotes = collectCancellationNotes(nestedRecords);

  if (nestedNotes.length) {
    return nestedNotes.join('\n');
  }

  const directNotes = collectCancellationNotes(relatedRecords);
  return directNotes.join('\n');
};

export const getCustomerCommentValue = (record) => getDesiredDomainValue(record) || getCancellationReasonValue(record);

export const isDomainOrder = (record) => {
  if (!record || typeof record !== 'object') {
    return false;
  }

  const category = String(record.category ?? '').toLowerCase();
  const serviceName = String(record.serviceName ?? record.name ?? '').toLowerCase();

  return category.includes('domain') || serviceName.includes('domain');
};

const getCheckoutNoteLabel = (record, index) => {
  const serviceName = normalizeTextValue(record?.serviceName ?? record?.name ?? record?.service ?? record?.title);
  const configuration = normalizeTextValue(record?.configuration ?? record?.plan ?? record?.config ?? record?.option);

  if (serviceName && configuration) {
    return `${serviceName} (${configuration})`;
  }

  if (serviceName) {
    return serviceName;
  }

  return `Item ${index + 1}`;
};

export const buildCheckoutCustomerNote = (records) => {
  const normalizedRecords = Array.isArray(records) ? records : [];
  const entries = normalizedRecords
    .map((record, index) => {
      const note = getDesiredDomainValue(record);

      if (!note) {
        return null;
      }

      return {
        label: getCheckoutNoteLabel(record, index),
        note,
      };
    })
    .filter(Boolean);

  if (!entries.length) {
    return '';
  }

  if (entries.length === 1) {
    return entries[0].note;
  }

  return entries.map(({ label, note }) => `${label}: ${note}`).join('\n');
};

export const buildCheckoutNotePayload = (records) => {
  const note = buildCheckoutCustomerNote(records);

  if (!note) {
    return {};
  }

  return {
    customerNote: note,
    customer_note: note,
    checkoutNote: note,
    checkout_note: note,
    desiredDomain: note,
    desired_domain: note,
    note,
    comment: note,
  };
};

export const normalizeOrderNoteRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const note = getDesiredDomainValue(record);

  if (!note) {
    return record;
  }

  return {
    ...record,
    desiredDomain: record.desiredDomain ?? note,
    desired_domain: record.desired_domain ?? note,
    customerNote: record.customerNote ?? note,
    customer_note: record.customer_note ?? note,
    note: record.note ?? note,
    comment: record.comment ?? note,
  };
};

export const normalizeOrderNoteRecords = (records) => {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.map((record) => normalizeOrderNoteRecord(record));
};

export const requiresDesiredDomain = (record) => isDomainOrder(record);
