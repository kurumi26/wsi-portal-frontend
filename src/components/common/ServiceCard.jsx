import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

const formatBillingCycleLabel = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) {
    return 'flexible';
  }

  if (normalized === 'one_time' || normalized === 'onetime') {
    return 'one-time';
  }

  return normalized.replace(/_/g, ' ');
};

const formatServiceDisplayText = (value) => String(value ?? '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export default function ServiceCard({ service }) {
  const displayName = formatServiceDisplayText(service?.name);
  const displayDescription = formatServiceDisplayText(service?.description);
  const billingLabel = formatBillingCycleLabel(service?.billingCycle ?? service?.billing);
  const optionCount = Array.isArray(service?.configurations) ? service.configurations.length : 0;

  return (
    <article className="flex h-full flex-col rounded-none border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">{service.category}</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">{displayName}</h2>
      {displayDescription ? (
        <p className="mt-2 min-h-10 text-sm leading-6 text-slate-600">{displayDescription}</p>
      ) : null}

      {optionCount > 1 ? (
        <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{optionCount} plan options</p>
      ) : null}

      <div className="mt-auto pt-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">Starting at</p>
        <p className="storefront-price-font mt-1 text-3xl text-slate-950">
          {formatCurrency(service.price)}
          <span className="text-sm font-bold tracking-normal"> /{billingLabel}</span>
        </p>
        <Link
          to={`/services?plan=${service.id}`}
          className="domain-card-cta mt-7"
        >
          View Plans
        </Link>
      </div>
    </article>
  );
}
