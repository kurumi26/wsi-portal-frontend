import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronDown, Download, FileSignature, LayoutGrid, List, Search, Upload, XCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import usePageTitle from '../../hooks/usePageTitle';
import { portalApi } from '../../services/portalApi';
import { formatDateTime } from '../../utils/format';
import { hasSignedDocument } from '../../utils/contracts';

const filters = ['All', 'Pending Review', 'Accepted', 'Rejected'];
const CONTRACTS_PER_PAGE = 10;
const viewModes = [
  { id: 'table', label: 'Table List', icon: List },
  { id: 'grid', label: 'Grid View', icon: LayoutGrid },
];

const feedbackToneClasses = {
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  warning: 'border-orange-400/20 bg-orange-400/10 text-orange-100',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
};

const getContractScopeLabel = (contract) => {
  if (contract.scope === 'checkout') {
    return 'Checkout Review';
  }

  if (contract.scope === 'service') {
    return 'Service Record';
  }

  return 'Order Agreement';
};

const getContractRecordedAt = (contract) => (
  contract.decisionAt || contract.acceptedAt || contract.rejectedAt || contract.issuedAt
);

const buildContractDetailRows = (contract) => [
  {
    id: 'scope',
    label: 'Service / Scope',
    value: contract.serviceName || 'Agreement pack',
    helper: getContractScopeLabel(contract),
  },
  {
    id: 'reference',
    label: 'Reference',
    value: contract.auditReference || '—',
    helper: `Version ${contract.version || 'v1.0'}`,
  },
  {
    id: 'recorded',
    label: 'Recorded Decision',
    value: formatDateTime(getContractRecordedAt(contract)),
    helper: `By ${contract.decisionBy || 'Customer'}`,
  },
  {
    id: 'signed-copy',
    label: 'Signed Copy',
    value: hasSignedDocument(contract) ? (contract.signedDocumentName || 'Signed copy uploaded') : 'Not uploaded yet',
    helper: contract.signedDocumentUploadedAt
      ? formatDateTime(contract.signedDocumentUploadedAt)
      : contract.signedDocumentUrl
        ? 'Signed file available to download'
        : contract.requiresSignedDocument
          ? 'Finance may still request one'
          : 'Optional support file',
  },
];

const buildDocumentRows = (contract) => contract.documentSections.map((section) => ({
  id: section.id,
  title: section.title,
  description: section.description || 'Included in this agreement bundle.',
}));

export default function ContractsPage() {
  usePageTitle('Contracts & Agreements');

  const location = useLocation();
  const navigate = useNavigate();
  const {
    contractRecords,
    checkoutAgreementRecord,
    contractStats,
    isLoadingPortal,
    recordContractDecision,
    uploadSignedContract,
  } = usePortal();
  const [statusFilter, setStatusFilter] = useState(location.state?.statusFilter ?? 'All');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [workingContractId, setWorkingContractId] = useState('');
  const [uploadingContractId, setUploadingContractId] = useState('');
  const [downloadingContractId, setDownloadingContractId] = useState('');
  const [downloadingSignedContractId, setDownloadingSignedContractId] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTriggerRef = useRef(null);
  const filterMenuRef = useRef(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState(null);

  const returnToCheckout = location.state?.returnTo === '/checkout';

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

    const menuWidth = 220;
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

  const allContracts = useMemo(() => {
    const historyContracts = Array.isArray(contractRecords) ? contractRecords : [];

    if (!checkoutAgreementRecord) {
      return historyContracts;
    }

    return [checkoutAgreementRecord, ...historyContracts.filter((contract) => contract.id !== checkoutAgreementRecord.id)];
  }, [checkoutAgreementRecord, contractRecords]);

  const visibleContracts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allContracts.filter((contract) => {
      if (statusFilter !== 'All' && contract.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        contract.title,
        contract.serviceName,
        contract.description,
        contract.auditReference,
        contract.status,
        contract.decisionBy,
        contract.signedDocumentName,
        ...buildDocumentRows(contract).map((row) => row.title),
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [allContracts, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleContracts.length / CONTRACTS_PER_PAGE));
  const paginatedContracts = useMemo(
    () => visibleContracts.slice((currentPage - 1) * CONTRACTS_PER_PAGE, currentPage * CONTRACTS_PER_PAGE),
    [currentPage, visibleContracts],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, viewMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const summaryCards = [
    {
      label: 'All Agreements',
      value: contractStats.total,
      helper: 'Checkout pack plus recorded contracts',
      accent: 'cyan',
      filter: 'All',
    },
    {
      label: 'Pending Review',
      value: contractStats.pending,
      helper: 'Waiting for customer decision',
      accent: 'amber',
      filter: 'Pending Review',
    },
    {
      label: 'Accepted',
      value: contractStats.accepted,
      helper: 'Recorded for compliance and audit',
      accent: 'emerald',
      filter: 'Accepted',
    },
    {
      label: 'Signed Copies',
      value: contractStats.signedDocuments,
      helper: 'Uploaded documents received',
      accent: 'violet',
      filter: 'All',
    },
  ];

  const handleDecision = async (contractId, decision) => {
    setWorkingContractId(contractId);
    setFeedback(null);

    try {
      const result = await recordContractDecision(contractId, decision);
      const accepted = decision === 'accept';

      setFeedback({
        tone: result?.persistedLocally ? 'warning' : 'success',
        text: result?.message || `Agreement ${accepted ? 'accepted' : 'rejected'} successfully.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to update the agreement right now.',
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
      const result = await uploadSignedContract(contractId, file);
      setFeedback({
        tone: result?.persistedLocally ? 'warning' : 'success',
        text: result?.message || 'Signed document uploaded successfully.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error.message || 'Unable to upload the signed copy right now.',
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

  const renderContractActions = (contract, layout = 'grid') => {
    const isTable = layout === 'table';
    const isWorking = workingContractId === contract.id;
    const isUploading = uploadingContractId === contract.id;
    const isDownloading = downloadingContractId === contract.id;
    const isDownloadingSigned = downloadingSignedContractId === contract.id;
    const tableButtonBase = 'btn-secondary flex h-10 w-10 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60';
    const tablePrimaryBase = 'btn-primary flex h-10 w-10 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60';
    const tableSuccessBase = 'flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500 bg-emerald-500 p-0 text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)] transition hover:border-emerald-400 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60';
    const gridButtonBase = 'btn-secondary flex h-11 w-11 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60';
    const gridPrimaryBase = 'btn-primary flex h-11 w-11 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60';
    const gridSuccessBase = 'flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500 bg-emerald-500 p-0 text-white shadow-[0_10px_24px_rgba(16,185,129,0.24)] transition hover:border-emerald-400 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60';
    const buttonBase = isTable ? tableButtonBase : gridButtonBase;
    const primaryButtonBase = isTable ? tablePrimaryBase : gridPrimaryBase;
    const acceptButtonBase = isTable ? tableSuccessBase : gridSuccessBase;
    const uploadBase = isTable ? tableButtonBase : `${gridButtonBase} cursor-pointer`;

    return (
      <div className={isTable ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-3'}>
        <button
          type="button"
          disabled={isWorking || contract.status === 'Accepted'}
          onClick={() => handleDecision(contract.id, 'accept')}
          className={acceptButtonBase}
          title={isWorking && contract.status !== 'Accepted' ? 'Saving agreement decision' : 'Accept agreement'}
          aria-label={`Accept agreement ${contract.title}`}
        >
          <Check size={16} strokeWidth={3} />
        </button>

        <button
          type="button"
          disabled={isWorking || contract.status === 'Rejected'}
          onClick={() => handleDecision(contract.id, 'reject')}
          className={buttonBase}
          title="Reject agreement"
          aria-label={`Reject agreement ${contract.title}`}
        >
          <XCircle size={14} />
        </button>

        {contract.downloadUrl ? (
          <button
            type="button"
            onClick={() => handleDownload(contract)}
            disabled={isDownloading}
            className={buttonBase}
            title={isDownloading ? 'Downloading agreement copy' : 'Download agreement copy'}
            aria-label={`Download agreement copy ${contract.title}`}
          >
            <Download size={14} />
          </button>
        ) : null}

        <label className={uploadBase} title="Upload signed copy" aria-label={`Upload signed copy ${contract.title}`}>
          <Upload size={14} />
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              void handleUpload(contract.id, file);
              event.target.value = '';
            }}
          />
        </label>

        {contract.signedDocumentUrl ? (
          <button
            type="button"
            onClick={() => handleSignedDownload(contract)}
            disabled={isDownloadingSigned}
            className={buttonBase}
            title={isDownloadingSigned ? 'Downloading signed copy' : 'Download signed copy'}
            aria-label={`Download signed copy ${contract.title}`}
          >
            <FileSignature size={14} />
          </button>
        ) : null}

        {returnToCheckout && checkoutAgreementRecord?.id === contract.id && contract.status === 'Accepted' ? (
          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className={primaryButtonBase}
            title="Continue checkout"
            aria-label={`Continue checkout for ${contract.title}`}
          >
            <ArrowRight size={14} />
          </button>
        ) : null}
      </div>
    );
  };

  const columns = [
    {
      key: 'title',
      label: 'Contract',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'serviceName',
      label: 'Scope',
      sortable: true,
      render: (value, row) => (
        <div>
          <p className="font-medium text-white">{value || 'Agreement pack'}</p>
          <p className="mt-1 text-xs text-slate-400">{getContractScopeLabel(row)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'decisionAt',
      label: 'Recorded',
      sortable: true,
      sortValue: (row) => {
        const time = new Date(getContractRecordedAt(row) || 0).getTime();
        return Number.isNaN(time) ? 0 : time;
      },
      render: (_, row) => (
        <div>
          <p className="font-medium text-white">{formatDateTime(getContractRecordedAt(row))}</p>
          <p className="mt-1 text-xs text-slate-400">By {row.decisionBy || 'Customer'}</p>
        </div>
      ),
    },
    {
      key: 'documents',
      label: 'Document Bundle',
      render: (_, row) => {
        const documents = buildDocumentRows(row);

        return (
          <div>
            <p className="font-medium text-white">{documents.length} included</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{documents.map((document) => document.title).join(', ')}</p>
          </div>
        );
      },
    },
    {
      key: 'signedDocumentName',
      label: 'Signed Copy',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium text-white">{hasSignedDocument(row) ? (row.signedDocumentName || 'Signed copy uploaded') : 'Not uploaded yet'}</p>
          <p className="mt-1 text-xs text-slate-400">
            {row.signedDocumentUploadedAt
              ? formatDateTime(row.signedDocumentUploadedAt)
              : row.signedDocumentUrl
                ? 'Signed file available to download'
                : row.requiresSignedDocument
                  ? 'Finance may still request one'
                  : 'Optional support file'}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => renderContractActions(row, 'table'),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Contracts & Agreements"
        title="Review, approve, and track agreement records"
        description="Customers can review contract terms, accept or reject agreement packs, download agreement copies, upload signed documents when Finance asks for them, and keep an audit-ready acceptance trail."
        belowDescription={feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackToneClasses[feedback.tone] ?? feedbackToneClasses.success}`}>
            {feedback.text}
          </div>
        ) : null}
        action={
          <div className="flex flex-wrap gap-3">
            <Link to="/dashboard/orders" className="btn-secondary">
              Order History
            </Link>
            {returnToCheckout ? (
              <button
                type="button"
                onClick={() => navigate('/checkout')}
                className={checkoutAgreementRecord?.status === 'Accepted' ? 'btn-primary' : 'btn-secondary'}
              >
                {checkoutAgreementRecord?.status === 'Accepted' ? 'Return to Checkout' : 'Back to Checkout'}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            accent={card.accent}
            onClick={() => setStatusFilter(card.filter)}
            isActive={statusFilter === card.filter}
          />
        ))}
      </div>

      {checkoutAgreementRecord ? (
        <div className={`panel mb-6 p-5 ${checkoutAgreementRecord.status === 'Accepted' ? 'border-emerald-400/20' : 'border-orange-400/20'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-orange-300">Checkout Gate</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{checkoutAgreementRecord.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {checkoutAgreementRecord.status === 'Accepted'
                  ? 'This agreement pack is already approved. Payment can continue and the acceptance remains visible for compliance checks.'
                  : checkoutAgreementRecord.status === 'Rejected'
                    ? 'The checkout agreement was rejected. Accept it here before payment can continue.'
                    : 'Payment is paused until the active checkout agreement pack is reviewed and accepted by the customer.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={checkoutAgreementRecord.status} />
              {returnToCheckout && checkoutAgreementRecord.status === 'Accepted' ? (
                <button type="button" onClick={() => navigate('/checkout')} className="btn-primary gap-2">
                  Continue Checkout
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel mb-6 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search service, agreement title, reference, or signed copy"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.02] py-2 pl-10 pr-4 text-sm text-slate-200 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center" ref={filterTriggerRef}>
              <button
                type="button"
                onClick={() => setFilterOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                aria-label="Contract status filter"
              >
                <span className="max-w-[12rem] truncate text-sm text-slate-200">{statusFilter}</span>
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
                            setStatusFilter(filter);
                            setFilterOpen(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5 ${statusFilter === filter ? 'bg-white/5' : ''}`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )
                : null}
            </div>

            <div className="flex flex-wrap gap-2">
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

      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          rows={paginatedContracts}
          emptyMessage={isLoadingPortal ? 'Loading your agreement records...' : 'No contract records match the current search and filter.'}
        />
      ) : paginatedContracts.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {paginatedContracts.map((contract) => {
            const documents = buildDocumentRows(contract);

            return (
              <div key={contract.id} className={`panel p-5 ${checkoutAgreementRecord?.id === contract.id ? 'border-orange-400/20' : ''}`}>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{getContractScopeLabel(contract)}</p>
                        {contract.requiresSignedDocument ? (
                          <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-orange-200">
                            Finance signed copy may be required
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-white">{contract.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{contract.description}</p>
                    </div>
                    <StatusBadge status={contract.status} />
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                        <tbody className="divide-y divide-white/6">
                          {buildContractDetailRows(contract).map((row) => (
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
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Document Bundle</p>
                        <p className="text-xs text-slate-500">{documents.length} included documents</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {documents.map((row) => (
                          <span
                            key={`${contract.id}-${row.id}`}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300"
                          >
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
                          <p className="mt-1 text-xs text-slate-500">Quick icon actions for this agreement record.</p>
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
              ? 'Loading your agreement records...'
              : 'No contract records match the current search and filter.'}
          </p>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
}
