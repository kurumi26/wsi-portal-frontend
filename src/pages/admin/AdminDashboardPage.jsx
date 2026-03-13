import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency, formatDateTime } from '../../utils/format';

export default function AdminDashboardPage() {
  const { stats, clients, adminServices } = usePortal();
  const [selectedTimeline, setSelectedTimeline] = useState(null);

  const rateCards = useMemo(() => {
    const totalManagedServices = adminServices.length;
    const approvedClients = clients.filter((client) => {
      const approvalStatus = client.registrationApproval?.statusKey;

      if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
        return false;
      }

      return true;
    }).length;

    const buildRate = (label, numerator, denominator, helper, accentClass) => ({
      label,
      numerator,
      denominator,
      helper,
      accentClass,
      value: denominator ? Math.round((numerator / denominator) * 100) : 0,
    });

    return [
      buildRate(
        'Activation Rate',
        stats.activeServices,
        totalManagedServices,
        'Active subscriptions across all managed services.',
        'from-emerald-400 to-sky-400',
      ),
      buildRate(
        'Approval Rate',
        approvedClients,
        clients.length,
        'Customer registrations currently approved for portal access.',
        'from-sky-400 to-cyan-300',
      ),
      buildRate(
        'Provisioning Rate',
        stats.provisioning,
        totalManagedServices,
        'Services still being provisioned by the admin team.',
        'from-orange-400 to-amber-300',
      ),
    ];
  }, [adminServices.length, clients, stats.activeServices, stats.provisioning]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin Portal"
        title="Operations Dashboard"
        description="Monitor clients, active services, purchases, and provisioning activity from a centralized admin view."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Clients" value={stats.totalClients} helper="Registered customers" accent="cyan" />
        <StatCard label="Active Services" value={stats.activeServices} helper="Running subscriptions" accent="emerald" />
        <StatCard label="Provisioning Queue" value={stats.provisioning} helper="Requires admin oversight" accent="amber" />
        <StatCard label="Revenue Logged" value={formatCurrency(stats.totalRevenue)} helper="Across recorded purchases" accent="violet" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {rateCards.map((card) => (
          <div key={card.label} className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-300">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{card.value}%</p>
                <p className="mt-2 text-sm text-slate-400">{card.helper}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                {card.numerator}/{card.denominator || 0}
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${card.accentClass}`}
                style={{ width: `${card.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="panel p-6">
          <h2 className="text-xl font-semibold text-white">Recent clients</h2>
          <div className="mt-6 space-y-4">
            {clients.map((client) => (
              <div key={client.id} className="panel-muted flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-white">{client.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{client.email}</p>
                </div>
                <div className="text-right text-sm text-slate-400">
                  <p>{client.services} services</p>
                  <p className="text-white">{client.status}</p>
                  {client.joinedAt ? (
                    <button
                      type="button"
                      onClick={() => setSelectedTimeline({
                        title: client.name,
                        subtitle: client.email,
                        label: 'Joined At',
                        value: client.joinedAt,
                      })}
                      className="mt-1 text-xs text-sky-200 underline decoration-sky-400/40 underline-offset-4 transition hover:text-sky-100"
                    >
                      {formatDateTime(client.joinedAt)}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="text-xl font-semibold text-white">Provisioning watchlist</h2>
          <div className="mt-6 space-y-4">
            {adminServices.filter((service) => service.status === 'Undergoing Provisioning').map((service) => (
              <div key={service.id} className="panel-muted p-4">
                <p className="font-medium text-white">{service.name}</p>
                <p className="mt-1 text-sm text-slate-400">Plan: {service.plan}</p>
                {service.renewsOn ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTimeline({
                      title: service.name,
                      subtitle: `Plan: ${service.plan}`,
                      label: 'Renewal Timeline',
                      value: service.renewsOn,
                    })}
                    className="mt-2 text-xs text-sky-200 underline decoration-sky-400/40 underline-offset-4 transition hover:text-sky-100"
                  >
                    {formatDateTime(service.renewsOn)}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTimeline ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Timeline Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedTimeline.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{selectedTimeline.subtitle}</p>
              </div>
              <button type="button" onClick={() => setSelectedTimeline(null)} className="btn-secondary px-4">
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{selectedTimeline.label}</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatDateTime(selectedTimeline.value)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
