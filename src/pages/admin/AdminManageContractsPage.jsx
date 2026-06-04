import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PenLine, RotateCcw, Search } from 'lucide-react';
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

const CONTRACTS_PER_PAGE = 10;

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

  const previewDocument = useMemo(() => {
    if (!selectedContract) {
      return null;
    }

    return buildContractTemplateDocument(selectedContract);
  }, [selectedContract]);

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

  return (
    <div>
      <PageHeader
        eyebrow="Contracts / Manage"
        title="Manage Contract Templates"
        description="Select a contract record, review its details, and open the editor when you need to change the agreement template."
        belowDescription={feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackToneClasses[feedback.tone] ?? feedbackToneClasses.success}`}>
            {feedback.text}
          </div>
        ) : null}
        action={(
          <Link to="/admin/contracts" className="btn-secondary gap-2 whitespace-nowrap">
            <ArrowLeft size={16} />
            Agreement Records
          </Link>
        )}
      />

      <div className="space-y-6">
        {selectedContract ? (
          <div className="panel overflow-hidden">
            <div className="manage-contracts-workspace-shell border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.18),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] p-6">
              <div className="manage-contracts-workspace-surface rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">Contract Workspace</p>
                      <StatusBadge status={selectedContract.status} />
                      <span className={`manage-contracts-template-pill rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${hasManagedTemplate ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-white/15 bg-white/[0.06] text-slate-200'}`}>
                        {hasManagedTemplate ? 'Custom template' : 'Default template'}
                      </span>
                    </div>
                    <h2 className="manage-contracts-workspace-title mt-4 text-3xl font-semibold tracking-tight text-white">{selectedContract.title}</h2>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to={getContractEditorPath(selectedContract.id)}
                      className={workspaceActionButtonClass}
                      title="Open full editor"
                      aria-label={`Open full editor for ${selectedContract.title}`}
                    >
                      <PenLine size={16} className="text-current" strokeWidth={2.3} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleReset()}
                      disabled={isResetting || !hasManagedTemplate}
                      className={workspaceActionButtonClass}
                      title={isResetting ? 'Resetting template' : 'Reset to default template'}
                      aria-label={`Reset ${selectedContract.title} to default template`}
                    >
                      <RotateCcw size={16} className="text-current" strokeWidth={2.3} />
                    </button>
                  </div>
                </div>

                <div className="manage-contracts-details-table mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <tbody className="divide-y divide-white/10">
                      <tr>
                        <th className="manage-contracts-details-label w-[180px] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer</th>
                        <td className="manage-contracts-details-value px-4 py-3 font-medium text-white">{selectedContract.clientName || 'Customer not linked yet'}</td>
                      </tr>
                      <tr>
                        <th className="manage-contracts-details-label px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Service</th>
                        <td className="manage-contracts-details-value px-4 py-3 font-medium text-white">{selectedContract.serviceName || 'Agreement record'}</td>
                      </tr>
                      <tr>
                        <th className="manage-contracts-details-label px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Reference</th>
                        <td className="manage-contracts-details-value px-4 py-3 font-medium text-white">{selectedContract.auditReference || selectedContract.orderNumber || 'Pending reference'}</td>
                      </tr>
                      <tr>
                        <th className="manage-contracts-details-label px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Last update</th>
                        <td className="manage-contracts-details-value px-4 py-3 text-white">
                          <p className="font-medium">{formatDateTime(selectedContract.managedTemplateUpdatedAt || selectedContract.issuedAt)}</p>
                          <p className="manage-contracts-details-helper mt-1 text-xs text-slate-400">{selectedContract.managedTemplateUpdatedBy || 'Default system template'}</p>
                        </td>
                      </tr>
                      <tr>
                        <th className="manage-contracts-details-label px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Clauses</th>
                        <td className="manage-contracts-details-value px-4 py-3 font-medium text-white">{previewDocument?.sections.length ?? 0}</td>
                      </tr>
                      <tr>
                        <th className="manage-contracts-details-label px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Schedules</th>
                        <td className="manage-contracts-details-value px-4 py-3 font-medium text-white">{previewDocument?.documents.length ?? 0}</td>
                      </tr>
                      <tr>
                        <th className="manage-contracts-details-label px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Signed copy</th>
                        <td className="manage-contracts-details-value px-4 py-3 font-medium text-white">{selectedContract.requiresSignedDocument ? 'Required' : 'Optional'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel p-10 text-center">
            <p className="text-lg font-semibold text-white">No contract selected</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {isLoadingPortal ? 'Loading contract records...' : 'Select a contract from the table below.'}
            </p>
          </div>
        )}

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

          {filteredContracts.length ? (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          ) : null}
        </section>
      </div>
    </div>
  );
}
