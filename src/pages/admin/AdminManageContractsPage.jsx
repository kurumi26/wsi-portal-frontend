import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, PenLine, RotateCcw, Search, Eye, X, FileSignature } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { usePortal } from '../../context/PortalContext';
import usePageTitle from '../../hooks/usePageTitle';
import { formatDateTime } from '../../utils/format';
import { buildContractTemplateDocument } from '../../utils/contracts';

const feedbackToneClasses = {
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  warning: 'border-orange-400/20 bg-orange-400/10 text-orange-100',
  error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
};

const CONTRACTS_PER_PAGE = 5;

const workspaceActionButtonClass = 'btn-secondary flex h-10 w-10 shrink-0 items-center justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60';

const getContractSearchValue = (contract) => [
  contract?.title,
  contract?.serviceName,
  contract?.clientName,
  contract?.orderNumber,
  contract?.auditReference,
  contract?.status,
].join(' ').toLowerCase();

const getContractEditorPath = (contractId) => `/admin/contracts/manage/${encodeURIComponent(contractId)}/editor`;

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

export default function AdminManageContractsPage() {
  usePageTitle('Manage Contract Templates');

  const {
    adminContractRecords,
    isLoadingPortal,
    resetManagedContractTemplate,
  } = usePortal();

  const [selectedContractId, setSelectedContractId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [feedback, setFeedback] = useState(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!adminContractRecords.length) {
      if (selectedContractId) {
        setSelectedContractId('');
      }
      return;
    }

    const stillExists = adminContractRecords.some((contract) => contract.id === selectedContractId);

    if (!stillExists) {
      setSelectedContractId(adminContractRecords[0]?.id ?? '');
    }
  }, [adminContractRecords, selectedContractId]);

  const filteredContracts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return adminContractRecords;
    }

    return adminContractRecords.filter((contract) => getContractSearchValue(contract).includes(normalizedSearch));
  }, [adminContractRecords, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / CONTRACTS_PER_PAGE));

  const paginatedContracts = useMemo(
    () => filteredContracts.slice((currentPage - 1) * CONTRACTS_PER_PAGE, currentPage * CONTRACTS_PER_PAGE),
    [currentPage, filteredContracts],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectedContract = useMemo(
    () => adminContractRecords.find((contract) => contract.id === selectedContractId) ?? null,
    [adminContractRecords, selectedContractId],
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContract, setPreviewContract] = useState(null);

  const previewDocument = useMemo(() => {
    if (!previewContract) {
      return null;
    }

    return buildContractTemplateDocument(previewContract);
  }, [previewContract]);

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

  const hasManagedTemplate = Boolean(selectedContract?.managedTemplateSettings);

  const handleReset = async () => {
    if (!selectedContract) {
      return;
    }

    setIsResetting(true);
    setFeedback(null);

    try {
      resetManagedContractTemplate(selectedContract);
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

  return (
    <div className="pb-12 ">
      <PageHeader
        eyebrow="Contracts / Manage"
        title="Manage Contract Templates"
        description="Select a contract record, review its details, and open the editor when you need to change the agreement template."
        belowDescription={feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackToneClasses[feedback.tone] ?? feedbackToneClasses.success}`}>
            {feedback.text}
          </div>
        ) : null}

      />

      <div className="space-y-6">



        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">Contract Records</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Choose a contract to manage</h2>
            </div>

            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Search contract records</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search client, service, or reference"
                  className="input pl-10"
                />
              </div>
            </label>
          </div>

          <div className="overflow-x-auto">
            {filteredContracts.length ? (
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Reference</th>
                    <th className="px-5 py-3 font-medium">Agreement</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Service</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Template</th>
                      <th className="px-5 py-3 font-medium text-center align-middle">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paginatedContracts.map((contract) => {
                    const isSelected = selectedContract?.id === contract.id;
                    const isManaged = Boolean(contract.managedTemplateSettings);

                    return (
                      <tr
                        key={contract.id}
                        onClick={() => setSelectedContractId(contract.id)}
                        className={`table-row-hoverable cursor-pointer transition ${isSelected ? 'bg-sky-400/[0.08]' : ''}`}
                      >
                        <td className="px-5 py-4 font-medium text-white">
                          {contract.auditReference || contract.orderNumber || '—'}
                        </td>
                        <td className="px-5 py-4 text-white">{contract.title}</td>
                        <td className="px-5 py-4 text-slate-300">{contract.clientName || 'Customer'}</td>
                        <td className="px-5 py-4 text-slate-300">{contract.serviceName || 'Managed service'}</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={contract.status} />
                        </td>
                        <td className="px-5 py-4">
                          {isManaged ? (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                              Customized
                            </span>
                          ) : (
                            <span className="text-slate-400">Default</span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-middle text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className={workspaceActionButtonClass}
                              title="Preview contract"
                              aria-label={`Preview ${contract.title}`}
                              onClick={(e) => { e.stopPropagation(); setPreviewContract(contract); setPreviewOpen(true); }}
                            >
                              <Eye size={16} className="text-current" />
                            </button>
                            <Link
                              to={getContractEditorPath(contract.id)}
                              className={workspaceActionButtonClass}
                              title="Open full editor"
                              aria-label={`Open full editor for ${contract.title}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PenLine size={16} className="text-current" strokeWidth={2.3} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-sm text-slate-400">
                {isLoadingPortal ? 'Loading contract records...' : 'No contract records matched the current search.'}
              </div>
            )}
          </div>

        </section>

        {filteredContracts.length ? (
          <div className="mt-6">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        ) : null}
      </div>
      {previewModal}
    </div>
  );
}
