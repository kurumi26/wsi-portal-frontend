const CONTRACT_OVERRIDE_STORAGE_KEY = 'wsi-contract-overrides-v1';
const API_BASE_URL = String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
const API_ORIGIN = (() => {
  if (!API_BASE_URL) {
    return '';
  }

  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
})();

const truthyTokens = new Set(['1', 'true', 'yes', 'y', 'accepted', 'approved']);
const falsyTokens = new Set(['0', 'false', 'no', 'n', 'rejected', 'declined']);
const acceptedStatusTokens = new Set(['accepted', 'approved', 'signed', 'completed']);
const rejectedStatusTokens = new Set(['rejected', 'declined', 'cancelled', 'canceled']);
const verifiedStatusTokens = new Set(['verified', 'confirmed', 'completed verification', 'accepted verified']);
const pendingStatusTokens = new Set([
  'pending',
  'pending review',
  'pending_review',
  'awaiting review',
  'awaiting_review',
  'draft',
  'open',
  'awaiting signature',
  'awaiting_signature',
  'signature required',
  'signature_required',
]);

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
};

const pickFirstValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }

    return value;
  }

  return null;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (truthyTokens.has(normalized)) {
      return true;
    }

    if (falsyTokens.has(normalized)) {
      return false;
    }
  }

  return false;
};

const isAbsoluteUrl = (value) => /^[a-z][a-z\d+.-]*:/i.test(value);
const apiResourcePathPattern = /^\/(services|contracts|admin|orders|customer-services)(\/|$)/i;

const buildApiAssetUrl = (path) => {
  const normalizedPath = `/${normalizeText(path).replace(/^\/+/, '').replace(/^api\//i, '')}`;

  if (API_BASE_URL) {
    return `${API_BASE_URL}${normalizedPath}`;
  }

  return `/api${normalizedPath}`;
};

const resolveAssetUrl = (value, { treatAsApiPath = false } = {}) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  if (isAbsoluteUrl(normalized)) {
    return normalized;
  }

  if (treatAsApiPath) {
    return buildApiAssetUrl(normalized);
  }

  if (/^\/api(\/|$)/i.test(normalized)) {
    return buildApiAssetUrl(normalized);
  }

  if (apiResourcePathPattern.test(normalized)) {
    return buildApiAssetUrl(normalized);
  }

  if (normalized.startsWith('/')) {
    if (API_ORIGIN) {
      return `${API_ORIGIN}${normalized}`;
    }

    return normalized;
  }

  if (API_BASE_URL) {
    return `${API_BASE_URL}/${normalized.replace(/^\/+/, '')}`;
  }

  return normalized;
};

const looksLikeOverrideEntry = (value) => Boolean(
  value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.prototype.hasOwnProperty.call(value, 'status')
      || Object.prototype.hasOwnProperty.call(value, 'acceptedAt')
      || Object.prototype.hasOwnProperty.call(value, 'rejectedAt')
      || Object.prototype.hasOwnProperty.call(value, 'verifiedAt')
      || Object.prototype.hasOwnProperty.call(value, 'verificationStatus')
      || Object.prototype.hasOwnProperty.call(value, 'signedDocumentName')
      || Object.prototype.hasOwnProperty.call(value, 'signedDocumentUploadedAt')
    )
);

const looksLikeOverrideMap = (value) => Boolean(
  value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length
    && Object.values(value).every((entry) => looksLikeOverrideEntry(entry))
);

const getAgreementSections = (serviceName) => {
  const normalizedServiceName = normalizeText(serviceName) || 'this service';

  return [
    {
      id: 'service-agreement',
      title: 'Service Agreement',
      description: `Defines scope, provisioning, service levels, and commercial obligations for ${normalizedServiceName}.`,
    },
    {
      id: 'terms-of-service',
      title: 'Terms of Service',
      description: 'Covers billing terms, renewals, suspension, cancellation, and account use policies.',
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      description: 'Describes how customer data, credentials, and operational records are handled for compliance.',
    },
  ];
};

const normalizeDocumentSections = (sections, serviceName) => {
  const items = ensureArray(sections)
    .map((section, index) => {
      if (!section) {
        return null;
      }

      if (typeof section === 'string') {
        return {
          id: `section-${index}`,
          title: section,
          description: '',
        };
      }

      return {
        id: normalizeText(section.id) || `section-${index}`,
        title: normalizeText(section.title || section.label || section.name) || `Document ${index + 1}`,
        description: normalizeText(section.description || section.summary),
      };
    })
    .filter(Boolean);

  return items.length ? items : getAgreementSections(serviceName);
};

const getSignedDocumentSources = (...records) => {
  const sources = [];
  const pushSource = (value, nested = false) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sources.push({ value, nested });
    }
  };

  records.forEach((record) => {
    pushSource(record, false);

    [
      record?.signedDocument,
      record?.signed_document,
      record?.signedAgreement,
      record?.signed_agreement,
      record?.signedCopy,
      record?.signed_copy,
      record?.uploadedSignedDocument,
      record?.uploaded_signed_document,
      record?.signedFile,
      record?.signed_file,
    ].forEach((source) => pushSource(source, true));
  });

  return sources;
};

const pickSignedDocumentValue = (sources, directKeys, nestedKeys = []) => {
  for (const source of sources) {
    const keys = source.nested ? [...directKeys, ...nestedKeys] : directKeys;
    const value = pickFirstValue(...keys.map((key) => source.value?.[key]));

    if (value !== null) {
      return value;
    }
  }

  return null;
};

export const getContractSignedDocumentMetadata = (...records) => {
  const sources = getSignedDocumentSources(...records);
  const name = pickSignedDocumentValue(
    sources,
    [
      'signedDocumentName',
      'signed_document_name',
      'signedAgreementName',
      'signed_agreement_name',
      'signedCopyName',
      'signed_copy_name',
      'signedFileName',
      'signed_file_name',
      'uploadedSignedDocumentName',
      'uploaded_signed_document_name',
    ],
    ['name', 'fileName', 'file_name', 'originalName', 'original_name', 'downloadName', 'download_name'],
  );
  const uploadedAt = pickSignedDocumentValue(
    sources,
    [
      'signedDocumentUploadedAt',
      'signed_document_uploaded_at',
      'signedAgreementUploadedAt',
      'signed_agreement_uploaded_at',
      'signedCopyUploadedAt',
      'signed_copy_uploaded_at',
      'signedFileUploadedAt',
      'signed_file_uploaded_at',
      'uploadedSignedDocumentAt',
      'uploaded_signed_document_at',
      'signedAt',
      'signed_at',
    ],
    ['uploadedAt', 'uploaded_at', 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'signedAt', 'signed_at'],
  );
  const url = resolveAssetUrl(pickSignedDocumentValue(
    sources,
    [
      'signedDocumentUrl',
      'signed_document_url',
      'signedDocumentPath',
      'signed_document_path',
      'signedAgreementUrl',
      'signed_agreement_url',
      'signedAgreementPath',
      'signed_agreement_path',
      'signedCopyUrl',
      'signed_copy_url',
      'signedCopyPath',
      'signed_copy_path',
      'signedFileUrl',
      'signed_file_url',
      'signedFilePath',
      'signed_file_path',
      'uploadedSignedDocumentUrl',
      'uploaded_signed_document_url',
      'uploadedSignedDocumentPath',
      'uploaded_signed_document_path',
    ],
    ['url', 'downloadUrl', 'download_url', 'path', 'filePath', 'file_path', 'href', 'uri'],
  ));

  return {
    name: normalizeText(name) || null,
    uploadedAt: uploadedAt ?? null,
    url,
  };
};

export const hasSignedDocument = (...records) => {
  const signedDocument = getContractSignedDocumentMetadata(...records);
  return Boolean(signedDocument.name || signedDocument.uploadedAt || signedDocument.url);
};

const getComparableName = (value) => normalizeText(value).toLowerCase();

const findRelatedService = ({ serviceId, serviceName, myServices, services }) => {
  const normalizedId = normalizeText(serviceId);
  const normalizedName = getComparableName(serviceName);
  const pool = [...ensureArray(myServices), ...ensureArray(services)];

  return pool.find((service) => {
    if (!service || typeof service !== 'object') {
      return false;
    }

    if (normalizedId && normalizeText(service.id) === normalizedId) {
      return true;
    }

    if (!normalizedName) {
      return false;
    }

    return [service.name, service.serviceName].some((candidate) => getComparableName(candidate) === normalizedName);
  }) ?? null;
};

const getContractDownloadUrl = ({ contract, order, service }) => {
  const explicitUrl = pickFirstValue(
    contract?.downloadUrl,
    contract?.download_url,
    contract?.agreementUrl,
    contract?.agreement_url,
    order?.downloadUrl,
    order?.download_url,
    order?.agreementUrl,
    order?.agreement_url,
    service?.agreementUrl,
    service?.agreement_url,
  );

  if (explicitUrl) {
    return resolveAssetUrl(explicitUrl);
  }

  if (service?.id) {
    return buildApiAssetUrl(`/services/${service.id}/agreement.pdf`);
  }

  return null;
};

export const normalizeContractStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, ' ');

  if (acceptedStatusTokens.has(normalized)) {
    return 'Accepted';
  }

  if (rejectedStatusTokens.has(normalized)) {
    return 'Rejected';
  }

  if (pendingStatusTokens.has(normalized) || !normalized) {
    return 'Pending Review';
  }

  return 'Pending Review';
};

export const contractRequiresSignedDocument = (...records) => records.some((record) => normalizeBoolean(pickFirstValue(
  record?.requiresSignedDocument,
  record?.requires_signed_document,
  record?.financeRequiresSignature,
  record?.finance_requires_signature,
  record?.signedDocumentRequired,
  record?.signed_document_required,
  record?.complianceRequiresUpload,
  record?.compliance_requires_upload,
)));

export const isContractVerified = (contract) => {
  const explicitValue = pickFirstValue(
    contract?.acceptanceVerified,
    contract?.acceptance_verified,
    contract?.verified,
    contract?.isVerified,
  );

  if (explicitValue !== null) {
    return normalizeBoolean(explicitValue);
  }

  const verificationStatus = normalizeText(pickFirstValue(contract?.verificationStatus, contract?.verification_status))
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (verifiedStatusTokens.has(verificationStatus)) {
    return true;
  }

  return Boolean(pickFirstValue(
    contract?.verifiedAt,
    contract?.verified_at,
    contract?.acceptanceVerifiedAt,
    contract?.acceptance_verified_at,
  ));
};

export const getContractVerificationStatus = (contract) => {
  const normalizedStatus = normalizeContractStatus(contract?.status);

  if (isContractVerified(contract)) {
    return 'Verified';
  }

  if (normalizedStatus === 'Accepted') {
    return 'Pending Verification';
  }

  if (normalizedStatus === 'Rejected') {
    return 'Rejected';
  }

  return 'Awaiting Acceptance';
};

const applyContractOverride = (contract, overrides = {}) => {
  const override = overrides?.[contract.id] ?? overrides?.[contract.externalKey];
  const next = override ? { ...contract, ...override } : { ...contract };
  const signedDocument = getContractSignedDocumentMetadata(next, contract);
  const verifiedAt = pickFirstValue(
    next.verifiedAt,
    next.verified_at,
    next.acceptanceVerifiedAt,
    next.acceptance_verified_at,
    contract.verifiedAt,
    contract.verified_at,
    contract.acceptanceVerifiedAt,
    contract.acceptance_verified_at,
  );
  const verificationSource = {
    ...contract,
    ...next,
    verifiedAt,
  };

  return {
    ...next,
    status: normalizeContractStatus(next.status),
    clientId: pickFirstValue(next.clientId, contract.clientId),
    clientName: pickFirstValue(next.clientName, contract.clientName),
    documentSections: normalizeDocumentSections(next.documentSections, next.serviceName),
    downloadUrl: resolveAssetUrl(pickFirstValue(next.downloadUrl, contract.downloadUrl)),
    acceptedAt: pickFirstValue(next.acceptedAt, contract.acceptedAt),
    rejectedAt: pickFirstValue(next.rejectedAt, contract.rejectedAt),
    decisionAt: pickFirstValue(next.decisionAt, next.acceptedAt, next.rejectedAt, contract.decisionAt),
    verifiedAt,
    verifiedBy: pickFirstValue(next.verifiedBy, next.verified_by, contract.verifiedBy, contract.verified_by),
    verificationStatus: pickFirstValue(next.verificationStatus, next.verification_status, contract.verificationStatus, getContractVerificationStatus(verificationSource)),
    acceptanceVerified: isContractVerified(verificationSource),
    signedDocumentName: signedDocument.name,
    signedDocumentUploadedAt: signedDocument.uploadedAt,
    signedDocumentUrl: signedDocument.url,
  };
};

export const getContractOwnerKey = (user) => getComparableName(
  pickFirstValue(user?.id, user?.email, user?.name, 'anonymous'),
) || 'anonymous';

export const readStoredContractOverrides = (ownerKey = 'anonymous') => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(CONTRACT_OVERRIDE_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && looksLikeOverrideMap(parsed[ownerKey])) {
      return parsed[ownerKey];
    }

    if (looksLikeOverrideMap(parsed)) {
      return parsed;
    }
  } catch (error) {
    return {};
  }

  return {};
};

export const writeStoredContractOverrides = (ownerKey = 'anonymous', overrides = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const raw = localStorage.getItem(CONTRACT_OVERRIDE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};

    next[ownerKey] = overrides;
    localStorage.setItem(CONTRACT_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // ignore local storage write failures
  }
};

const buildDerivedOrderContract = ({ order, services, myServices, overrides, user, index }) => {
  const relatedService = findRelatedService({
    serviceId: pickFirstValue(order?.serviceId, order?.service_id),
    serviceName: pickFirstValue(order?.serviceName, order?.service_name, order?.name),
    myServices,
    services,
  });
  const orderKey = normalizeText(pickFirstValue(order?.id, order?.orderNumber, order?.order_number, `row-${index}`));
  const explicitAccepted = normalizeBoolean(pickFirstValue(
    order?.agreementAccepted,
    order?.agreement_accepted,
    order?.accepted,
    order?.isAccepted,
    order?.termsAccepted,
    order?.terms_accepted,
  ));
  const explicitRejected = normalizeBoolean(pickFirstValue(
    order?.agreementRejected,
    order?.agreement_rejected,
    order?.rejected,
    order?.isRejected,
  ));
  const clientName = normalizeText(pickFirstValue(order?.clientName, order?.client, order?.customerName, order?.customer)) || 'Customer';
  const status = explicitRejected
    ? 'Rejected'
    : explicitAccepted
      ? 'Accepted'
      : 'Pending Review';
  const serviceName = normalizeText(pickFirstValue(order?.serviceName, order?.service_name, relatedService?.name, relatedService?.serviceName)) || 'Service Agreement';
  const signedDocument = getContractSignedDocumentMetadata(order);

  return applyContractOverride({
    id: `order-${orderKey}`,
    externalKey: `order-${orderKey}`,
    source: 'derived-order',
    scope: 'order',
    title: `${serviceName} Agreement`,
    description: 'Customer agreement bundle attached to the order record for legal, billing, and privacy acknowledgement.',
    clientId: pickFirstValue(order?.clientId, order?.client_id, order?.userId, order?.user_id),
    clientName,
    serviceName,
    serviceId: pickFirstValue(order?.serviceId, order?.service_id, relatedService?.id),
    orderId: pickFirstValue(order?.id, order?.orderNumber, order?.order_number),
    orderNumber: pickFirstValue(order?.orderNumber, order?.order_number, order?.id),
    status,
    version: normalizeText(pickFirstValue(order?.agreementVersion, order?.agreement_version, order?.contractVersion, order?.contract_version, 'v1.0')),
    issuedAt: pickFirstValue(order?.createdAt, order?.created_at, order?.date, new Date().toISOString()),
    acceptedAt: explicitAccepted ? pickFirstValue(order?.agreementAcceptedAt, order?.agreement_accepted_at, order?.acceptedAt, order?.accepted_at, order?.updatedAt, order?.updated_at, order?.date) : null,
    rejectedAt: explicitRejected ? pickFirstValue(order?.agreementRejectedAt, order?.agreement_rejected_at, order?.rejectedAt, order?.rejected_at, order?.updatedAt, order?.updated_at) : null,
    decisionAt: explicitAccepted || explicitRejected
      ? pickFirstValue(order?.agreementAcceptedAt, order?.agreement_accepted_at, order?.agreementRejectedAt, order?.agreement_rejected_at, order?.updatedAt, order?.updated_at, order?.date)
      : null,
    decisionBy: normalizeText(pickFirstValue(order?.acceptedBy, order?.accepted_by, order?.rejectedBy, order?.rejected_by, clientName, user?.name, 'Customer')),
    verifiedAt: pickFirstValue(order?.verifiedAt, order?.verified_at, order?.acceptanceVerifiedAt, order?.acceptance_verified_at),
    verifiedBy: normalizeText(pickFirstValue(order?.verifiedBy, order?.verified_by)),
    verificationStatus: normalizeText(pickFirstValue(order?.verificationStatus, order?.verification_status)),
    requiresSignedDocument: contractRequiresSignedDocument(order, relatedService),
    signedDocumentName: signedDocument.name,
    signedDocumentUploadedAt: signedDocument.uploadedAt,
    signedDocumentUrl: signedDocument.url,
    downloadUrl: getContractDownloadUrl({ order, service: relatedService }),
    auditReference: `ORDER-${orderKey}`,
    documentSections: getAgreementSections(serviceName),
  }, overrides);
};

const buildDerivedServiceContract = ({ service, overrides, index }) => {
  const serviceKey = normalizeText(pickFirstValue(service?.id, service?.serviceId, `service-${index}`));
  const serviceName = normalizeText(pickFirstValue(service?.name, service?.serviceName)) || 'Service Agreement';
  const clientName = normalizeText(pickFirstValue(service?.clientName, service?.client, service?.customerName, service?.customer)) || 'Customer';
  const signedDocument = getContractSignedDocumentMetadata(service);

  return applyContractOverride({
    id: `service-${serviceKey}`,
    externalKey: `service-${serviceKey}`,
    source: 'derived-service',
    scope: 'service',
    title: `${serviceName} Service Contract`,
    description: 'Agreement record inherited from the active customer service profile.',
    clientId: pickFirstValue(service?.clientId, service?.client_id, service?.userId, service?.user_id),
    clientName,
    serviceName,
    serviceId: pickFirstValue(service?.id, service?.serviceId),
    status: 'Accepted',
    version: normalizeText(pickFirstValue(service?.agreementVersion, service?.agreement_version, service?.contractVersion, service?.contract_version, 'v1.0')),
    issuedAt: pickFirstValue(service?.createdAt, service?.created_at, service?.updatedAt, service?.updated_at, service?.renewsOn, new Date().toISOString()),
    acceptedAt: pickFirstValue(service?.agreementAcceptedAt, service?.agreement_accepted_at, service?.updatedAt, service?.updated_at, service?.createdAt, service?.created_at),
    decisionAt: pickFirstValue(service?.agreementAcceptedAt, service?.agreement_accepted_at, service?.updatedAt, service?.updated_at),
    decisionBy: normalizeText(pickFirstValue(service?.acceptedBy, service?.accepted_by, clientName, 'Customer')),
    verifiedAt: pickFirstValue(service?.verifiedAt, service?.verified_at, service?.acceptanceVerifiedAt, service?.acceptance_verified_at),
    verifiedBy: normalizeText(pickFirstValue(service?.verifiedBy, service?.verified_by)),
    verificationStatus: normalizeText(pickFirstValue(service?.verificationStatus, service?.verification_status)),
    requiresSignedDocument: contractRequiresSignedDocument(service),
    signedDocumentName: signedDocument.name,
    signedDocumentUploadedAt: signedDocument.uploadedAt,
    signedDocumentUrl: signedDocument.url,
    downloadUrl: getContractDownloadUrl({ service }),
    auditReference: `SERVICE-${serviceKey}`,
    documentSections: getAgreementSections(serviceName),
  }, overrides);
};

const normalizeRemoteContract = ({ contract, orders, myServices, services, overrides, user, index }) => {
  const remoteId = normalizeText(pickFirstValue(contract?.id, contract?.contractId, contract?.contract_id, contract?.referenceId, contract?.reference_id));
  const orderKey = normalizeText(pickFirstValue(contract?.orderId, contract?.order_id, contract?.orderNumber, contract?.order_number));
  const matchingOrder = ensureArray(orders).find((order) => (
    normalizeText(pickFirstValue(order?.id, order?.orderNumber, order?.order_number)) === orderKey
  )) ?? null;
  const relatedService = findRelatedService({
    serviceId: pickFirstValue(contract?.serviceId, contract?.service_id, matchingOrder?.serviceId, matchingOrder?.service_id),
    serviceName: pickFirstValue(contract?.serviceName, contract?.service_name, matchingOrder?.serviceName, matchingOrder?.service_name),
    myServices,
    services,
  });
  const serviceName = normalizeText(pickFirstValue(
    contract?.serviceName,
    contract?.service_name,
    contract?.title,
    matchingOrder?.serviceName,
    matchingOrder?.service_name,
    relatedService?.name,
    relatedService?.serviceName,
  )) || 'Service Agreement';
  const clientName = normalizeText(pickFirstValue(
    contract?.clientName,
    contract?.client_name,
    contract?.customerName,
    contract?.customer_name,
    matchingOrder?.clientName,
    matchingOrder?.client,
    matchingOrder?.customerName,
    matchingOrder?.customer,
    relatedService?.clientName,
    relatedService?.client,
    relatedService?.customerName,
    relatedService?.customer,
  )) || 'Customer';
  const explicitAccepted = normalizeBoolean(pickFirstValue(
    contract?.accepted,
    contract?.isAccepted,
    contract?.agreementAccepted,
    contract?.agreement_accepted,
  ));
  const explicitRejected = normalizeBoolean(pickFirstValue(
    contract?.rejected,
    contract?.isRejected,
    contract?.agreementRejected,
    contract?.agreement_rejected,
  ));
  const signedDocument = getContractSignedDocumentMetadata(contract, matchingOrder, relatedService);

  return applyContractOverride({
    id: remoteId || (orderKey ? `order-${orderKey}` : relatedService?.id ? `service-${relatedService.id}` : `contract-${index}`),
    externalKey: normalizeText(pickFirstValue(contract?.externalKey, contract?.external_key, orderKey ? `order-${orderKey}` : null, relatedService?.id ? `service-${relatedService.id}` : null)) || remoteId || `contract-${index}`,
    source: 'remote-contract',
    scope: normalizeText(pickFirstValue(contract?.scope, contract?.type, orderKey ? 'order' : 'service')) || 'order',
    title: normalizeText(pickFirstValue(contract?.title, contract?.name)) || `${serviceName} Agreement`,
    description: normalizeText(pickFirstValue(contract?.description, contract?.summary)) || 'Contract and compliance record returned by the backend contracts endpoint.',
    clientId: pickFirstValue(contract?.clientId, contract?.client_id, contract?.userId, contract?.user_id, matchingOrder?.clientId, matchingOrder?.client_id, relatedService?.clientId, relatedService?.client_id),
    clientName,
    serviceName,
    serviceId: pickFirstValue(contract?.serviceId, contract?.service_id, relatedService?.id),
    orderId: pickFirstValue(contract?.orderId, contract?.order_id, matchingOrder?.id),
    orderNumber: pickFirstValue(contract?.orderNumber, contract?.order_number, matchingOrder?.orderNumber, matchingOrder?.order_number),
    status: normalizeText(pickFirstValue(
      contract?.status,
      contract?.decisionStatus,
      contract?.decision_status,
      explicitRejected ? 'Rejected' : explicitAccepted ? 'Accepted' : null,
    )) || 'Pending Review',
    version: normalizeText(pickFirstValue(contract?.version, contract?.agreementVersion, contract?.agreement_version, 'v1.0')),
    issuedAt: pickFirstValue(contract?.issuedAt, contract?.issued_at, contract?.createdAt, contract?.created_at, matchingOrder?.date, new Date().toISOString()),
    acceptedAt: pickFirstValue(contract?.acceptedAt, contract?.accepted_at),
    rejectedAt: pickFirstValue(contract?.rejectedAt, contract?.rejected_at),
    decisionAt: pickFirstValue(contract?.decisionAt, contract?.decision_at, contract?.acceptedAt, contract?.accepted_at, contract?.rejectedAt, contract?.rejected_at),
    decisionBy: normalizeText(pickFirstValue(contract?.decisionBy, contract?.decision_by, clientName, user?.name, 'Customer')),
    verifiedAt: pickFirstValue(contract?.verifiedAt, contract?.verified_at, contract?.acceptanceVerifiedAt, contract?.acceptance_verified_at),
    verifiedBy: normalizeText(pickFirstValue(contract?.verifiedBy, contract?.verified_by)),
    verificationStatus: normalizeText(pickFirstValue(contract?.verificationStatus, contract?.verification_status)),
    requiresSignedDocument: contractRequiresSignedDocument(contract, relatedService),
    signedDocumentName: signedDocument.name,
    signedDocumentUploadedAt: signedDocument.uploadedAt,
    signedDocumentUrl: signedDocument.url,
    downloadUrl: getContractDownloadUrl({ contract, order: matchingOrder, service: relatedService }),
    auditReference: normalizeText(pickFirstValue(contract?.auditReference, contract?.audit_reference, remoteId, orderKey, relatedService?.id)) || `CONTRACT-${index + 1}`,
    documentSections: normalizeDocumentSections(contract?.documentSections || contract?.documents, serviceName),
  }, overrides);
};

export const buildContractRecords = ({ orders = [], myServices = [], services = [], remoteContracts = [], overrides = {}, user }) => {
  const derivedOrderContracts = ensureArray(orders).map((order, index) => buildDerivedOrderContract({
    order,
    services,
    myServices,
    overrides,
    user,
    index,
  }));
  const orderKeys = new Set(derivedOrderContracts.map((contract) => contract.externalKey));
  const derivedServiceContracts = ensureArray(myServices)
    .filter((service) => !orderKeys.has(`service-${normalizeText(pickFirstValue(service?.id, service?.serviceId))}`))
    .map((service, index) => buildDerivedServiceContract({ service, overrides, index }));
  const normalizedRemoteContracts = ensureArray(remoteContracts).map((contract, index) => normalizeRemoteContract({
    contract,
    orders,
    myServices,
    services,
    overrides,
    user,
    index,
  }));
  const byKey = new Map();

  [...derivedOrderContracts, ...derivedServiceContracts].forEach((contract) => {
    byKey.set(contract.externalKey || contract.id, contract);
  });

  normalizedRemoteContracts.forEach((contract) => {
    const key = contract.externalKey || contract.id;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, contract);
      return;
    }

    byKey.set(key, applyContractOverride({
      ...existing,
      ...contract,
      documentSections: contract.documentSections?.length ? contract.documentSections : existing.documentSections,
      downloadUrl: pickFirstValue(contract.downloadUrl, existing.downloadUrl),
      signedDocumentName: pickFirstValue(contract.signedDocumentName, existing.signedDocumentName),
      signedDocumentUploadedAt: pickFirstValue(contract.signedDocumentUploadedAt, existing.signedDocumentUploadedAt),
      signedDocumentUrl: pickFirstValue(contract.signedDocumentUrl, existing.signedDocumentUrl),
    }, overrides));
  });

  return Array.from(byKey.values()).sort((a, b) => {
    const timeA = new Date(a?.issuedAt ?? 0).getTime();
    const timeB = new Date(b?.issuedAt ?? 0).getTime();

    if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
      return 0;
    }

    if (Number.isNaN(timeA)) {
      return 1;
    }

    if (Number.isNaN(timeB)) {
      return -1;
    }

    return timeB - timeA;
  });
};

export const buildCheckoutAgreementRecord = ({ cart = [], services = [], overrides = {} }) => {
  const items = ensureArray(cart).filter(Boolean);

  if (!items.length) {
    return null;
  }

  const distinctServiceNames = [...new Set(items.map((item) => normalizeText(item?.serviceName)).filter(Boolean))];
  const fingerprint = items
    .map((item) => [
      normalizeText(item?.serviceId),
      normalizeText(item?.serviceName),
      normalizeText(item?.configuration),
      ensureArray(item?.addon).map((addon) => normalizeText(addon?.label || addon?.name || addon)).join(','),
    ].join(':'))
    .join('|');
  const primaryService = findRelatedService({
    serviceId: pickFirstValue(items[0]?.serviceId, items[0]?.service_id),
    serviceName: pickFirstValue(items[0]?.serviceName, items[0]?.service_name),
    myServices: [],
    services,
  });
  const requiresSignedDocument = items.some((item) => contractRequiresSignedDocument(item, primaryService));
  const serviceLabel = distinctServiceNames.length === 1
    ? distinctServiceNames[0]
    : `${distinctServiceNames.length} service orders`;

  return applyContractOverride({
    id: `checkout-${fingerprint}`,
    externalKey: `checkout-${fingerprint}`,
    source: 'checkout',
    scope: 'checkout',
    title: distinctServiceNames.length === 1 ? `${serviceLabel} Agreement Pack` : 'Checkout Agreement Pack',
    description: 'Review and approve the purchase agreement, Terms of Service, and Privacy Policy before payment proceeds.',
    serviceName: serviceLabel,
    status: 'Pending Review',
    version: 'v1.0',
    issuedAt: new Date().toISOString(),
    acceptedAt: null,
    rejectedAt: null,
    decisionAt: null,
    decisionBy: 'Customer',
    requiresSignedDocument,
    signedDocumentName: null,
    signedDocumentUploadedAt: null,
    signedDocumentUrl: null,
    downloadUrl: getContractDownloadUrl({ service: primaryService }),
    auditReference: 'CHECKOUT-AGREEMENT',
    documentSections: [
      {
        id: 'purchase-agreement',
        title: 'Purchase Agreement',
        description: 'Confirms service scope, provisioning checks, activation timing, and customer obligations before delivery.',
      },
      {
        id: 'terms-of-service',
        title: 'Terms of Service',
        description: 'Captures billing schedules, renewals, cancellations, and account handling rules for the selected order.',
      },
      {
        id: 'privacy-policy',
        title: 'Privacy Policy',
        description: 'Documents how account data, technical records, and support messages are stored and processed.',
      },
    ],
  }, overrides);
};
