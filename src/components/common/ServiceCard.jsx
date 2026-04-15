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

export default function ServiceCard({ service, configuration, addon, onConfigure, onAdd }) {
  const [isAddonMenuOpen, setIsAddonMenuOpen] = useState(false);
  const [addonMenuPosition, setAddonMenuPosition] = useState(null);
  const addonMenuRef = useRef(null);
  const addonTriggerRef = useRef(null);
  const selectedConfiguration = getValue(configuration);
  const selectedAddons = Array.isArray(addon)
    ? addon.map((item) => getValue(item)).filter(Boolean)
    : addon
      ? [getValue(addon)]
      : [];
  const addonOptions = service.addons || [];

  const selectedAddonSummary = useMemo(() => {
    if (!selectedAddons.length) {
      return 'Select one or more add-ons';
    }

    if (selectedAddons.length === 1) {
      const selectedOption = addonOptions.find((option) => getValue(option) === selectedAddons[0]);
      const billingCycleLabel = getAddonBillingCycleLabel(getAddonBillingCycle(selectedOption, service?.billingCycle ?? service?.billing?.cycle ?? service?.billing), '');

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
      if (
        addonMenuRef.current && addonMenuRef.current.contains(event.target)
      ) {
        return;
      }

      if (
        addonTriggerRef.current && addonTriggerRef.current.contains(event.target)
      ) {
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
    <article className="panel flex h-full flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="badge bg-sky-400/10 text-sky-300">{service.category}</span>
          <h3 className="mt-4 text-xl font-semibold text-white">{service.name}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-400">{service.description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-white">{formatCurrency(service.price)}</p>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">/{service.billing}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm text-slate-300">
        <div>
          <p className="mb-2 font-medium text-white">Included Options</p>
            <div className="space-y-2">
            {service.configurations.slice(0, 3).map((item) => (
              <div key={getValue(item)} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-sky-300" />
                <span>{getLabel(item)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Product Type
            <select value={selectedConfiguration} onChange={(event) => onConfigure(service.id, 'configuration', event.target.value)} className="input mt-2">
              {service.configurations.map((option) => (
                <option key={getValue(option)} value={getValue(option)}>
                  {getLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Add-ons
            {addonOptions.length ? (
              <div className="mt-2">
                <button
                  ref={addonTriggerRef}
                  type="button"
                  onClick={() => setIsAddonMenuOpen((current) => !current)}
                  className="input flex min-h-12 items-center justify-between gap-3 text-left"
                  aria-haspopup="listbox"
                  aria-expanded={isAddonMenuOpen}
                >
                  <span className={`block truncate text-sm normal-case tracking-normal ${selectedAddons.length ? 'text-slate-100' : 'text-slate-400'}`}>
                    {selectedAddonSummary}
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${isAddonMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAddonMenuOpen && addonMenuPosition && typeof document !== 'undefined'
                  ? createPortal(
                      <div
                        ref={addonMenuRef}
                        style={addonMenuPosition}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/40"
                      >
                        <div className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-[11px] normal-case tracking-normal text-slate-400">
                          <span>Select one or more add-ons</span>
                          {selectedAddons.length ? <span>{selectedAddons.length} selected</span> : null}
                        </div>
                        <div className="max-h-72 space-y-2 overflow-y-auto p-2">
                          <label
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 transition ${selectedAddons.length === 0 ? 'border-sky-300/30 bg-sky-400/10' : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAddons.length === 0}
                              onChange={clearAddonSelection}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-900"
                            />
                            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                              <span className="pr-2 text-sm normal-case tracking-normal text-slate-200">None</span>
                            </div>
                          </label>
                          {addonOptions.map((option) => {
                            const optionValue = getValue(option);
                            const optionLabel = getLabel(option);
                            const optionPrice = typeof option === 'object' && typeof option.price === 'number' ? option.price : null;
                            const optionBillingCycle = getAddonBillingCycleLabel(getAddonBillingCycle(option, service?.billingCycle ?? service?.billing?.cycle ?? service?.billing), '');
                            const isChecked = selectedAddons.includes(optionValue);

                            return (
                              <label
                                key={optionValue}
                                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 transition ${isChecked ? 'border-sky-300/30 bg-sky-400/10' : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAddonSelection(optionValue)}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-900"
                                />
                                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1 pr-2">
                                    <span className="block text-sm normal-case tracking-normal text-slate-200">{optionLabel}</span>
                                    {optionBillingCycle ? <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-400">{optionBillingCycle}</span> : null}
                                  </div>
                                  <div className="shrink-0 text-right">
                                    {optionPrice ? <span className="block text-xs font-medium normal-case tracking-normal text-sky-200">{formatCurrency(optionPrice)}</span> : null}
                                    {optionBillingCycle ? <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-400">/{optionBillingCycle.toLowerCase()}</span> : null}
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
              <div className="input mt-2 flex min-h-12 items-center text-sm normal-case tracking-normal text-slate-400">
                No add-ons available
              </div>
            )}
          </label>
        </div>
      </div>

      <button type="button" onClick={() => onAdd(service)} className="btn-primary mt-6 gap-2 w-full">
        <Plus size={16} /> Add to Order
      </button>
    </article>
  );
}
