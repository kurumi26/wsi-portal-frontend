import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency } from '../../utils/format';
import { getCategoryIcon } from '../../utils/serviceVisuals';
import ServicePlanConfigurator from './ServicePlanConfigurator';

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

const getOptionLabel = (option) => {
  if (option === null || option === undefined) {
    return '';
  }

  return typeof option === 'object'
    ? option.label ?? option.name ?? String(option)
    : String(option);
};

function planNeedsConfiguration(plan) {
  const addonOptions = Array.isArray(plan?.addons) ? plan.addons : [];
  const configurationOptions = Array.isArray(plan?.configurations) ? plan.configurations : [];
  return addonOptions.length > 0 || configurationOptions.length > 1;
}

export default function ServicePlansPanel({
  title,
  plans,
  highlightId,
  onClose,
}) {
  const navigate = useNavigate();
  const { addToCart } = usePortal();
  const [activeConfiguration, setActiveConfiguration] = useState(null);

  useEffect(() => {
    if (!activeConfiguration) {
      return;
    }

    const scrollTarget = document.getElementById('service-plan-configurator');
    if (!scrollTarget) {
      return;
    }

    requestAnimationFrame(() => {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [activeConfiguration?.lineId]);

  const handleAddToCart = (plan) => {
    const configurationOptions = Array.isArray(plan.configurations) ? plan.configurations : [];
    const configuration = configurationOptions.length
      ? getOptionLabel(configurationOptions[0])
      : plan.name;

    const lineItem = addToCart(plan, configuration, []);

    if (planNeedsConfiguration(plan)) {
      setActiveConfiguration({ plan, lineId: lineItem.lineId });
      return;
    }

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
          const hasAddons = Array.isArray(plan.addons) && plan.addons.length > 0;
          const isActive = activeConfiguration?.plan?.id === plan.id;

          return (
            <article
              key={plan.id}
              className={`service-plan-card ${isHighlighted || isActive ? 'is-highlighted' : ''}`}
            >
              <div className="service-plan-card__icon">
                <PlanIcon size={24} />
              </div>
              <p className="service-plan-card__category">{plan.category}</p>
              <h3 className="service-plan-card__name">{displayName}</h3>
              {hasAddons ? (
                <p className="service-plan-card__addons-note">{plan.addons.length} optional add-on{plan.addons.length === 1 ? '' : 's'}</p>
              ) : null}
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
                  <ShoppingCart size={15} />
                  Add to Cart
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {activeConfiguration ? (
        <ServicePlanConfigurator
          plan={activeConfiguration.plan}
          lineId={activeConfiguration.lineId}
          onClose={() => setActiveConfiguration(null)}
        />
      ) : null}
    </section>
  );
}
