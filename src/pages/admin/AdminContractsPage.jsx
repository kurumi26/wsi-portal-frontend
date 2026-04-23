import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Download, Eye, FileSignature, LayoutGrid, List, Search, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import usePageTitle from '../../hooks/usePageTitle';
import { portalApi } from '../../services/portalApi';
import { formatDateTime } from '../../utils/format';
import { getContractVerificationStatus, hasSignedDocument, isContractVerified } from '../../utils/contracts';

const CONTRACTS_PER_PAGE = 10;
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

  const {
    adminContractRecords,
    isLoadingPortal,
    verifyContractAcceptance,
    uploadAdminSignedContract,
  } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [viewMode, setViewMode] = useState('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [workingContractId, setWorkingContractId] = useState('');
  const [uploadingContractId, setUploadingContractId] = useState('');
  const [downloadingContractId, setDownloadingContractId] = useState('');
  const [downloadingSignedContractId, setDownloadingSignedContractId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTriggerRef = useRef(null);
  const filterMenuRef = useRef(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState(null);

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

    setUploadingContractId(contractId);
    setFeedback(null);

    try {
      const result = await uploadAdminSignedContract(contractId, file);
      setFeedback({
        tone: result?.persistedLocally ? 'warning' : 'success',
        text: result?.message || 'Signed agreement uploaded successfully.',
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

  const handleDownload = async (contract) => {
    if (!contract?.downloadUrl) {
      return;
    }

    setDownloadingContractId(contract.id);
    setFeedback(null);

    try {
      await portalApi.downloadFile(contract.downloadUrl, `${contract.title || 'agreement-copy'}.pdf`);
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to download the agreement copy right now.',
      });
    } finally {
      setDownloadingContractId('');
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
    const uploadButtonClass = isTable ? tableActionButtonClass : `${gridActionButtonClass} cursor-pointer`;

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
        {contract.downloadUrl ? (
          <button
            type="button"
            onClick={() => handleDownload(contract)}
            disabled={downloadingContractId === contract.id}
            className={defaultButtonClass}
            title={downloadingContractId === contract.id ? 'Downloading agreement copy' : 'Download agreement copy'}
            aria-label={`Download agreement ${contract.title}`}
          >
            <Download size={16} />
          </button>
        ) : null}
        {!isTable ? (
          <label className={uploadButtonClass} title="Upload signed agreement" aria-label={`Upload signed agreement ${contract.title}`}>
            <Upload size={16} />
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={uploadingContractId === contract.id}
              onChange={(event) => {
                const file = event.target.files?.[0];
                void handleUpload(contract.id, file);
                event.target.value = '';
              }}
            />
          </label>
        ) : null}
        {contract.signedDocumentUrl ? (
          <button
            type="button"
            onClick={() => handleSignedDownload(contract)}
            disabled={downloadingSignedContractId === contract.id}
            className={defaultButtonClass}
            title={downloadingSignedContractId === contract.id ? 'Downloading signed copy' : 'Download signed copy'}
            aria-label={`Download signed copy ${contract.title}`}
          >
            <FileSignature size={16} />
          </button>
        ) : null}
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

              {selectedContract.downloadUrl ? (
                <button
                  type="button"
                  onClick={() => handleDownload(selectedContract)}
                  disabled={downloadingContractId === selectedContract.id}
                  className="btn-secondary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={16} />
                  {downloadingContractId === selectedContract.id ? 'Downloading...' : 'Download Agreement Copy'}
                </button>
              ) : null}

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
        title="Verify agreement acceptance and store signed copies"
        belowDescription={feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackToneClasses[feedback.tone] ?? feedbackToneClasses.success}`}>
            {feedback.text}
          </div>
        ) : null}
        action={contractsHeaderAction}
      />

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

  return (
    <>
      {content}
      {reviewModal}
    </>
  );
}
