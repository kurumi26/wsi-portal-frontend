import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Download, Eye, FileSignature, PenLine, Plus, RotateCcw, Save, Send, Trash2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ESignatureModal from '../../components/common/ESignatureModal';
import PageHeader from '../../components/common/PageHeader';
import RichTextEditor from '../../components/common/RichTextEditor';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import usePageTitle from '../../hooks/usePageTitle';
import { portalApi } from '../../services/portalApi';
import { formatDateTime } from '../../utils/format';
import { buildContractTemplateDocument, buildSignatoryStateFromContract, normalizeSignatoryProfiles } from '../../utils/contracts';

const feedbackToneClasses = {
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  warning: 'border-orange-400/20 bg-orange-400/10 text-orange-100',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
};

const EDITOR_TABS = [
  { id: 'chrome', label: 'Document Chrome' },
  { id: 'overview', label: 'Statement' },
  { id: 'terms', label: 'Core Terms' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'signatures', label: 'Names & Signatures' },
  { id: 'execution', label: 'Execution' },
  { id: 'notes', label: 'Notes' },
];

const EMPTY_EDITOR_STATE = {
  badge: 'Official agreement for execution',
  title: '',
  subtitle: '',
  providerName: 'WSI Portal Services',
  customerName: 'Customer',
  serviceName: '',
  version: 'v1.0',
  overviewHtml: '',
  signatureStatementHtml: '',
  noteHtml: '',
  sections: [],
  documents: [],
  signatoryProfiles: normalizeSignatoryProfiles([]),
};

const createDraftId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const createRichTextFromPlainText = (value) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return '';
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
};

const richTextToPlainText = (value) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return '';
  }

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = normalized;

    return String(container.innerText || container.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const buildEditorState = (contract) => {
  if (!contract) {
    return { ...EMPTY_EDITOR_STATE };
  }

  const managedTemplate = contract?.managedTemplateSettings && typeof contract.managedTemplateSettings === 'object'
    ? contract.managedTemplateSettings
    : {};
  const templateDocument = buildContractTemplateDocument(contract);
  const sectionsSource = Array.isArray(managedTemplate.sections) && managedTemplate.sections.length
    ? managedTemplate.sections
    : templateDocument.sections.map((section, index) => ({
        id: `section-${index + 1}`,
        title: section.title,
        bodyText: section.body,
      }));
  const documentsSource = Array.isArray(managedTemplate.documents) && managedTemplate.documents.length
    ? managedTemplate.documents
    : templateDocument.documents.map((document, index) => ({
        id: `document-${index + 1}`,
        title: document.title,
        description: document.description || '',
      }));

  return {
    badge: managedTemplate.badge || templateDocument.badge || 'Official agreement for execution',
    title: managedTemplate.title || templateDocument.title,
    subtitle: managedTemplate.subtitle || templateDocument.subtitle,
    providerName: managedTemplate.providerName || contract?.providerName || 'WSI Portal Services',
    customerName: templateDocument.metadata.find((item) => item.label === 'Customer')?.value || contract?.clientName || contract?.company || 'Customer',
    serviceName: managedTemplate.serviceName || contract?.serviceName || contract?.title || '',
    version: managedTemplate.version || contract?.version || 'v1.0',
    overviewHtml: managedTemplate.overviewHtml || createRichTextFromPlainText(managedTemplate.overviewText || templateDocument.overview),
    signatureStatementHtml: managedTemplate.signatureStatementHtml || createRichTextFromPlainText(managedTemplate.signatureStatementText || templateDocument.signatureStatement),
    noteHtml: managedTemplate.noteHtml || createRichTextFromPlainText(managedTemplate.noteText || templateDocument.note),
    sections: sectionsSource.map((section, index) => ({
      id: section.id || createDraftId('section'),
      title: section.title || `Clause ${index + 1}`,
      bodyHtml: section.bodyHtml || createRichTextFromPlainText(section.bodyText || section.body || ''),
    })),
    documents: documentsSource.map((document, index) => ({
      id: document.id || createDraftId('document'),
      title: document.title || `Document ${index + 1}`,
      description: document.description || document.summary || '',
    })),
    signatoryProfiles: buildSignatoryStateFromContract(contract, {
      ...managedTemplate,
      customerName: managedTemplate.customerName || contract?.clientName || contract?.customerName,
      providerName: managedTemplate.providerName || contract?.providerName,
    }),
  };
};

const buildManagedTemplatePayload = (editorState) => ({
  title: String(editorState.title ?? '').trim(),
  badge: String(editorState.badge ?? '').trim(),
  subtitle: String(editorState.subtitle ?? '').trim(),
  providerName: String(editorState.providerName ?? '').trim(),
  customerName: String(editorState.customerName ?? '').trim(),
  serviceName: String(editorState.serviceName ?? '').trim(),
  version: String(editorState.version ?? '').trim(),
  overviewHtml: editorState.overviewHtml || '',
  overviewText: richTextToPlainText(editorState.overviewHtml),
  signatureStatementHtml: editorState.signatureStatementHtml || '',
  signatureStatementText: richTextToPlainText(editorState.signatureStatementHtml),
  noteHtml: editorState.noteHtml || '',
  noteText: richTextToPlainText(editorState.noteHtml),
  sections: (Array.isArray(editorState.sections) ? editorState.sections : [])
    .map((section, index) => ({
      id: section.id || createDraftId('section'),
      title: String(section.title ?? '').trim() || `Clause ${index + 1}`,
      bodyHtml: section.bodyHtml || '',
      bodyText: richTextToPlainText(section.bodyHtml),
    }))
    .filter((section) => section.title || section.bodyText),
  documents: (Array.isArray(editorState.documents) ? editorState.documents : [])
    .map((document, index) => ({
      id: document.id || createDraftId('document'),
      title: String(document.title ?? '').trim() || `Document ${index + 1}`,
      description: String(document.description ?? '').trim(),
    }))
    .filter((document) => document.title || document.description),
  signatoryProfiles: normalizeSignatoryProfiles(editorState.signatoryProfiles, {
    customerName: editorState.customerName,
    providerName: editorState.providerName,
  }),
});

function ContractLivePreview({ previewDocument }) {
  if (!previewDocument) {
    return null;
  }

  return (
    <div className="contract-paper-preview space-y-5 text-slate-900">
      <div className="rounded-[24px] bg-slate-900 px-5 py-5 text-white shadow-lg">
        <p className="inline-flex rounded-full bg-[#ff7a1a] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
          {previewDocument.badge}
        </p>
        <h4 className="mt-4 text-3xl font-semibold leading-tight text-white">{previewDocument.title}</h4>
        <p className="mt-3 text-sm leading-6 text-slate-300">{previewDocument.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {previewDocument.metadata.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#f6b37b] bg-[#fff3e8] p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d15f06]">Statement of Agreement</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{previewDocument.overview}</p>
      </div>

      <div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-sm">
        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Core Terms
        </div>
        <div className="mt-4 space-y-5">
          {previewDocument.sections.map((section, index) => (
            <div key={`${section.title}-${index}`}>
              <p className="text-sm font-semibold text-slate-900">{index + 1}. {section.title}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{section.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-900">
          <FileSignature size={16} />
          <p className="text-sm font-semibold">Schedules and Included Documents</p>
        </div>
        <div className="mt-4 space-y-3">
          {previewDocument.documents.map((document, index) => (
            <div key={`${document.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{index + 1}. {document.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{document.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Execution</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{previewDocument.signatureStatement}</p>
      </div>

      <div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Additional Notes</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{previewDocument.note}</p>
      </div>
    </div>
  );
}

export default function AdminContractEditorPage() {
  const { contractId = '' } = useParams();
  const decodedContractId = decodeURIComponent(contractId);
  const {
    adminContractRecords,
    isLoadingPortal,
    saveManagedContractTemplate,
    resetManagedContractTemplate,
    sendManagedContractToCustomer,
    uploadAdminSignedContract,
    pushPortalNotification,
  } = usePortal();

  const selectedContract = useMemo(
    () => adminContractRecords.find((contract) => String(contract.id) === decodedContractId) ?? null,
    [adminContractRecords, decodedContractId],
  );

  usePageTitle(selectedContract ? `${selectedContract.title} Editor` : 'Contract Editor');

  const [editorState, setEditorState] = useState(EMPTY_EDITOR_STATE);
  const [activeSectionId, setActiveSectionId] = useState('');
  const [activeTab, setActiveTab] = useState('chrome');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [eSignOpen, setESignOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isESignSubmitting, setIsESignSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedContract) {
      setEditorState({ ...EMPTY_EDITOR_STATE });
      setActiveSectionId('');
      return;
    }

    const nextState = buildEditorState(selectedContract);
    setEditorState(nextState);
    setActiveSectionId(nextState.sections[0]?.id || '');
    setFeedback(null);
  }, [selectedContract?.id]);

  useEffect(() => {
    if (!editorState.sections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(editorState.sections[0]?.id || '');
    }
  }, [activeSectionId, editorState.sections]);

  useEffect(() => {
    if (!previewOpen) {
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewOpen]);

  const activeSection = useMemo(
    () => editorState.sections.find((section) => section.id === activeSectionId) ?? editorState.sections[0] ?? null,
    [activeSectionId, editorState.sections],
  );

  const previewDocument = useMemo(() => {
    if (!selectedContract) {
      return null;
    }

    return buildContractTemplateDocument({
      ...selectedContract,
      managedTemplateSettings: buildManagedTemplatePayload(editorState),
    });
  }, [editorState, selectedContract]);

  const templatePayload = useMemo(() => buildManagedTemplatePayload(editorState), [editorState]);

  const sentToCustomerAt = selectedContract?.sentToCustomerAt;
  const adminSigned = Boolean(selectedContract?.eSignatureSignatories?.[1]?.eSignedAt);

  const notifyCustomerContractUpdate = (contract, { mode = 'esign', isFullySigned = false, timestamp = new Date().toISOString() } = {}) => {
    if (!contract) {
      return;
    }

    const reference = contract.auditReference || contract.orderNumber;
    const actionLabel = mode === 'esign'
      ? (isFullySigned ? 'completed the final portal signature for' : 'electronically signed')
      : 'sent';

    pushPortalNotification({
      id: `synth-contract-customer-${mode}-${contract.id}-${Date.now()}`,
      audience: 'customer',
      type: 'success',
      title: mode === 'sent' ? `${contract.title} is ready to review` : `WSI signed ${contract.title}`,
      message: mode === 'sent'
        ? `WSI Portal Services sent ${contract.title}${reference ? ` (${reference})` : ''} for your review and signature. Open Contracts to continue.`
        : `WSI Portal Services ${actionLabel} ${contract.title}${reference ? ` (${reference})` : ''}.${isFullySigned ? ' Both signatures are now on the agreement record.' : ' Open Contracts to review and add your signature.'}`,
      createdAt: timestamp,
      target: { path: '/contracts', state: { focusContractId: contract.id } },
      data: { contractId: contract.id, focusContractId: contract.id },
    });
  };

  const handleDownloadPdf = async () => {
    if (!previewDocument || !selectedContract) {
      return;
    }

    setIsDownloading(true);
    setFeedback(null);

    try {
      const fileName = `${selectedContract.title || 'agreement'}-template.pdf`;
      await portalApi.downloadContractPdf(previewDocument, fileName);
      setFeedback({ tone: 'success', text: 'Agreement PDF downloaded.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message || 'Unable to download the agreement PDF right now.' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendToCustomer = async () => {
    if (!selectedContract) {
      return;
    }

    setIsSending(true);
    setFeedback(null);

    try {
      const result = sendManagedContractToCustomer(selectedContract, templatePayload);
      setFeedback({ tone: 'success', text: result.message });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message || 'Unable to send the contract to the customer right now.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleESign = async (signerData) => {
    if (!selectedContract || !signerData || !previewDocument) {
      return;
    }

    setIsESignSubmitting(true);
    setFeedback(null);

    try {
      saveManagedContractTemplate(selectedContract, templatePayload);

      const eSignOptions = { signatoryIndex: 1 };
      const signedTemplateDocument = portalApi.buildESignedContractDocument(previewDocument, signerData, eSignOptions);
      const hasCustomerSignature = signedTemplateDocument.signatories.some((signatory, index) => index !== eSignOptions.signatoryIndex && signatory?.eSignedAt);
      const blob = await portalApi.generateESignedContractBlob(previewDocument, signerData, eSignOptions);
      const fileName = `${selectedContract.title || 'signed-agreement'}-wsi-esigned.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      await uploadAdminSignedContract(selectedContract.id, file, {
        contractKeys: [selectedContract.id, selectedContract.externalKey].filter(Boolean),
        sharedContractPatch: {
          eSignatureSignatories: signedTemplateDocument.signatories,
          eSignatureUpdatedAt: signerData.signedAt,
        },
      });

      notifyCustomerContractUpdate(selectedContract, {
        mode: 'esign',
        isFullySigned: hasCustomerSignature,
        timestamp: signerData.signedAt,
      });

      void portalApi.downloadESignedContractPdf(previewDocument, signerData, fileName, eSignOptions);

      setESignOpen(false);
      setFeedback({
        tone: 'success',
        text: 'WSI e-signature saved. The customer was notified to review and sign in Contracts.',
      });
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message || 'Unable to complete the electronic signature right now.' });
    } finally {
      setIsESignSubmitting(false);
    }
  };

  const updateSignatoryField = (index, field, value) => {
    setEditorState((current) => {
      const nextProfiles = current.signatoryProfiles.map((profile, profileIndex) => (
        profileIndex === index ? { ...profile, [field]: value } : profile
      ));

      return {
        ...current,
        signatoryProfiles: normalizeSignatoryProfiles(nextProfiles, {
          customerName: current.customerName,
          providerName: current.providerName,
        }),
      };
    });
  };

  const updateEditorField = (field, value) => {
    setEditorState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateSection = (sectionKey, patch) => {
    setEditorState((current) => ({
      ...current,
      sections: current.sections.map((section) => (
        section.id === sectionKey ? { ...section, ...patch } : section
      )),
    }));
  };

  const addSection = () => {
    const nextId = createDraftId('section');

    setEditorState((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: nextId,
          title: `New Clause ${current.sections.length + 1}`,
          bodyHtml: '',
        },
      ],
    }));
    setActiveSectionId(nextId);
    setActiveTab('terms');
  };

  const removeSection = (sectionKey) => {
    setEditorState((current) => {
      const nextSections = current.sections.filter((section) => section.id !== sectionKey);

      return {
        ...current,
        sections: nextSections.length ? nextSections : [
          {
            id: createDraftId('section'),
            title: 'New Clause 1',
            bodyHtml: '',
          },
        ],
      };
    });
  };

  const updateDocument = (documentId, patch) => {
    setEditorState((current) => ({
      ...current,
      documents: current.documents.map((document) => (
        document.id === documentId ? { ...document, ...patch } : document
      )),
    }));
  };

  const addDocument = () => {
    setEditorState((current) => ({
      ...current,
      documents: [
        ...current.documents,
        {
          id: createDraftId('document'),
          title: `Supporting Document ${current.documents.length + 1}`,
          description: '',
        },
      ],
    }));
    setActiveTab('schedules');
  };

  const removeDocument = (documentId) => {
    setEditorState((current) => ({
      ...current,
      documents: current.documents.filter((document) => document.id !== documentId),
    }));
  };

  const handleSave = async () => {
    if (!selectedContract) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      saveManagedContractTemplate(selectedContract, templatePayload);
      setFeedback({
        tone: 'success',
        text: 'Managed contract template saved. Downloads from the contracts module will now use this edited version.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to save the managed contract template right now.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedContract) {
      return;
    }

    setIsResetting(true);
    setFeedback(null);

    try {
      resetManagedContractTemplate(selectedContract);
      const resetState = buildEditorState({
        ...selectedContract,
        managedTemplateSettings: null,
        managedTemplateUpdatedAt: null,
        managedTemplateUpdatedBy: null,
      });

      setEditorState(resetState);
      setActiveSectionId(resetState.sections[0]?.id || '');
      setFeedback({
        tone: 'warning',
        text: 'Managed contract customizations were cleared. This record now uses the standard generated agreement again.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to reset the managed template right now.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const previewModal = previewOpen && previewDocument
    ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contract-live-preview-title"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="panel flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden p-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">Live Preview</p>
                <h2 id="contract-live-preview-title" className="mt-1 text-lg font-semibold text-white">Styled download output</h2>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} className="btn-secondary flex h-10 w-10 items-center justify-center p-0" aria-label="Close preview">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f2e8] p-5">
              <ContractLivePreview previewDocument={previewDocument} />
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  if (!selectedContract) {
    return (
      <div>
        <PageHeader
          eyebrow="Contracts / Editor"
          title="Contract Editor"
          description="Open the editor from Manage Contracts to work on a specific agreement record."
          action={(
            <Link to="/admin/contracts/manage" className="btn-secondary gap-2 whitespace-nowrap">
              <ArrowLeft size={16} />
              Back to Manage Contracts
            </Link>
          )}
        />

        <div className="panel p-10 text-center">
          <p className="text-lg font-semibold text-white">{isLoadingPortal ? 'Loading contract workspace...' : 'Contract record not found'}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {isLoadingPortal
              ? 'Please wait while the contract records load.'
              : 'The selected contract could not be found in the current admin contract list.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Contracts / Editor"
        belowDescription={feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackToneClasses[feedback.tone] ?? feedbackToneClasses.success}`}>
            {feedback.text}
          </div>
        ) : null}
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link to="/admin/contracts/manage" className="btn-secondary gap-2 whitespace-nowrap">
              <ArrowLeft size={16} />
              Back
            </Link>
            <button type="button" onClick={() => handleDownloadPdf()} disabled={isDownloading} className="btn-secondary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
              <Download size={16} />
              {isDownloading ? 'Downloading...' : 'Download PDF'}
            </button>
            <button type="button" onClick={() => setPreviewOpen(true)} className="btn-secondary gap-2 whitespace-nowrap">
              <Eye size={16} />
              Preview
            </button>
            <button type="button" onClick={() => setESignOpen(true)} disabled={isESignSubmitting} className="btn-secondary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
              <PenLine size={16} />
              {adminSigned ? 'Re-sign (WSI)' : 'E-Sign (WSI)'}
            </button>
            <button type="button" onClick={() => handleSendToCustomer()} disabled={isSending} className="btn-secondary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
              <Send size={16} />
              {isSending ? 'Sending...' : sentToCustomerAt ? 'Resend to Customer' : 'Send to Customer'}
            </button>
            <button type="button" onClick={() => handleReset()} disabled={isResetting} className="btn-secondary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
              <RotateCcw size={16} />
              {isResetting ? 'Resetting...' : 'Reset'}
            </button>
            <button type="button" onClick={() => handleSave()} disabled={isSaving} className="btn-primary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      />

      <div className="panel mb-6 overflow-hidden">
        <div className="manage-contracts-workspace-shell border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] p-5">
          <div className="manage-contracts-workspace-surface rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">Focused Editor Workspace</p>
              <StatusBadge status={selectedContract.status} />
              {sentToCustomerAt ? (
                <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                  Sent {formatDateTime(sentToCustomerAt)}
                </span>
              ) : null}
              {adminSigned ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  WSI signed
                </span>
              ) : null}
            </div>
            <h2 className="manage-contracts-workspace-title mt-3 text-2xl font-semibold tracking-tight text-white">{selectedContract.title}</h2>

            <div className="manage-contracts-details-table mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <tbody className="divide-y divide-white/10">
                  <tr>
                    <th className="manage-contracts-details-label w-[140px] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer</th>
                    <td className="manage-contracts-details-value px-4 py-2.5 font-medium text-white">{selectedContract.clientName || '—'}</td>
                    <th className="manage-contracts-details-label w-[140px] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Service</th>
                    <td className="manage-contracts-details-value px-4 py-2.5 font-medium text-white">{selectedContract.serviceName || '—'}</td>
                  </tr>
                  <tr>
                    <th className="manage-contracts-details-label px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Reference</th>
                    <td className="manage-contracts-details-value px-4 py-2.5 font-medium text-white">{selectedContract.auditReference || selectedContract.orderNumber || '—'}</td>
                    <th className="manage-contracts-details-label px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Updated</th>
                    <td className="manage-contracts-details-value px-4 py-2.5 font-medium text-white">{formatDateTime(selectedContract.managedTemplateUpdatedAt || selectedContract.issuedAt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          {EDITOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === tab.id ? 'bg-orange-400 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'chrome' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Badge</span>
                <input type="text" value={editorState.badge} onChange={(event) => updateEditorField('badge', event.target.value)} className="input" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Version</span>
                <input type="text" value={editorState.version} onChange={(event) => updateEditorField('version', event.target.value)} className="input" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Agreement title</span>
                <input type="text" value={editorState.title} onChange={(event) => updateEditorField('title', event.target.value)} className="input" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Subtitle</span>
                <input type="text" value={editorState.subtitle} onChange={(event) => updateEditorField('subtitle', event.target.value)} className="input" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Provider</span>
                <input type="text" value={editorState.providerName} onChange={(event) => updateEditorField('providerName', event.target.value)} className="input" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer</span>
                <input type="text" value={editorState.customerName} readOnly className="input cursor-not-allowed opacity-80" />
                <span className="mt-1 block text-xs text-slate-500">Auto-filled from the linked customer record.</span>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Service name</span>
                <input type="text" value={editorState.serviceName} onChange={(event) => updateEditorField('serviceName', event.target.value)} className="input" />
              </label>
            </div>
          ) : null}

          {activeTab === 'overview' ? (
            <RichTextEditor
              value={editorState.overviewHtml}
              onChange={(nextValue) => updateEditorField('overviewHtml', nextValue)}
              placeholder="Write the opening statement for this agreement..."
              minHeight={200}
            />
          ) : null}

          {activeTab === 'terms' ? (
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="contract-editor-clause-list max-h-[min(58vh,480px)] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                {editorState.sections.map((section, index) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${activeSection?.id === section.id ? 'border-sky-400/50 bg-sky-400/[0.08] text-white' : 'border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/[0.05]'}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Clause {index + 1}</p>
                    <p className="mt-0.5 truncate font-medium">{section.title || `Clause ${index + 1}`}</p>
                  </button>
                ))}
                <button type="button" onClick={() => addSection()} className="btn-secondary mt-1 w-full gap-2 text-sm">
                  <Plus size={14} />
                  Add clause
                </button>
              </div>

              <div className="contract-editor-clause-panel max-h-[min(58vh,480px)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                {activeSection ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <label className="block min-w-[200px] flex-1">
                        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Clause heading</span>
                        <input type="text" value={activeSection.title} onChange={(event) => updateSection(activeSection.id, { title: event.target.value })} className="input" />
                      </label>
                      <button type="button" onClick={() => removeSection(activeSection.id)} className="btn-secondary gap-2 text-rose-100">
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>
                    <RichTextEditor
                      value={activeSection.bodyHtml}
                      onChange={(nextValue) => updateSection(activeSection.id, { bodyHtml: nextValue })}
                      placeholder="Draft the legal clause body here..."
                      minHeight={220}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'schedules' ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => addDocument()} className="btn-secondary gap-2 text-sm">
                  <Plus size={16} />
                  Add document
                </button>
              </div>
              {editorState.documents.length ? editorState.documents.map((document) => (
                <div key={document.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Schedule</p>
                    <button type="button" onClick={() => removeDocument(document.id)} className="btn-secondary gap-1 px-2 py-1 text-xs text-rose-100">
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Title</span>
                      <input type="text" value={document.title} onChange={(event) => updateDocument(document.id, { title: event.target.value })} className="input" />
                    </label>
                    <label className="block md:col-span-1">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Description</span>
                      <textarea value={document.description} onChange={(event) => updateDocument(document.id, { description: event.target.value })} className="input min-h-[72px] resize-y" />
                    </label>
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">No schedules yet. Add a supporting document.</p>
              )}
            </div>
          ) : null}

          {activeTab === 'signatures' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">Customer signatory</p>
                <p className="mt-1 text-xs text-slate-400">Auto-filled from the linked customer record. Customer details can only be finalized during the customer e-sign flow.</p>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Company</span>
                    <input type="text" value={editorState.signatoryProfiles[0]?.company ?? ''} readOnly className="input cursor-not-allowed opacity-80" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Printed name</span>
                    <input type="text" value={editorState.signatoryProfiles[0]?.printedName ?? ''} readOnly className="input cursor-not-allowed opacity-80" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Title / role</span>
                    <input type="text" value={editorState.signatoryProfiles[0]?.title ?? ''} readOnly className="input cursor-not-allowed opacity-80" />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">WSI authorized representative</p>
                <p className="mt-1 text-xs text-slate-400">Use E-Sign (WSI) to capture the drawn signature on the PDF.</p>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Company</span>
                    <input type="text" value={editorState.signatoryProfiles[1]?.company ?? ''} onChange={(event) => updateSignatoryField(1, 'company', event.target.value)} className="input" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Printed name</span>
                    <input type="text" value={editorState.signatoryProfiles[1]?.printedName ?? ''} onChange={(event) => updateSignatoryField(1, 'printedName', event.target.value)} className="input" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Title / role</span>
                    <input type="text" value={editorState.signatoryProfiles[1]?.title ?? ''} onChange={(event) => updateSignatoryField(1, 'title', event.target.value)} className="input" />
                  </label>
                </div>
                <button type="button" onClick={() => setESignOpen(true)} disabled={isESignSubmitting} className="btn-primary mt-4 w-full gap-2">
                  <PenLine size={16} />
                  {adminSigned ? 'Update WSI e-signature' : 'Capture WSI e-signature'}
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === 'execution' ? (
            <RichTextEditor
              value={editorState.signatureStatementHtml}
              onChange={(nextValue) => updateEditorField('signatureStatementHtml', nextValue)}
              placeholder="Write the execution language above the signature blocks..."
              minHeight={180}
            />
          ) : null}

          {activeTab === 'notes' ? (
            <RichTextEditor
              value={editorState.noteHtml}
              onChange={(nextValue) => updateEditorField('noteHtml', nextValue)}
              placeholder="Closing notes, compliance, or retention instructions..."
              minHeight={180}
            />
          ) : null}
        </div>
      </div>

      {previewModal}

      {eSignOpen && selectedContract ? (
        <ESignatureModal
          contract={{
            ...selectedContract,
            managedTemplateSettings: templatePayload,
            eSignatureSignatories: previewDocument?.signatories ?? selectedContract.eSignatureSignatories,
          }}
          signatoryIndex={1}
          onClose={() => setESignOpen(false)}
          onSign={(signerData) => handleESign(signerData)}
        />
      ) : null}
    </div>
  );
}
