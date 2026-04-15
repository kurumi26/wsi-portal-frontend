import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { getAddonBillingCycle, getAddonBillingCycleLabel } from '../../utils/addons';

const getLabel = (opt) => {
  if (opt === null || opt === undefined) return '';
  return typeof opt === 'object' ? opt.label ?? opt.name ?? JSON.stringify(opt) : String(opt);
};

const getValue = (opt) => {
  if (opt === null || opt === undefined) return '';
  return typeof opt === 'object' ? opt.label ?? opt.name ?? JSON.stringify(opt) : String(opt);
};

const formatBillingCycleLabel = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) {
    return 'Flexible';
  }

  if (normalized === 'one_time' || normalized === 'onetime') {
    return 'One-time';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, ' ');
};

const normalizeDisplayLabel = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const formatServiceDisplayText = (value) => String(value ?? '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export default function ServiceCard({ service, configuration, addon, onConfigure, onAdd }) {
  const [isAddonMenuOpen, setIsAddonMenuOpen] = useState(false);
  const [addonMenuPosition, setAddonMenuPosition] = useState(null);
  const addonMenuRef = useRef(null);
  const addonTriggerRef = useRef(null);
  const configurationOptions = Array.isArray(service?.configurations) ? service.configurations : [];
  const addonOptions = Array.isArray(service?.addons) ? service.addons : [];
  const selectedConfiguration = getValue(configuration);
  const selectedAddons = Array.isArray(addon)
    ? addon.map((item) => getValue(item)).filter(Boolean)
    : addon
      ? [getValue(addon)]
      : [];
  const displayServiceName = formatServiceDisplayText(service?.name);
  const displayServiceDescription = formatServiceDisplayText(service?.description);
  const billingLabel = formatBillingCycleLabel(service?.billingCycle ?? service?.billing);
  const visibleConfigurationOptions = configurationOptions.slice(0, 3);
  const shouldShowConfigurationMeta = configurationOptions.length > 1;
  const shouldShowConfigurationSelector = configurationOptions.length > 1;
  const shouldShowIncludedOptions = configurationOptions.length > 1 || visibleConfigurationOptions.some((item) => {
    return normalizeDisplayLabel(getLabel(item)) !== normalizeDisplayLabel(service?.name);
  });
  const metaItems = [
    shouldShowConfigurationMeta ? { label: 'Product Types', value: configurationOptions.length } : null,
  ].filter(Boolean);

  const selectedAddonSummary = useMemo(() => {
    if (!selectedAddons.length) {
      return 'Select one or more add-ons';
    }

    if (selectedAddons.length === 1) {
      const selectedOption = addonOptions.find((option) => getValue(option) === selectedAddons[0]);
      const billingCycleLabel = getAddonBillingCycleLabel(
        getAddonBillingCycle(selectedOption, service?.billingCycle ?? service?.billing?.cycle ?? service?.billing),
        '',
      );

      return billingCycleLabel ? `${selectedAddons[0]} • ${billingCycleLabel}` : selectedAddons[0];
    }

    return `${selectedAddons.length} add-ons selected`;
  }, [addonOptions, selectedAddons, service?.billing, service?.billingCycle]);

  const updateAddonMenuPosition = () => {
    if (!addonTriggerRef.current || typeof window === 'undefined') {
      return;
    }

    const rect = addonTriggerRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = Math.min(Math.max(rect.width, 280), window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const estimatedMenuHeight = Math.min(72 + addonOptions.length * 56, 320);
    const shouldOpenUpward = rect.bottom + estimatedMenuHeight > window.innerHeight - viewportPadding && rect.top > estimatedMenuHeight;
    const top = shouldOpenUpward
      ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 8)
      : Math.min(rect.bottom + 8, window.innerHeight - estimatedMenuHeight - viewportPadding);

    setAddonMenuPosition({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${menuWidth}px`,
      zIndex: 999,
    });
  };

  useEffect(() => {
    if (!isAddonMenuOpen) {
      setAddonMenuPosition(null);
      return undefined;
    }

    updateAddonMenuPosition();

    const handlePointerDown = (event) => {
      if (addonMenuRef.current && addonMenuRef.current.contains(event.target)) {
        return;
      }

      if (addonTriggerRef.current && addonTriggerRef.current.contains(event.target)) {
        return;
      }

      setIsAddonMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddonMenuOpen(false);
      }
    };

    const handleViewportChange = () => {
      updateAddonMenuPosition();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [addonOptions.length, isAddonMenuOpen]);

  const toggleAddonSelection = (optionValue) => {
    const nextAddons = selectedAddons.includes(optionValue)
      ? selectedAddons.filter((item) => item !== optionValue)
      : [...selectedAddons, optionValue];

    onConfigure(service.id, 'addon', nextAddons);
  };

  const clearAddonSelection = () => {
    onConfigure(service.id, 'addon', []);
  };

  return (
    <article className="catalog-card">
      <div className="catalog-card__inner">
        <div className="catalog-card__hero">
          <div className="catalog-card__hero-copy">
            <div className="flex flex-wrap items-center gap-2">
              <span className="catalog-card__chip">{service.category}</span>
            </div>
            <h3 className="catalog-card__title">{displayServiceName}</h3>
            <p className="catalog-card__description">{displayServiceDescription}</p>
          </div>

          <div className="catalog-card__price-box">
            <span className="catalog-card__price-label">Starts at</span>
            <p className="catalog-card__price-value">{formatCurrency(service.price)}</p>
            <p className="catalog-card__price-cycle">/{billingLabel}</p>
          </div>
        </div>

        {metaItems.length ? (
          <div className="catalog-card__meta-grid">
            {metaItems.map((item) => (
              <div key={item.label} className="catalog-card__meta-item">
                <span className="catalog-card__meta-label">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {shouldShowIncludedOptions ? (
          <section className="catalog-card__section">
            <div className="flex items-center justify-between gap-3">
              <p className="catalog-card__section-title">Included Options</p>
              <span className="catalog-card__section-hint">Managed by default</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {visibleConfigurationOptions.length ? visibleConfigurationOptions.map((item) => (
                <div key={getValue(item)} className="catalog-card__check-row">
                  <span className="catalog-card__check-icon">
                    <CheckCircle2 size={15} />
                  </span>
                  <span className="catalog-card__check-text">{getLabel(item)}</span>
                </div>
              )) : (
                <p className="catalog-card__empty-state">No included options listed yet.</p>
              )}
            </div>
          </section>
        ) : null}

        <section className="catalog-card__section catalog-card__section--config">
          <div className="flex items-center justify-between gap-3">
            <p className="catalog-card__section-title">Configure This Service</p>
            <span className="catalog-card__section-hint">{selectedAddons.length ? `${selectedAddons.length} selected` : 'Optional add-ons'}</span>
          </div>

          <div className={`mt-4 grid gap-3 ${shouldShowConfigurationSelector ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            {shouldShowConfigurationSelector ? (
              <label className="catalog-card__field">
                <span className="catalog-card__field-label">Product Type</span>
                <select
                  value={selectedConfiguration}
                  onChange={(event) => onConfigure(service.id, 'configuration', event.target.value)}
                  className="catalog-card__control"
                >
                  {configurationOptions.map((option) => (
                    <option key={getValue(option)} value={getValue(option)}>
                      {getLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="catalog-card__field">
              <span className="catalog-card__field-label">Add-ons</span>
              {addonOptions.length ? (
                <div className="mt-2">
                  <button
                    ref={addonTriggerRef}
                    type="button"
                    onClick={() => setIsAddonMenuOpen((current) => !current)}
                    className="catalog-card__control catalog-card__control--button"
                    aria-haspopup="listbox"
                    aria-expanded={isAddonMenuOpen}
                  >
                    <span className={`block truncate text-left ${selectedAddons.length ? 'catalog-card__control-text' : 'catalog-card__control-placeholder'}`}>
                      {selectedAddonSummary}
                    </span>
                    <ChevronDown size={16} className={`catalog-card__control-chevron ${isAddonMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isAddonMenuOpen && addonMenuPosition && typeof document !== 'undefined'
                    ? createPortal(
                        <div
                          ref={addonMenuRef}
                          style={addonMenuPosition}
                          className="catalog-addon-menu"
                        >
                          <div className="catalog-addon-menu__header">
                            <span>Select one or more add-ons</span>
                            {selectedAddons.length ? <span>{selectedAddons.length} selected</span> : null}
                          </div>

                          <div className="catalog-addon-menu__body">
                            <label className={`catalog-addon-option ${selectedAddons.length === 0 ? 'is-active' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selectedAddons.length === 0}
                                onChange={clearAddonSelection}
                                className="catalog-addon-option__checkbox"
                              />
                              <div className="catalog-addon-option__content">
                                <span className="catalog-addon-option__title">None</span>
                              </div>
                            </label>

                            {addonOptions.map((option) => {
                              const optionValue = getValue(option);
                              const optionLabel = getLabel(option);
                              const optionPrice = typeof option === 'object' && typeof option.price === 'number' ? option.price : null;
                              const optionBillingCycle = getAddonBillingCycleLabel(
                                getAddonBillingCycle(option, service?.billingCycle ?? service?.billing?.cycle ?? service?.billing),
                                '',
                              );
                              const isChecked = selectedAddons.includes(optionValue);

                              return (
                                <label
                                  key={optionValue}
                                  className={`catalog-addon-option ${isChecked ? 'is-active' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleAddonSelection(optionValue)}
                                    className="catalog-addon-option__checkbox"
                                  />
                                  <div className="catalog-addon-option__content">
                                    <div className="min-w-0 flex-1 pr-3">
                                      <span className="catalog-addon-option__title">{optionLabel}</span>
                                      {optionBillingCycle ? <span className="catalog-addon-option__meta">{optionBillingCycle}</span> : null}
                                    </div>
                                    <div className="catalog-addon-option__price-wrap">
                                      {optionPrice ? <span className="catalog-addon-option__price">{formatCurrency(optionPrice)}</span> : null}
                                      {optionBillingCycle ? <span className="catalog-addon-option__cycle">/{optionBillingCycle.toLowerCase()}</span> : null}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>,
                        document.body,
                      )
                    : null}
                </div>
              ) : (
                <div className="catalog-card__control catalog-card__control--empty">
                  No add-ons available
                </div>
              )}
            </label>
          </div>

          {selectedAddons.length ? <p className="catalog-card__summary">Selected: {selectedAddonSummary}</p> : null}
        </section>

        <button type="button" onClick={() => onAdd(service)} className="catalog-card__cta">
          <Plus size={16} /> Add to Order
        </button>
      </div>
    </article>
  );
}
