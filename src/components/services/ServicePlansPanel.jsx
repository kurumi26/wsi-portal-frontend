import { ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency } from '../../utils/format';
import { getCategoryIcon } from '../../utils/serviceVisuals';

const formatBillingLabel = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) return 'flexible';
  if (normalized === 'one_time' || normalized === 'onetime') return 'one-time';
  return normalized.replace(/_/g, ' ');
};

const formatDisplayName = (value) => String(value ?? '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export default function ServicePlansPanel({
  title,
  plans,
  highlightId,
  onClose,
}) {
  const navigate = useNavigate();
  const { addToCart } = usePortal();

  const handleAddToCart = (plan) => {
    const configuration = Array.isArray(plan.configurations) ? plan.configurations[0] : null;
    const configLabel = configuration
      ? (typeof configuration === 'object' ? configuration.label ?? configuration.name : String(configuration))
      : plan.name;

    addToCart(plan, configLabel, []);
    navigate('/checkout');
  };

  if (!plans?.length) {
    return null;
  }

  return (
    <section className="service-plans-panel" id="service-plans-panel">
      <div className="service-plans-panel__header">
        <h2 className="service-plans-panel__title">{title}</h2>
        {onClose ? (
          <button type="button" onClick={onClose} className="service-plans-panel__close">
            Close
          </button>
        ) : null}
      </div>

      <div className="service-plans-panel__grid">
        {plans.map((plan) => {
          const PlanIcon = getCategoryIcon(plan.category);
          const displayName = formatDisplayName(plan.name);
          const isHighlighted = highlightId && String(plan.id) === String(highlightId);

          return (
            <article
              key={plan.id}
              className={`service-plan-card ${isHighlighted ? 'is-highlighted' : ''}`}
            >
              <div className="service-plan-card__icon">
                <PlanIcon size={24} />
              </div>
              <p className="service-plan-card__category">{plan.category}</p>
              <h3 className="service-plan-card__name">{displayName}</h3>
              <div className="service-plan-card__footer">
                <p className="service-plan-card__price">
                  {formatCurrency(plan.price)}
                  <span> /{formatBillingLabel(plan.billingCycle ?? plan.billing)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => handleAddToCart(plan)}
                  className="service-plan-card__cta"
                >
                  <ShoppingCart size={15} /> Add to Cart
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
