import { useEffect, useMemo, useState } from 'react';
import { Check, ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency } from '../../utils/format';
import {
  getAddonBillingCycle,
  getAddonBillingCycleLabel,
  getAddonLabel,
  getAddonPrice,
} from '../../utils/addons';

const getOptionLabel = (option) => {
  if (option === null || option === undefined) {
    return '';
  }

  return typeof option === 'object'
    ? option.label ?? option.name ?? String(option)
    : String(option);
};

const formatBillingLabel = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) return 'flexible';
  if (normalized === 'one_time' || normalized === 'onetime') return 'one-time';
  return normalized.replace(/_/g, ' ');
};

export default function ServicePlanConfigurator({ plan, lineId, onClose }) {
  const { cart, updateCartItemAddons } = usePortal();

  const configurationOptions = Array.isArray(plan?.configurations) ? plan.configurations : [];
  const addonOptions = Array.isArray(plan?.addons) ? plan.addons : [];
  const fallbackCycle = plan?.billingCycle ?? plan?.billing;
  const cartLine = cart.find((item) => item.lineId === lineId);

  const [configuration, setConfiguration] = useState(() => getOptionLabel(configurationOptions[0] ?? plan?.name ?? ''));
  const [selectedAddonLabels, setSelectedAddonLabels] = useState([]);

  useEffect(() => {
    const initialConfiguration = getOptionLabel(cartLine?.configuration ?? configurationOptions[0] ?? plan?.name ?? '');
    setConfiguration(initialConfiguration);

    const existingAddons = Array.isArray(cartLine?.addon) ? cartLine.addon : cartLine?.addon ? [cartLine.addon] : [];
    setSelectedAddonLabels(existingAddons.map((option) => getAddonLabel(option)).filter(Boolean));
  }, [lineId, plan?.id]);

  const selectedAddonObjects = useMemo(
    () => addonOptions.filter((option) => selectedAddonLabels.includes(getAddonLabel(option))),
    [addonOptions, selectedAddonLabels],
  );

  const addonsTotal = useMemo(
    () => selectedAddonObjects.reduce((sum, option) => {
      const price = getAddonPrice(option);
      return sum + (typeof price === 'number' ? price : 0);
    }, 0),
    [selectedAddonObjects],
  );

  const estimatedTotal = (typeof plan?.price === 'number' ? plan.price : 0) + addonsTotal;
  const displayName = String(plan?.name ?? '').replace(/[_-]+/g, ' ');

  const toggleAddon = (label) => {
    setSelectedAddonLabels((current) => {
      const nextLabels = current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label];
      const nextObjects = addonOptions.filter((option) => nextLabels.includes(getAddonLabel(option)));
      updateCartItemAddons(
        lineId,
        plan,
        configuration,
        nextObjects.length ? nextObjects : [],
      );
      return nextLabels;
    });
  };

  const handleConfigurationChange = (label) => {
    setConfiguration(label);
    updateCartItemAddons(
      lineId,
      plan,
      label,
      selectedAddonObjects.length ? selectedAddonObjects : [],
    );
  };

  return (
    <section className="service-plan-configurator" id="service-plan-configurator">
      <div className="service-plan-configurator__header">
        <div>
          <p className="service-plan-configurator__eyebrow">{plan?.category}</p>
          <h3 className="service-plan-configurator__title">{displayName} added to cart</h3>
          <p className="service-plan-configurator__subtitle">
            Choose optional add-ons below. Your cart updates automatically.
          </p>
        </div>
        <button type="button" onClick={onClose} className="service-plan-configurator__close" aria-label="Close configuration">
          <X size={18} />
        </button>
      </div>

      {configurationOptions.length > 1 ? (
        <div className="service-plan-configurator__section">
          <p className="service-plan-configurator__section-title">Plan option</p>
          <div className="service-plan-configurator__options">
            {configurationOptions.map((option) => {
              const label = getOptionLabel(option);
              const isActive = label === configuration;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleConfigurationChange(label)}
                  className={`service-plan-configurator__option ${isActive ? 'is-active' : ''}`}
                >
                  <span className={`service-plan-configurator__check ${isActive ? 'is-active' : ''}`}>
                    {isActive ? <Check size={12} /> : null}
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {addonOptions.length ? (
        <div className="service-plan-configurator__section">
          <p className="service-plan-configurator__section-title">Recommended add-ons</p>
          <div className="service-plan-configurator__addons">
            {addonOptions.map((option) => {
              const label = getAddonLabel(option);
              const price = getAddonPrice(option);
              const cycleLabel = getAddonBillingCycleLabel(
                getAddonBillingCycle(option, fallbackCycle),
                '',
              );
              const isChecked = selectedAddonLabels.includes(label);

              return (
                <label key={label} className={`service-plan-configurator__addon ${isChecked ? 'is-active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleAddon(label)}
                    className="service-plan-configurator__addon-input"
                  />
                  <span className="service-plan-configurator__addon-label">
                    <span className="service-plan-configurator__addon-name">{label}</span>
                    {cycleLabel ? <span className="service-plan-configurator__addon-cycle">{cycleLabel}</span> : null}
                  </span>
                  {typeof price === 'number' ? (
                    <span className="service-plan-configurator__addon-price">{formatCurrency(price)}</span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="service-plan-configurator__no-addons">No Add Ons Available</p>
      )}

      <div className="service-plan-configurator__footer">
        <div>
          <p className="service-plan-configurator__total-label">Estimated total</p>
          <p className="service-plan-configurator__total">
            {formatCurrency(estimatedTotal)}
            <span> /{formatBillingLabel(fallbackCycle)}</span>
          </p>
        </div>
        <Link to="/checkout" className="service-plan-configurator__cta">
          <ShoppingCart size={16} /> Continue to Checkout
        </Link>
      </div>
    </section>
  );
}
