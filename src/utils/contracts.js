const CONTRACT_OVERRIDE_STORAGE_KEY = 'wsi-contract-overrides-v1';
const CONTRACT_ESIGN_STORAGE_KEY = 'wsi-contract-esign-v1';
const MANAGED_CONTRACT_TEMPLATE_STORAGE_KEY = 'wsi-managed-contract-templates-v1';
const CONTRACT_DELIVERY_STORAGE_KEY = 'wsi-contract-delivery-v1';

const SIGNATORY_FIELD_LABELS = {
  company: 'Company / Organization',
  printedName: 'Printed Name',
  title: 'Title / Role',
  signature: 'Signature',
  dateSigned: 'Date Signed',
};

const createEmptySignatoryProfile = () => ({
  company: '',
  printedName: '',
  title: '',
});

const profileToPrefilledFields = (profile) => {
  if (!profile || typeof profile !== 'object') {
    return {};
  }

  return {
    [SIGNATORY_FIELD_LABELS.company]: normalizeText(profile.company),
    [SIGNATORY_FIELD_LABELS.printedName]: normalizeText(profile.printedName),
    [SIGNATORY_FIELD_LABELS.title]: normalizeText(profile.title),
  };
};

const prefilledFieldsToProfile = (prefilledFields) => {
  if (!prefilledFields || typeof prefilledFields !== 'object') {
    return createEmptySignatoryProfile();
  }

  const findValue = (...labels) => {
    for (const label of labels) {
      if (prefilledFields[label]) {
        return normalizeText(prefilledFields[label]);
      }
    }

    return '';
  };

  return {
    company: findValue(SIGNATORY_FIELD_LABELS.company, 'Company', 'Organization'),
    printedName: findValue(SIGNATORY_FIELD_LABELS.printedName, 'Printed Name', 'Name'),
    title: findValue(SIGNATORY_FIELD_LABELS.title, 'Title / Role', 'Title', 'Role'),
  };
};

export const normalizeSignatoryProfiles = (profiles, { customerName = 'Customer', providerName = 'WSI Portal Services' } = {}) => {
  const source = Array.isArray(profiles) ? profiles : [];

  return [0, 1].map((index) => ({
    company: normalizeText(source[index]?.company) || (index === 0 ? customerName : providerName),
    printedName: normalizeText(source[index]?.printedName) || (index === 0 ? customerName : ''),
    title: normalizeText(source[index]?.title) || (index === 1 ? 'Authorized Representative' : ''),
  }));
};

export const buildSignatoryStateFromContract = (contract, managedTemplate = {}) => {
  const customerName = normalizeText(managedTemplate.customerName || contract?.clientName || contract?.customerName) || 'Customer';
  const providerName = normalizeText(managedTemplate.providerName || contract?.providerName) || 'WSI Portal Services';

  if (Array.isArray(managedTemplate.signatoryProfiles) && managedTemplate.signatoryProfiles.length) {
    return normalizeSignatoryProfiles(managedTemplate.signatoryProfiles, { customerName, providerName });
  }

  const persisted = Array.isArray(contract?.eSignatureSignatories) ? contract.eSignatureSignatories : [];

  return [0, 1].map((index) => {
    const profile = prefilledFieldsToProfile(persisted[index]?.prefilledFields);
    const normalized = normalizeSignatoryProfiles([profile], { customerName, providerName })[0];

    if (index === 0) {
      return {
        company: normalized.company || customerName,
        printedName: normalized.printedName || customerName,
        title: normalized.title,
      };
    }

    return {
      company: normalized.company || providerName,
      printedName: normalized.printedName,
      title: normalized.title || 'Authorized Representative',
    };
  });
};

export const buildESignatureSignatoriesFromProfiles = (profiles, existingSignatories = []) => {
  const normalizedProfiles = normalizeSignatoryProfiles(profiles);

  return normalizedProfiles.map((profile, index) => {
    const existing = existingSignatories[index];

    if (existing?.eSignedAt) {
      return existing;
    }

    return {
      prefilledFields: profileToPrefilledFields(profile),
      ...(existing?.eSignedAt ? { eSignedAt: existing.eSignedAt } : {}),
    };
  });
};
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

const normalizeContractStorageKey = (value) => normalizeText(value);

const resolveContractStorageKeys = (...values) => {
  const keys = values.flatMap((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === 'object') {
      return [value.id, value.externalKey, value.contractId, value.contract_id];
    }

    return [value];
  })
    .map((value) => normalizeContractStorageKey(value))
    .filter(Boolean);

  return [...new Set(keys)];
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

const formatContractTemplateDate = (value) => {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return 'To be completed at signing';
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue;
  }

  return parsedDate.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatAgreementDisplayText = (value) => normalizeText(value)
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stripHtmlToText = (value) => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return '';
  }

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = normalized;
    return normalizeText(container.innerText || container.textContent || '');
  }

  return normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const normalizeManagedTemplateText = (...values) => {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = stripHtmlToText(value)
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (normalized) {
      return normalized;
    }
  }

  return '';
};

const normalizeManagedTemplateSections = (sections = [], fallbackSections = []) => {
  const normalized = ensureArray(sections)
    .map((section, index) => {
      if (!section || typeof section !== 'object') {
        return null;
      }

      const title = normalizeText(section.title || section.label) || `Clause ${index + 1}`;
      const body = normalizeManagedTemplateText(section.bodyText, section.body, section.bodyHtml);

      if (!title && !body) {
        return null;
      }

      return {
        title,
        body,
      };
    })
    .filter((section) => section?.title || section?.body);

  return normalized.length ? normalized : fallbackSections;
};

const normalizeManagedTemplateDocuments = (documents = [], fallbackDocuments = []) => {
  const normalized = ensureArray(documents)
    .map((document, index) => {
      if (!document || typeof document !== 'object') {
        return null;
      }

      const title = normalizeText(document.title || document.label) || `Document ${index + 1}`;
      const description = normalizeManagedTemplateText(document.descriptionText, document.description, document.descriptionHtml);

      if (!title && !description) {
        return null;
      }

      return {
        title,
        description,
      };
    })
    .filter((document) => document?.title || document?.description);

  return normalized.length ? normalized : fallbackDocuments;
};

const getManagedTemplateSettings = (contract) => (
  contract?.managedTemplateSettings && typeof contract.managedTemplateSettings === 'object' && !Array.isArray(contract.managedTemplateSettings)
    ? contract.managedTemplateSettings
    : null
);

const getContractTemplateData = (contract) => {
  const managedTemplateSettings = getManagedTemplateSettings(contract);
  const rawServiceName = normalizeText(pickFirstValue(managedTemplateSettings?.serviceName, contract?.serviceName, contract?.title)) || 'Managed Service';
  const rawContractTitle = normalizeText(pickFirstValue(managedTemplateSettings?.contractTitle, managedTemplateSettings?.title, contract?.title, `${rawServiceName} Agreement`)) || 'Service Agreement';
  const serviceName = formatAgreementDisplayText(rawServiceName) || rawServiceName;
  const contractTitle = formatAgreementDisplayText(rawContractTitle) || rawContractTitle;
  const providerName = formatAgreementDisplayText(pickFirstValue(managedTemplateSettings?.providerName, contract?.providerName, contract?.companyName, contract?.vendorName)) || 'WSI Portal Services';
  const customerName = formatAgreementDisplayText(pickFirstValue(managedTemplateSettings?.customerName, contract?.clientName, contract?.customerName, contract?.customer)) || 'Customer';
  const reference = normalizeText(pickFirstValue(managedTemplateSettings?.reference, contract?.auditReference, contract?.orderNumber, contract?.orderId, contract?.id)) || 'Pending reference';
  const version = normalizeText(pickFirstValue(managedTemplateSettings?.version, contract?.version)) || 'v1.0';
  const effectiveDate = formatContractTemplateDate(pickFirstValue(contract?.issuedAt, contract?.acceptedAt, new Date().toISOString()));
  const preparedDate = formatContractTemplateDate(new Date().toISOString());
  const scopeLabel = contract?.scope === 'checkout'
    ? 'checkout order review and approval'
    : contract?.scope === 'service'
      ? 'ongoing subscribed services'
      : 'ordered services and related deliverables';
  const documentSections = normalizeDocumentSections(contract?.documentSections, serviceName);

  return {
    contractTitle,
    providerName,
    customerName,
    serviceName,
    reference,
    version,
    effectiveDate,
    preparedDate,
    scopeLabel,
    documentSections,
  };
};

export const buildContractTemplateDocument = (contract) => {
  const template = getContractTemplateData(contract);
  const managedTemplateSettings = getManagedTemplateSettings(contract);
  const agreementTitle = template.serviceName && template.serviceName !== 'WSI Portal Services'
    ? `${template.serviceName} Service Agreement`
    : 'WSI Service Agreement';
  const persistedSignatories = Array.isArray(contract?.eSignatureSignatories) ? contract.eSignatureSignatories : [];
  const profilePrefills = normalizeSignatoryProfiles(managedTemplateSettings?.signatoryProfiles, {
    customerName: template.customerName,
    providerName: template.providerName,
  });
  const signatories = [
    {
      title: 'Customer / Client Representative',
      helper: 'Authorized signatory for the customer or buying entity.',
      fields: ['Company / Organization', 'Printed Name', 'Title / Role', 'Signature', 'Date Signed'],
    },
    {
      title: `${template.providerName} Authorized Representative`,
      helper: 'Authorized signatory for the service provider.',
      fields: ['Company / Organization', 'Printed Name', 'Title / Role', 'Signature', 'Date Signed'],
    },
  ].map((signatory, index) => {
    const persistedSignatory = persistedSignatories[index];
    const profilePrefilled = profileToPrefilledFields(profilePrefills[index]);
    const persistedPrefilled = persistedSignatory?.prefilledFields && typeof persistedSignatory.prefilledFields === 'object'
      ? persistedSignatory.prefilledFields
      : {};
    const mergedPrefilled = {
      ...profilePrefilled,
      ...persistedPrefilled,
    };

    return {
      ...signatory,
      ...(Object.keys(mergedPrefilled).length ? { prefilledFields: mergedPrefilled } : {}),
      ...(persistedSignatory?.eSignedAt ? { eSignedAt: persistedSignatory.eSignedAt } : {}),
    };
  });

  const defaultOverview = `This Service Agreement is entered into by and between ${template.providerName} and ${template.customerName} for ${template.scopeLabel} associated with ${template.serviceName}. By signing this document, the parties confirm the commercial, operational, and compliance obligations captured in the approved order, service record, and incorporated documents listed below.`;
  const defaultSections = [
    {
      title: 'Parties and Service Scope',
      body: `This Agreement governs the delivery and administration of ${template.serviceName}, together with any approved order form, onboarding requirements, support commitments, renewal instructions, and service records maintained in the WSI Portal.`,
    },
    {
      title: 'Service Delivery and Support',
      body: `${template.providerName} will provision, maintain, and support ${template.serviceName} in accordance with the approved order, accepted configuration, implementation notes, operational standards, and applicable service policies.`,
    },
    {
      title: 'Fees, Billing, and Renewals',
      body: 'Recurring charges, one-time fees, renewal schedules, taxes, and approved add-ons will follow the commercial terms stated in the portal, quotation, invoice, or service order accepted by the customer.',
    },
    {
      title: 'Customer Obligations and Authorized Use',
      body: `${template.customerName} will provide accurate account information, timely approvals, requested technical details, lawful instructions, and reasonable cooperation needed to provision, secure, and maintain the subscribed service.`,
    },
    {
      title: 'Provider Duties and Standards of Care',
      body: `${template.providerName} will use commercially reasonable efforts to operate, support, and administer the subscribed service in accordance with documented service policies, internal controls, and applicable law.`,
    },
    {
      title: 'Confidentiality and Data Protection',
      body: 'Each party will protect confidential information and process account, operational, and personal data only for legitimate service delivery, billing, support, compliance, and legal purposes consistent with applicable privacy and data protection obligations.',
    },
    {
      title: 'Term, Suspension, and Termination',
      body: 'This Agreement takes effect on the effective date or activation date, whichever occurs first, and remains in force until the service expires, is terminated, is suspended under applicable policies, or is superseded by a newer signed agreement.',
    },
    {
      title: 'Incorporated Records and Portal Copy',
      body: 'Approved order forms, invoices, implementation notes, service schedules, policies, and contract attachments maintained in the WSI Portal are incorporated into this Agreement to the extent they apply to the subscribed service.',
    },
    {
      title: 'Execution and Authority',
      body: 'By signing below, the parties confirm that they are authorized to bind their respective organizations, that they reviewed the incorporated service documents, and that this signed copy may be stored in the WSI Portal as the official contract record.',
    },
  ];
  const defaultDocuments = template.documentSections.map((section) => ({
    title: section.title,
    description: section.description || 'Included in the agreement bundle.',
  }));
  const defaultSignatureStatement = 'IN WITNESS WHEREOF, the parties, intending to be legally bound, have caused this Agreement to be signed by their duly authorized representatives on the dates written below.';
  const defaultNote = 'Service-specific schedules, statements of work, SLAs, implementation milestones, compliance appendices, approval notes, or supporting exhibits may be attached to the fully signed copy and retained with this agreement record.';

  return {
    badge: normalizeText(pickFirstValue(managedTemplateSettings?.badge, 'Official agreement for execution')) || 'Official agreement for execution',
    title: normalizeText(pickFirstValue(managedTemplateSettings?.title, agreementTitle)) || agreementTitle,
    subtitle: normalizeText(pickFirstValue(managedTemplateSettings?.subtitle, `${template.customerName} and ${template.providerName} | Reference ${template.reference}`)) || `${template.customerName} and ${template.providerName} | Reference ${template.reference}`,
    metadata: [
      { label: 'Agreement Type', value: normalizeText(pickFirstValue(managedTemplateSettings?.agreementType, 'Service Agreement')) || 'Service Agreement' },
      { label: 'Reference', value: template.reference },
      { label: 'Provider', value: template.providerName },
      { label: 'Customer', value: template.customerName },
      { label: 'Service', value: template.serviceName },
      { label: 'Version', value: template.version },
      { label: 'Effective Date', value: template.effectiveDate },
      { label: 'Prepared On', value: template.preparedDate },
    ],
    overview: normalizeManagedTemplateText(managedTemplateSettings?.overviewText, managedTemplateSettings?.overview, managedTemplateSettings?.overviewHtml, defaultOverview) || defaultOverview,
    sections: normalizeManagedTemplateSections(managedTemplateSettings?.sections, defaultSections),
    documents: normalizeManagedTemplateDocuments(managedTemplateSettings?.documents, defaultDocuments),
    signatureStatement: normalizeManagedTemplateText(managedTemplateSettings?.signatureStatementText, managedTemplateSettings?.signatureStatement, managedTemplateSettings?.signatureStatementHtml, defaultSignatureStatement) || defaultSignatureStatement,
    signatories,
    note: normalizeManagedTemplateText(managedTemplateSettings?.noteText, managedTemplateSettings?.note, managedTemplateSettings?.noteHtml, defaultNote) || defaultNote,
  };
};

export const buildContractTemplateText = (contract) => {
  const template = buildContractTemplateDocument(contract);
  const sectionLines = template.sections.flatMap((section, index) => [
    `${index + 1}. ${section.title}`,
    section.body,
    '',
  ]);
  const documentLines = template.documents.map((document, index) => (
    `${index + 1}. ${document.title}${document.description ? ` - ${document.description}` : ''}`
  ));
  const signatoryLines = template.signatories.flatMap((signatory) => [
    signatory.title,
    ...(Array.isArray(signatory.fields) && signatory.fields.length ? signatory.fields : ['Printed Name', 'Signature', 'Date']).map(
      (field) => `${field}: ______________________________`,
    ),
    '',
  ]);

  return [
    template.title.toUpperCase(),
    '',
    ...template.metadata.map((item) => `${item.label}: ${item.value}`),
    '',
    'Agreement Summary',
    template.overview,
    '',
    ...sectionLines,
    'Included Documents',
    ...documentLines,
    '',
    template.signatureStatement,
    '',
    'Signature Blocks',
    ...signatoryLines,
    'Additional Notes',
    template.note,
  ].join('\n').replace(/\n{3,}/g, '\n\n');
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

const readStoredContractDeliveryMap = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(CONTRACT_DELIVERY_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

export const readStoredContractDelivery = (...values) => {
  const keys = resolveContractStorageKeys(...values);

  if (!keys.length) {
    return null;
  }

  const deliveryMap = readStoredContractDeliveryMap();

  for (const key of keys) {
    const entry = deliveryMap[key];

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return entry;
    }
  }

  return null;
};

export const writeStoredContractDelivery = (values, patch = {}) => {
  const keys = resolveContractStorageKeys(values);

  if (!keys.length || !patch || typeof patch !== 'object') {
    return null;
  }

  try {
    const deliveryMap = readStoredContractDeliveryMap();
    const previous = readStoredContractDelivery(values) ?? {};
    const nextEntry = { ...previous, ...patch };

    keys.forEach((key) => {
      deliveryMap[key] = nextEntry;
    });

    localStorage.setItem(CONTRACT_DELIVERY_STORAGE_KEY, JSON.stringify(deliveryMap));
    return nextEntry;
  } catch (error) {
    return null;
  }
};

const applyContractOverride = (contract, overrides = {}) => {
  const sharedESignState = readStoredContractESignState(contract);
  const sharedManagedTemplateState = readStoredManagedContractTemplate(contract);
  const sharedDeliveryState = readStoredContractDelivery(contract);
  const sharedSignedDocument = getContractSignedDocumentMetadata(sharedESignState ?? {});
  const deliveryPendingReview = sharedDeliveryState?.sentToCustomerAt
    && !acceptedStatusTokens.has(normalizeText(contract?.status).toLowerCase());
  const baseContract = {
    ...contract,
    managedTemplateSettings: pickFirstValue(sharedManagedTemplateState?.managedTemplateSettings, contract?.managedTemplateSettings),
    managedTemplateUpdatedAt: pickFirstValue(sharedManagedTemplateState?.updatedAt, sharedManagedTemplateState?.managedTemplateUpdatedAt, contract?.managedTemplateUpdatedAt),
    managedTemplateUpdatedBy: pickFirstValue(sharedManagedTemplateState?.updatedBy, sharedManagedTemplateState?.managedTemplateUpdatedBy, contract?.managedTemplateUpdatedBy),
    sentToCustomerAt: pickFirstValue(sharedDeliveryState?.sentToCustomerAt, contract?.sentToCustomerAt),
    sentToCustomerBy: pickFirstValue(sharedDeliveryState?.sentToCustomerBy, contract?.sentToCustomerBy),
    deliveryStatus: pickFirstValue(sharedDeliveryState?.deliveryStatus, contract?.deliveryStatus),
    ...(deliveryPendingReview ? { status: 'Pending Review' } : {}),
    signedDocumentName: pickFirstValue(contract?.signedDocumentName, sharedSignedDocument.name),
    signedDocumentUploadedAt: pickFirstValue(contract?.signedDocumentUploadedAt, sharedSignedDocument.uploadedAt),
    signedDocumentUrl: pickFirstValue(contract?.signedDocumentUrl, sharedSignedDocument.url),
    eSignatureSignatories: Array.isArray(contract?.eSignatureSignatories) && contract.eSignatureSignatories.length
      ? contract.eSignatureSignatories
      : Array.isArray(sharedESignState?.eSignatureSignatories) && sharedESignState.eSignatureSignatories.length
        ? sharedESignState.eSignatureSignatories
        : contract?.eSignatureSignatories,
    eSignatureUpdatedAt: pickFirstValue(contract?.eSignatureUpdatedAt, sharedESignState?.eSignatureUpdatedAt),
  };
  const override = overrides?.[contract.id] ?? overrides?.[contract.externalKey];
  const next = override ? { ...baseContract, ...override } : { ...baseContract };
  const signedDocument = getContractSignedDocumentMetadata(next, baseContract);
  const verifiedAt = pickFirstValue(
    next.verifiedAt,
    next.verified_at,
    next.acceptanceVerifiedAt,
    next.acceptance_verified_at,
    baseContract.verifiedAt,
    baseContract.verified_at,
    baseContract.acceptanceVerifiedAt,
    baseContract.acceptance_verified_at,
  );
  const verificationSource = {
    ...baseContract,
    ...next,
    verifiedAt,
  };

  return {
    ...next,
    status: normalizeContractStatus(next.status),
    clientId: pickFirstValue(next.clientId, baseContract.clientId),
    clientName: pickFirstValue(next.clientName, baseContract.clientName),
    documentSections: normalizeDocumentSections(next.documentSections, next.serviceName),
    downloadUrl: resolveAssetUrl(pickFirstValue(next.downloadUrl, baseContract.downloadUrl)),
    acceptedAt: pickFirstValue(next.acceptedAt, baseContract.acceptedAt),
    rejectedAt: pickFirstValue(next.rejectedAt, baseContract.rejectedAt),
    decisionAt: pickFirstValue(next.decisionAt, next.acceptedAt, next.rejectedAt, baseContract.decisionAt),
    verifiedAt,
    verifiedBy: pickFirstValue(next.verifiedBy, next.verified_by, baseContract.verifiedBy, baseContract.verified_by),
    verificationStatus: pickFirstValue(next.verificationStatus, next.verification_status, baseContract.verificationStatus, getContractVerificationStatus(verificationSource)),
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

const readStoredManagedContractTemplateMap = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(MANAGED_CONTRACT_TEMPLATE_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

export const readStoredManagedContractTemplate = (...values) => {
  const keys = resolveContractStorageKeys(...values);

  if (!keys.length) {
    return null;
  }

  const templateMap = readStoredManagedContractTemplateMap();

  for (const key of keys) {
    const entry = templateMap[key];

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return entry;
    }
  }

  return null;
};

export const writeStoredManagedContractTemplate = (values, patch = {}) => {
  const keys = resolveContractStorageKeys(values);

  if (!keys.length || !patch || typeof patch !== 'object') {
    return null;
  }

  try {
    const templateMap = readStoredManagedContractTemplateMap();
    const previous = readStoredManagedContractTemplate(values) ?? {};
    const nextEntry = {
      ...previous,
      ...patch,
      managedTemplateSettings: patch.managedTemplateSettings && typeof patch.managedTemplateSettings === 'object'
        ? patch.managedTemplateSettings
        : previous.managedTemplateSettings,
    };

    keys.forEach((key) => {
      templateMap[key] = nextEntry;
    });

    localStorage.setItem(MANAGED_CONTRACT_TEMPLATE_STORAGE_KEY, JSON.stringify(templateMap));
    return nextEntry;
  } catch (error) {
    return null;
  }
};

export const clearStoredManagedContractTemplate = (...values) => {
  const keys = resolveContractStorageKeys(...values);

  if (!keys.length) {
    return false;
  }

  try {
    const templateMap = readStoredManagedContractTemplateMap();
    let changed = false;

    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(templateMap, key)) {
        delete templateMap[key];
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(MANAGED_CONTRACT_TEMPLATE_STORAGE_KEY, JSON.stringify(templateMap));
    }

    return changed;
  } catch (error) {
    return false;
  }
};

const readStoredContractESignStateMap = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem(CONTRACT_ESIGN_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
};

export const readStoredContractESignState = (...values) => {
  const keys = resolveContractStorageKeys(...values);

  if (!keys.length) {
    return null;
  }

  const stateMap = readStoredContractESignStateMap();

  for (const key of keys) {
    const entry = stateMap[key];

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return entry;
    }
  }

  return null;
};

export const writeStoredContractESignState = (values, patch = {}) => {
  const keys = resolveContractStorageKeys(values);

  if (!keys.length || !patch || typeof patch !== 'object') {
    return null;
  }

  try {
    const stateMap = readStoredContractESignStateMap();
    const previous = readStoredContractESignState(values) ?? {};
    const nextEntry = { ...previous, ...patch };

    keys.forEach((key) => {
      stateMap[key] = nextEntry;
    });

    localStorage.setItem(CONTRACT_ESIGN_STORAGE_KEY, JSON.stringify(stateMap));
    return nextEntry;
  } catch (error) {
    return null;
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
