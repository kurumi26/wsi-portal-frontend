import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Download, Eye, FileSignature, LayoutGrid, List, PenLine, Search, Upload } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import DataTable from '../../components/common/DataTable';
import ESignatureModal from '../../components/common/ESignatureModal';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import usePageTitle from '../../hooks/usePageTitle';
import { portalApi } from '../../services/portalApi';
import { formatDateTime } from '../../utils/format';
import { buildContractTemplateDocument, getContractVerificationStatus, hasSignedDocument, isContractVerified } from '../../utils/contracts';

const CONTRACTS_PER_PAGE = 5;
const filters = ['All', 'Pending Verification', 'Verified', 'Pending Review', 'Rejected', 'Missing Signed Copy'];
const viewModes = [
  { id: 'table', label: 'Table List', icon: List },
  { id: 'grid', label: 'Grid View', icon: LayoutGrid },
];

const feedbackToneClasses = {
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  warning: 'border-orange-400/20 bg-orange-400/10 text-orange-100',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
};

const standardTemplateDownloadMessage = 'Downloaded a ready-to-sign agreement PDF. Have both parties sign it, then upload the signed agreement to the portal.';
const fallbackTemplateDownloadMessage = 'The stored agreement copy was unavailable, so the portal downloaded a ready-to-sign PDF instead. Have both parties sign it, then upload the signed agreement to the portal.';
const signingWorkflowSteps = [
  {
    id: 'download',
    title: 'Download Signable PDF',
    description: 'Use the stored agreement copy when available. If not, the portal generates a ready-to-sign PDF for this record.',
    icon: Download,
  },
  {
    id: 'sign',
    title: 'Collect Both Signatures',
    description: 'Have the customer and the WSI representative sign the same copy so the audit trail stays aligned.',
    icon: FileSignature,
  },
  {
    id: 'upload',
    title: 'Upload and Verify',
    description: 'Upload the executed file here, then verify acceptance once the signed agreement is attached.',
    icon: Upload,
  },
];

const GENERAL_TEMPLATE_CONTRACT = {
  id: 'general-contract-template',
  title: 'General Contract Signing Template',
  serviceName: 'WSI Portal Services',
  clientName: 'Customer',
  providerName: 'WSI Portal Services',
  auditReference: 'GENERAL-CONTRACT',
  version: 'v1.0',
  scope: 'order',
};

const getQuickActionContractLabel = (contract) => {
  const title = contract?.title || contract?.serviceName || 'Agreement record';
  const reference = contract?.auditReference || contract?.orderNumber || contract?.id;

  if (!reference) {
    return title;
  }

  return `${title} - ${reference}`;
};

const matchesFilter = (contract, filter) => {
  const verificationStatus = getContractVerificationStatus(contract);
  const verified = isContractVerified(contract);
  const missingSignedCopy = contract.requiresSignedDocument && !hasSignedDocument(contract);

  if (filter === 'All') {
    return true;
  }

  if (filter === 'Pending Verification') {
    return contract.status === 'Accepted' && !verified;
  }

  if (filter === 'Verified') {
    return verified;
  }

  if (filter === 'Missing Signed Copy') {
    return missingSignedCopy;
  }

  if (filter === 'Pending Review' || filter === 'Rejected') {
    return contract.status === filter;
  }

  return verificationStatus === filter;
};

const buildAuditItems = (contract) => {
  const items = [
    {
      id: 'issued',
      label: 'Contract Issued',
      value: formatDateTime(contract.issuedAt),
      helper: contract.auditReference || 'Audit reference pending',
    },
  ];

  if (contract.decisionAt) {
    items.push({
      id: 'decision',
      label: contract.status === 'Rejected' ? 'Customer Rejected' : 'Customer Accepted',
      value: formatDateTime(contract.decisionAt),
      helper: contract.decisionBy || 'Customer action recorded',
    });
  }

  if (contract.verifiedAt) {
    items.push({
      id: 'verified',
      label: 'Admin Verified',
      value: formatDateTime(contract.verifiedAt),
      helper: contract.verifiedBy || 'Admin record saved',
    });
  }

  if (hasSignedDocument(contract) && contract.signedDocumentUploadedAt) {
    items.push({
      id: 'signed-document',
      label: 'Signed Agreement Uploaded',
      value: formatDateTime(contract.signedDocumentUploadedAt),
      helper: contract.signedDocumentName || 'Signed copy attached',
    });
  }

  return items;
};

const buildRecordRows = (contract) => [
  {
    id: 'client',
    label: 'Client',
    value: contract.clientName || 'Client not linked yet',
    helper: contract.clientId ? `Customer ID ${contract.clientId}` : 'No linked client id',
  },
  {
    id: 'service',
    label: 'Service',
    value: contract.serviceName || 'Agreement record',
    helper: contract.scope === 'service' ? 'Service record' : 'Agreement record',
  },
  {
    id: 'reference',
    label: 'Order / Reference',
    value: contract.orderNumber || contract.auditReference || '—',
    helper: `Version ${contract.version || 'v1.0'}`,
  },
  {
    id: 'decision',
    label: 'Customer Decision',
    value: formatDateTime(contract.decisionAt || contract.acceptedAt || contract.rejectedAt),
    helper: contract.decisionBy || 'No decision actor recorded',
  },
  {
    id: 'verification',
    label: 'Verification',
    value: formatDateTime(contract.verifiedAt),
    helper: contract.verifiedBy || 'Not verified yet',
  },
  {
    id: 'signed',
    label: 'Signed Agreement',
    value: hasSignedDocument(contract) ? (contract.signedDocumentName || 'Signed copy uploaded') : 'Not uploaded yet',
    helper: contract.signedDocumentUploadedAt
      ? formatDateTime(contract.signedDocumentUploadedAt)
      : contract.signedDocumentUrl
        ? 'Signed file available to download'
        : contract.requiresSignedDocument
          ? 'Finance may still request a signed copy'
          : 'Optional support file',
  },
];

const buildDocumentRows = (contract) => contract.documentSections.map((section) => ({
  id: section.id,
  title: section.title,
  description: section.description || 'Included in this agreement bundle.',
}));

const getAdminContractRecordedAt = (contract) => (
  contract.decisionAt || contract.acceptedAt || contract.rejectedAt || contract.issuedAt
);

const buildAdminGridRows = (contract) => [
  {
    id: 'client',
    label: 'Client',
    value: contract.clientName || 'Client not linked',
    helper: contract.clientId ? `Customer ID ${contract.clientId}` : contract.auditReference || 'Audit reference pending',
  },
  {
    id: 'reference',
    label: 'Reference',
    value: contract.orderNumber || contract.auditReference || '—',
    helper: `Version ${contract.version || 'v1.0'}`,
  },
  {
    id: 'recorded',
    label: 'Recorded',
    value: formatDateTime(getAdminContractRecordedAt(contract)),
    helper: contract.decisionBy || 'Customer action recorded',
  },
  {
    id: 'signed',
    label: 'Signed Copy',
    value: hasSignedDocument(contract) ? (contract.signedDocumentName || 'Signed copy uploaded') : 'Not uploaded yet',
    helper: contract.signedDocumentUploadedAt
      ? formatDateTime(contract.signedDocumentUploadedAt)
      : contract.signedDocumentUrl
        ? 'Signed file available to download'
        : contract.requiresSignedDocument
          ? 'Required by Finance when flagged'
          : 'Optional support file',
  },
];

export default function AdminContractsPage() {
  usePageTitle('Admin Contracts & Agreements');
  const location = useLocation();

  const {
    adminContractRecords,
    isLoadingPortal,
    verifyContractAcceptance,
    uploadAdminSignedContract,
    pushPortalNotification,
  } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [viewMode, setViewMode] = useState('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContractId, setSelectedContractId] = useState(location.state?.focusContractId ?? '');
  const [quickActionContractId, setQuickActionContractId] = useState(location.state?.focusContractId ?? '');
  const [eSignContractId, setESignContractId] = useState(null);
  const [isESignSubmitting, setIsESignSubmitting] = useState(false);
  const [workingContractId, setWorkingContractId] = useState('');
  const [uploadingContractId, setUploadingContractId] = useState('');
  const [downloadingContractId, setDownloadingContractId] = useState('');
  const [downloadingSignedContractId, setDownloadingSignedContractId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTriggerRef = useRef(null);
  const filterMenuRef = useRef(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState(null);

  const notifyCustomerContractUpdate = (contract, { mode = 'upload', isFullySigned = false, timestamp = new Date().toISOString() } = {}) => {
    if (!contract) {
      return;
    }

    const actorLabel = 'WSI Portal Services';
    const reference = contract.auditReference || contract.orderNumber;
    const actionLabel = mode === 'esign'
      ? (isFullySigned ? 'completed the final portal signature for' : 'electronically signed')
      : 'uploaded a signed copy for';

    pushPortalNotification({
      id: `synth-contract-customer-${mode}-${contract.id}-${Date.now()}`,
      audience: 'customer',
      type: 'success',
      title: mode === 'esign' ? `WSI signed ${contract.title}` : `WSI uploaded ${contract.title}`,
      message: `${actorLabel} ${actionLabel} ${contract.title}${reference ? ` (${reference})` : ''}.${isFullySigned ? ' The agreement now shows both party signatures in the portal.' : ' Open Contracts to review the updated agreement record.'}`,
      createdAt: timestamp,
      target: {
        path: '/contracts',
        state: { focusContractId: contract.id },
      },
      data: {
        contractId: contract.id,
        focusContractId: contract.id,
      },
    });
  };

  useEffect(() => {
    const onDocClick = (ev) => {
      const clickedInsideTrigger = filterTriggerRef.current && filterTriggerRef.current.contains(ev.target);
      const clickedInsideMenu = filterMenuRef.current && filterMenuRef.current.contains(ev.target);

      if (!clickedInsideTrigger && !clickedInsideMenu) {
        setFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useLayoutEffect(() => {
    if (!filterOpen || !filterTriggerRef.current) {
      setFilterMenuStyle(null);
      return;
    }

    const button = filterTriggerRef.current.querySelector('button');

    if (!button) {
      setFilterMenuStyle(null);
      return;
    }

    const menuWidth = 240;
    const updateMenuPosition = () => {
      const rect = button.getBoundingClientRect();
      setFilterMenuStyle({
        position: 'absolute',
        left: `${Math.max(8, rect.right - menuWidth + window.scrollX)}px`,
        top: `${rect.bottom + 8 + window.scrollY}px`,
        width: `${menuWidth}px`,
        zIndex: 9999,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [filterOpen]);

  const filteredContracts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return adminContractRecords.filter((contract) => {
      const matchesCurrentFilter = matchesFilter(contract, activeFilter);

      if (!matchesCurrentFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        contract.clientName,
        contract.serviceName,
        contract.title,
        contract.orderNumber,
        contract.auditReference,
        contract.status,
        getContractVerificationStatus(contract),
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [activeFilter, adminContractRecords, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / CONTRACTS_PER_PAGE));
  const paginatedContracts = useMemo(
    () => filteredContracts.slice((currentPage - 1) * CONTRACTS_PER_PAGE, currentPage * CONTRACTS_PER_PAGE),
    [currentPage, filteredContracts],
  );

  useEffect(() => {
    if (!adminContractRecords.length) {
      if (quickActionContractId) {
        setQuickActionContractId('');
      }

      return;
    }

    const currentExists = adminContractRecords.some((contract) => contract.id === quickActionContractId);

    if (currentExists) {
      return;
    }

    const preferredContractId = selectedContractId || adminContractRecords[0]?.id || '';

    if (preferredContractId && preferredContractId !== quickActionContractId) {
      setQuickActionContractId(preferredContractId);
    }
  }, [adminContractRecords, quickActionContractId, selectedContractId]);

  const quickActionContract = useMemo(
    () => adminContractRecords.find((contract) => contract.id === quickActionContractId) ?? null,
    [adminContractRecords, quickActionContractId],
  );
  const quickActionTemplateId = quickActionContract?.id || GENERAL_TEMPLATE_CONTRACT.id;
  const isQuickActionDownloading = downloadingContractId === quickActionTemplateId;
  const isQuickActionUploading = Boolean(quickActionContract) && uploadingContractId === quickActionContract.id;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, viewMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!paginatedContracts.length) {
      setSelectedContractId('');
      return;
    }

    if (!selectedContractId) {
      return;
    }

    const stillVisible = filteredContracts.some((contract) => contract.id === selectedContractId);

    if (!stillVisible) {
      setSelectedContractId('');
    }
  }, [filteredContracts, paginatedContracts.length, selectedContractId]);

  const selectedContract = useMemo(
    () => filteredContracts.find((contract) => contract.id === selectedContractId) ?? null,
    [filteredContracts, selectedContractId],
  );

  const handleReviewContract = (contractId) => {
    if (!contractId) {
      return;
    }

    setSelectedContractId(contractId);
  };

  useEffect(() => {
    if (!selectedContract) {
      document.body.style.overflow = '';
      return undefined;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedContract]);

  useEffect(() => {
    if (!selectedContract) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedContractId('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedContract]);

  const stats = useMemo(() => {
    const pendingVerification = adminContractRecords.filter((contract) => contract.status === 'Accepted' && !isContractVerified(contract)).length;
    const verified = adminContractRecords.filter((contract) => isContractVerified(contract)).length;
    const signedCopies = adminContractRecords.filter((contract) => hasSignedDocument(contract)).length;
    const missingSignedCopies = adminContractRecords.filter((contract) => contract.requiresSignedDocument && !hasSignedDocument(contract)).length;

    return {
      total: adminContractRecords.length,
      pendingVerification,
      verified,
      signedCopies,
      missingSignedCopies,
    };
  }, [adminContractRecords]);

  const handleVerify = async (contractId) => {
    setWorkingContractId(contractId);
    setFeedback(null);

    try {
      const result = await verifyContractAcceptance(contractId);
      setFeedback({
        tone: result?.persistedLocally ? 'warning' : 'success',
        text: result?.message || 'Agreement acceptance verified successfully.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to verify the agreement right now.',
      });
    } finally {
      setWorkingContractId('');
    }
  };

  const handleUpload = async (contractId, file) => {
    if (!file) {
      return;
    }

    const contract = adminContractRecords.find((item) => item.id === contractId) ?? null;

    setUploadingContractId(contractId);
    setFeedback(null);

    try {
      const result = await uploadAdminSignedContract(contractId, file);
      notifyCustomerContractUpdate(contract, { mode: 'upload' });
      setFeedback({
        tone: result?.persistedLocally ? 'warning' : 'success',
        text: result?.message || 'Signed agreement uploaded successfully. The customer has been notified in Notifications.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to upload the signed agreement right now.',
      });
    } finally {
      setUploadingContractId('');
    }
  };

  const downloadAgreementCopy = async (contract, options = {}) => {
    if (!contract) {
      return;
    }

    const {
      allowRemoteDownload = true,
      fileName: overrideFileName,
    } = options;
    const fileName = overrideFileName || `${contract.title || 'agreement-copy'}.pdf`;
    const downloadStandardTemplate = () => portalApi.downloadContractPdf(buildContractTemplateDocument(contract), fileName);

    setDownloadingContractId(contract.id);
    setFeedback(null);

    try {
      if (allowRemoteDownload && contract.downloadUrl) {
        try {
          await portalApi.downloadFile(contract.downloadUrl, fileName);
          return;
        } catch {
          await downloadStandardTemplate();
          setFeedback({
            tone: 'warning',
            text: fallbackTemplateDownloadMessage,
          });
          return;
        }
      }

      await downloadStandardTemplate();
      setFeedback({
        tone: 'success',
        text: standardTemplateDownloadMessage,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to download the agreement copy right now.',
      });
    } finally {
      setDownloadingContractId('');
    }
  };

  const handleDownload = async (contract) => {
    await downloadAgreementCopy(contract);
  };

  const handleQuickTemplateDownload = async () => {
    const templateContract = quickActionContract || GENERAL_TEMPLATE_CONTRACT;
    const fileName = quickActionContract
      ? `${quickActionContract.title || 'agreement-copy'}-signing-template.pdf`
      : 'general-contract-signing-template.pdf';

    setDownloadingContractId(templateContract.id);
    setFeedback(null);

    try {
      await portalApi.downloadContractPdf(buildContractTemplateDocument(templateContract), fileName);
      setFeedback({
        tone: 'success',
        text: standardTemplateDownloadMessage,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to download the signing template right now.',
      });
    } finally {
      setDownloadingContractId('');
    }
  };

  const handleESign = async (contract, signerData) => {
    if (!contract || !signerData) {
      return;
    }

    setIsESignSubmitting(true);
    setFeedback(null);

    try {
      const templateDocument = buildContractTemplateDocument(contract);
      // Admin signs the second block (WSI Authorized Representative, index 1)
      const eSignOptions = { signatoryIndex: 1 };
      const signedTemplateDocument = portalApi.buildESignedContractDocument(templateDocument, signerData, eSignOptions);
      const hasCustomerSignature = signedTemplateDocument.signatories.some((signatory, index) => index !== eSignOptions.signatoryIndex && signatory?.eSignedAt);
      const blob = await portalApi.generateESignedContractBlob(templateDocument, signerData, eSignOptions);
      const fileName = `${contract.title || 'signed-agreement'}-esigned.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const result = await uploadAdminSignedContract(contract.id, file, {
        contractKeys: [contract.id, contract.externalKey].filter(Boolean),
        sharedContractPatch: {
          eSignatureSignatories: signedTemplateDocument.signatories,
          eSignatureUpdatedAt: signerData.signedAt,
        },
      });

      notifyCustomerContractUpdate(contract, {
        mode: 'esign',
        isFullySigned: hasCustomerSignature,
        timestamp: signerData.signedAt,
      });

      void portalApi.downloadESignedContractPdf(templateDocument, signerData, fileName, eSignOptions);

      setESignContractId(null);
      setFeedback({
        tone: result?.persistedLocally ? 'warning' : 'success',
        text: result?.message || 'Contract signed electronically. The signed PDF has been attached to the record and the customer has been notified.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to complete the electronic signature right now.',
      });
    } finally {
      setIsESignSubmitting(false);
    }
  };

  const handleSignedDownload = async (contract) => {
    if (!contract?.signedDocumentUrl) {
      return;
    }

    setDownloadingSignedContractId(contract.id);
    setFeedback(null);

    try {
      await portalApi.downloadFile(
        contract.signedDocumentUrl,
        contract.signedDocumentName || `${contract.title || 'signed-copy'}.pdf`,
        { renderTextAsPdf: false },
      );
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to download the signed copy right now.',
      });
    } finally {
      setDownloadingSignedContractId('');
    }
  };

  const tableActionButtonClass = 'btn-secondary flex h-10 w-10 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60';
  const successActionButtonClass = 'flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/15 p-0 text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60';
  const successButtonClass = 'flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60';
  const gridActionButtonClass = 'btn-secondary flex h-11 w-11 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60';
  const successGridActionButtonClass = 'flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/15 p-0 text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60';

  const renderContractActions = (contract, layout = 'table') => {
    const canVerify = contract.status === 'Accepted' && !isContractVerified(contract);
    const isTable = layout === 'table';
    const defaultButtonClass = isTable ? tableActionButtonClass : gridActionButtonClass;
    const verifyButtonClass = isTable ? successActionButtonClass : successGridActionButtonClass;

    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleReviewContract(contract.id)}
          className={defaultButtonClass}
          title="Review agreement"
          aria-label={`Review agreement ${contract.title}`}
        >
          <Eye size={16} />
        </button>
        <button
          type="button"
          onClick={() => handleVerify(contract.id)}
          disabled={!canVerify || workingContractId === contract.id}
          className={verifyButtonClass}
          title={canVerify ? 'Verify acceptance' : 'Verification unavailable'}
          aria-label={`Verify agreement ${contract.title}`}
        >
          <Check size={16} strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={() => handleDownload(contract)}
          disabled={downloadingContractId === contract.id}
          className={defaultButtonClass}
          title={downloadingContractId === contract.id ? 'Downloading signable agreement PDF' : 'Download signable agreement PDF'}
          aria-label={`Download signable agreement PDF ${contract.title}`}
        >
          <Download size={16} />
        </button>
        <button
          type="button"
          onClick={() => setESignContractId(contract.id)}
          disabled={isESignSubmitting && eSignContractId === contract.id}
          className={defaultButtonClass}
          title="Sign electronically"
          aria-label={`Sign contract electronically ${contract.title}`}
        >
          <PenLine size={16} />
        </button>
      </div>
    );
  };

  const columns = [
    {
      key: 'clientName',
      label: 'Client',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value || 'Client not linked'}</p>
          <p className="mt-1 text-xs text-slate-400">{row.auditReference || 'Audit reference pending'}</p>
        </div>
      ),
    },
    {
      key: 'serviceName',
      label: 'Agreement',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value || row.title}</p>
          <p className="mt-1 text-xs text-slate-400">{row.title}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Customer Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'verification',
      label: 'Admin Verification',
      sortable: true,
      sortValue: (row) => getContractVerificationStatus(row),
      render: (_, row) => <StatusBadge status={getContractVerificationStatus(row)} />,
    },
    {
      key: 'signedDocumentName',
      label: 'Signed Copy',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{hasSignedDocument(row) ? (value || 'Signed copy uploaded') : 'Not uploaded yet'}</p>
          <p className="mt-1 text-xs text-slate-400">
            {row.signedDocumentUploadedAt
              ? formatDateTime(row.signedDocumentUploadedAt)
              : row.signedDocumentUrl
                ? 'Signed file available to download'
                : row.requiresSignedDocument
                  ? 'Required by Finance when flagged'
                  : 'Optional support file'}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => renderContractActions(row, 'table'),
    },
  ];

  const summaryCards = [
    {
      label: 'All Agreements',
      value: stats.total,
      helper: 'Customer contracts and service-linked records',
      accent: 'cyan',
      filter: 'All',
    },
    {
      label: 'Pending Verification',
      value: stats.pendingVerification,
      helper: 'Accepted by client and waiting for admin review',
      accent: 'amber',
      filter: 'Pending Verification',
    },
    {
      label: 'Verified',
      value: stats.verified,
      helper: 'Acceptance confirmed for compliance',
      accent: 'emerald',
      filter: 'Verified',
    },
    {
      label: 'Signed Agreements',
      value: stats.signedCopies,
      helper: stats.missingSignedCopies ? `${stats.missingSignedCopies} still missing where required` : 'Signed files stored for audit',
      accent: 'violet',
      filter: 'Missing Signed Copy',
    },
  ];

  const contractsHeaderAction = (
    <div className="flex w-full justify-end">
      <div className="flex max-w-full flex-col items-stretch gap-3 lg:items-end">

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-full sm:w-[320px] xl:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search client, service, order number, or audit reference"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-slate-200 outline-none"
            />
          </div>

          <div className="flex items-center" ref={filterTriggerRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              aria-label="Contract filter"
            >
              <span className="max-w-[14rem] truncate text-sm text-slate-200">{activeFilter}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {filterOpen && filterMenuStyle
              ? createPortal(
                  <div ref={filterMenuRef} style={filterMenuStyle} className="rounded-lg border border-white/6 bg-slate-900 shadow">
                    {filters.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setActiveFilter(filter);
                          setFilterOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5 ${activeFilter === filter ? 'bg-white/5' : ''}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )
              : null}
          </div>

          {viewMode === 'table' ? <div id="admin-contracts-column-visibility-slot" className="shrink-0" /> : null}

          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-1">
            {viewModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${viewMode === mode.id ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                aria-label={mode.label}
                title={mode.label}
              >
                <mode.icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const reviewModal = selectedContract
    ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-contract-review-modal-title"
          onClick={() => setSelectedContractId('')}
        >
          <div
            className="panel flex max-h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden p-0"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300/80">Compliance Record</p>
                <h2 id="admin-contract-review-modal-title" className="mt-2 text-2xl font-semibold text-white">
                  {selectedContract.title}
                </h2>
                <p className="mt-2 text-sm text-slate-300">{selectedContract.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedContract.status} />
                <StatusBadge status={getContractVerificationStatus(selectedContract)} />
                <button type="button" onClick={() => setSelectedContractId('')} className="btn-secondary px-4">
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6 pr-1">
                {feedback ? (
                  <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackToneClasses[feedback.tone] ?? feedbackToneClasses.success}`}>
                    {feedback.text}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-sky-400/20 bg-sky-400/[0.08] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-xs uppercase tracking-[0.18em] text-sky-100/75">Signing Flow</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Download a ready-to-sign agreement in one step</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-300">
                        If a stored agreement copy is not available, the portal will generate a designed PDF with signature blocks for both parties.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownload(selectedContract)}
                      disabled={downloadingContractId === selectedContract.id}
                      className="btn-primary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download size={16} />
                      {downloadingContractId === selectedContract.id ? 'Downloading...' : 'Download Signable Agreement PDF'}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {signingWorkflowSteps.map(({ id, title, description, icon: Icon }, index) => (
                      <div key={id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                            <Icon size={18} />
                          </span>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-100/70">Step {index + 1}</p>
                            <p className="text-sm font-semibold text-white">{title}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <tbody className="divide-y divide-white/6">
                      {buildRecordRows(selectedContract).map((row) => (
                        <tr key={`${selectedContract.id}-${row.id}`}>
                          <th className="w-[240px] px-4 py-4 align-top text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                            {row.label}
                          </th>
                          <td className="px-4 py-4 text-slate-200">
                            <p className="font-medium text-white">{row.value}</p>
                            <p className="mt-1 text-xs text-slate-500">{row.helper}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Included Documents</p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-medium">Document</th>
                          <th className="px-4 py-3 font-medium">Purpose</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {buildDocumentRows(selectedContract).map((row) => (
                          <tr key={`${selectedContract.id}-${row.id}`}>
                            <td className="px-4 py-4 text-sm font-medium text-white">{row.title}</td>
                            <td className="px-4 py-4 text-sm leading-6 text-slate-400">{row.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Audit Timeline</p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-medium">Event</th>
                          <th className="px-4 py-3 font-medium">Recorded At</th>
                          <th className="px-4 py-3 font-medium">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {buildAuditItems(selectedContract).map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-4 text-sm font-medium text-white">{item.label}</td>
                            <td className="px-4 py-4 text-sm text-slate-200">{item.value}</td>
                            <td className="px-4 py-4 text-sm text-slate-400">{item.helper}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-white/10 px-6 py-5">
              <button
                type="button"
                disabled={selectedContract.status !== 'Accepted' || isContractVerified(selectedContract) || workingContractId === selectedContract.id}
                onClick={() => handleVerify(selectedContract.id)}
                className={successButtonClass}
              >
                <Check size={16} strokeWidth={3} />
                {workingContractId === selectedContract.id ? 'Verifying...' : 'Verify Acceptance'}
              </button>

              <button
                type="button"
                onClick={() => handleDownload(selectedContract)}
                disabled={downloadingContractId === selectedContract.id}
                className="btn-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} />
                {downloadingContractId === selectedContract.id ? 'Downloading...' : 'Download Signable Agreement PDF'}
              </button>

              <label className="btn-secondary flex cursor-pointer items-center justify-center gap-2">
                <Upload size={16} />
                {uploadingContractId === selectedContract.id ? 'Uploading...' : 'Upload Signed Agreement'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={uploadingContractId === selectedContract.id}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void handleUpload(selectedContract.id, file);
                    event.target.value = '';
                  }}
                />
              </label>

              {selectedContract.signedDocumentUrl ? (
                <button
                  type="button"
                  onClick={() => handleSignedDownload(selectedContract)}
                  disabled={downloadingSignedContractId === selectedContract.id}
                  className="btn-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileSignature size={16} />
                  {downloadingSignedContractId === selectedContract.id ? 'Downloading Signed Copy...' : 'Download Uploaded Signed Copy'}
                </button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const content = (
    <div>
      <PageHeader
        eyebrow="Contracts / Agreements"
        title="Verify Agreement and Store Signed Copies"
        belowDescription={feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackToneClasses[feedback.tone] ?? feedbackToneClasses.success}`}>
            {feedback.text}
          </div>
        ) : null}
        action={contractsHeaderAction}
      />

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">Signing Template</p>
            <h2 className="mt-1 text-base font-semibold text-white">Download the formal contract template, then upload the signed agreement.</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              The template uses the selected contract details and includes formal signature blocks for both the client and WSI.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[42rem] lg:items-end">
            <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-end">
              <div className="min-w-0 md:w-[20rem]">
                <label htmlFor="admin-quick-contract-target" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  Store Signed Copy On
                </label>
                <select
                  id="admin-quick-contract-target"
                  value={quickActionContractId}
                  onChange={(event) => setQuickActionContractId(event.target.value)}
                  disabled={!adminContractRecords.length}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adminContractRecords.length ? adminContractRecords.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {getQuickActionContractLabel(contract)}
                    </option>
                  )) : (
                    <option value="">No contract records available</option>
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleQuickTemplateDownload()}
                disabled={isQuickActionDownloading}
                className="btn-primary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} />
                {isQuickActionDownloading ? 'Downloading...' : 'Download Signing'}
              </button>

              <button
                type="button"
                disabled={!quickActionContract || isESignSubmitting}
                onClick={() => quickActionContract && setESignContractId(quickActionContract.id)}
                className="btn-secondary gap-2 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PenLine size={16} />
                Sign Electronically
              </button>

              <label className={`btn-secondary gap-2 whitespace-nowrap ${quickActionContract ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                <Upload size={16} />
                {isQuickActionUploading ? 'Uploading...' : 'Upload Signed Agreement'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={!quickActionContract || isQuickActionUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (quickActionContract) {
                      void handleUpload(quickActionContract.id, file);
                    }

                    event.target.value = '';
                  }}
                />
              </label>
            </div>

            <p className="text-xs leading-5 text-slate-400 lg:text-right">
              {quickActionContract
                ? `Signed uploads will attach to ${getQuickActionContractLabel(quickActionContract)} and notify the customer.`
                : 'Template download is available now. Upload unlocks once a contract record is available.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            accent={card.accent}
            onClick={() => setActiveFilter(card.filter)}
            isActive={activeFilter === card.filter}
          />
        ))}
      </div>

      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          rows={paginatedContracts}
          emptyMessage={isLoadingPortal ? 'Loading contract records...' : 'No contracts match the current search and filter.'}
          enableAdminColumnVisibility
          columnVisibilityStorageKey="admin-contracts-table"
          compactColumnKeys={['clientName', 'serviceName', 'status', 'verification', 'actions']}
          columnVisibilityPortalTargetId="admin-contracts-column-visibility-slot"
        />
      ) : paginatedContracts.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {paginatedContracts.map((contract) => {
            const documents = buildDocumentRows(contract);

            return (
              <div key={contract.id} className="panel p-5">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{contract.scope === 'service' ? 'Service Record' : 'Agreement Record'}</p>
                        {contract.requiresSignedDocument ? (
                          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-orange-200">
                            Signed copy may be required
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-white">{contract.serviceName || contract.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{contract.title}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={contract.status} />
                      <StatusBadge status={getContractVerificationStatus(contract)} />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                        <tbody className="divide-y divide-white/6">
                          {buildAdminGridRows(contract).map((row) => (
                            <tr key={`${contract.id}-${row.id}`}>
                              <th className="w-[210px] px-4 py-4 align-top text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                {row.label}
                              </th>
                              <td className="px-4 py-4 text-slate-200">
                                <p className="font-medium text-white">{row.value}</p>
                                <p className="mt-1 text-xs text-slate-500">{row.helper}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-white/10 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Included Documents</p>
                        <p className="text-xs text-slate-500">{documents.length} included documents</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {documents.map((row) => (
                          <span key={`${contract.id}-${row.id}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                            {row.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-white/10 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200">
                          <FileSignature size={16} />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Contract Actions</p>
                          <p className="mt-1 text-xs text-slate-500">Quick icon actions for this compliance record.</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        {renderContractActions(contract, 'grid')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel p-8 text-center">
          <p className="text-lg font-semibold text-white">No contract records found</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {isLoadingPortal
              ? 'Loading contract records...'
              : 'No contracts match the current search and filter.'}
          </p>
        </div>
      )}
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );

  const eSignTargetContract = eSignContractId
    ? (adminContractRecords.find((c) => c.id === eSignContractId) ?? null)
    : null;

  return (
    <>
      {eSignTargetContract && (
        <ESignatureModal
          contract={eSignTargetContract}
          signatoryIndex={1}
          onClose={() => setESignContractId(null)}
          onSign={(signerData) => handleESign(eSignTargetContract, signerData)}
        />
      )}
      {content}
      {reviewModal}
    </>
  );
}
