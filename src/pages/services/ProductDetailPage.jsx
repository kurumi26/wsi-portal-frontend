import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Plus, ShoppingCart } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePortal } from '../../context/PortalContext';
import { formatCurrency } from '../../utils/format';
import { getAddonBillingCycle, getAddonBillingCycleLabel, getAddonLabel, getAddonPrice } from '../../utils/addons';
import { getCategoryIcon } from '../../utils/serviceVisuals';

const getOptionLabel = (option) => {
  if (option === null || option === undefined) {
    return '';
  }

  return typeof option === 'object'
    ? option.label ?? option.name ?? JSON.stringify(option)
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

export default function ProductDetailPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { services, addToCart } = usePortal();

  const service = useMemo(
    () => services.find((item) => String(item.id) === String(serviceId)) ?? null,
    [services, serviceId],
  );

  const configurationOptions = Array.isArray(service?.configurations) ? service.configurations : [];
  const addonOptions = Array.isArray(service?.addons) ? service.addons : [];

  const [configuration, setConfiguration] = useState(() => getOptionLabel(configurationOptions[0] ?? ''));
  const [selectedAddons, setSelectedAddons] = useState([]);

  useEffect(() => {
    setConfiguration(getOptionLabel(configurationOptions[0] ?? ''));
    setSelectedAddons([]);
  }, [service?.id]);

  const relatedServices = useMemo(() => {
    if (!service) return [];
    return services
      .filter((item) => item.category === service.category && String(item.id) !== String(service.id))
      .slice(0, 3);
  }, [service, services]);

  if (!service && !services.length) {
    return (
      <div className="store-panel mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Loading products</p>
        <p className="mt-3 text-base text-slate-400">Preparing the storefront catalog...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="store-panel mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Product not found</p>
        <p className="mt-3 text-base text-slate-400">This product may no longer be available.</p>
        <Link to="/services" className="btn-primary mt-6 inline-flex gap-2">
          <ArrowLeft size={16} /> Back to catalog
        </Link>
      </div>
    );
  }

  const Icon = getCategoryIcon(service.category);
  const fallbackCycle = service.billingCycle ?? service.billing;

  const toggleAddon = (label) => {
    setSelectedAddons((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  };

  const selectedAddonObjects = addonOptions.filter((option) => selectedAddons.includes(getAddonLabel(option)));

  const addonsTotal = selectedAddonObjects.reduce((sum, option) => {
    const price = getAddonPrice(option);
    return sum + (typeof price === 'number' ? price : 0);
  }, 0);

  const estimatedTotal = (typeof service.price === 'number' ? service.price : 0) + addonsTotal;

  const handleAddToOrder = () => {
    addToCart(service, configuration, selectedAddonObjects.length ? selectedAddonObjects : []);
    navigate('/checkout');
  };

  return (
    <div className="space-y-7">
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link to="/services" className="font-semibold transition hover:text-[color:var(--accent)]">
          Catalog
        </Link>
        <span>/</span>
        <span className="text-slate-400">{service.category}</span>
        <span>/</span>
        <span className="truncate font-semibold text-slate-300">{service.name}</span>
      </nav>

      <section className="store-detail-hero">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="store-detail-hero__icon">
            <Icon size={32} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{service.category}</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{service.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85">{service.description}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {configurationOptions.length ? (
            <div className="store-panel">
              <h2 className="text-lg font-bold text-slate-900">Choose your plan</h2>
              <p className="mt-1 text-sm text-slate-500">Select the configuration that fits your needs.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {configurationOptions.map((option) => {
                  const label = getOptionLabel(option);
                  const isActive = label === configuration;

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setConfiguration(label)}
                      className={`store-option ${isActive ? 'is-active' : ''}`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          isActive ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white' : 'border-slate-300 text-transparent'
                        }`}
                      >
                        <Check size={12} />
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {addonOptions.length ? (
            <div className="store-panel">
              <h2 className="text-lg font-bold text-slate-900">Recommended add-ons</h2>
              <p className="mt-1 text-sm text-slate-500">Boost your service with optional extras.</p>

              <div className="mt-4 space-y-3">
                {addonOptions.map((option) => {
                  const label = getAddonLabel(option);
                  const price = getAddonPrice(option);
                  const cycleLabel = getAddonBillingCycleLabel(getAddonBillingCycle(option, fallbackCycle), '');
                  const isChecked = selectedAddons.includes(label);

                  return (
                    <label key={label} className={`store-option ${isChecked ? 'is-active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAddon(label)}
                        className="h-4 w-4 shrink-0 accent-[color:var(--accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-800">{label}</span>
                        {cycleLabel ? <span className="block text-xs text-slate-500">{cycleLabel}</span> : null}
                      </span>
                      {typeof price === 'number' ? (
                        <span className="shrink-0 text-sm font-bold text-slate-900">{formatCurrency(price)}</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {configurationOptions.length ? (
            <div className="store-panel">
              <h2 className="text-lg font-bold text-slate-900">What's included</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {configurationOptions.map((option) => (
                  <div key={getOptionLabel(option)} className="store-feature-row">
                    <CheckCircle2 size={17} />
                    <span>{getOptionLabel(option)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="store-panel">
            <p className="store-card__price-label">Starting price</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">
              {formatCurrency(service.price)}
              <span className="text-sm font-semibold text-slate-500"> /{formatBillingLabel(fallbackCycle)}</span>
            </p>

            <div className="mt-5 space-y-3 border-t border-dashed border-slate-300 pt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Plan</span>
                <span className="font-semibold text-slate-800">{configuration || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Add-ons</span>
                <span className="font-semibold text-slate-800">
                  {selectedAddons.length ? `${selectedAddons.length} selected` : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold text-slate-700">Estimated total</span>
                <span className="font-extrabold text-slate-900">{formatCurrency(estimatedTotal)}</span>
              </div>
            </div>

            <button type="button" onClick={handleAddToOrder} className="btn-primary mt-5 w-full gap-2">
              <ShoppingCart size={17} /> Add to Order
            </button>
            <Link to="/services" className="btn-secondary mt-3 w-full gap-2">
              <ArrowLeft size={16} /> Continue browsing
            </Link>
          </div>
        </div>
      </div>

      {relatedServices.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950">More in {service.category}</h2>
            <Link to="/services" className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--accent)]">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedServices.map((related) => {
              const RelatedIcon = getCategoryIcon(related.category);

              return (
                <Link key={related.id} to={`/services/${related.id}`} className="store-card group">
                  <span className="store-card__icon">
                    <RelatedIcon size={22} />
                  </span>
                  <h3 className="store-card__title mt-3 text-base">{related.name}</h3>
                  <p className="store-card__desc">{related.description}</p>
                  <div className="store-card__footer">
                    <p className="store-card__price text-xl">{formatCurrency(related.price)}</p>
                    <span className="store-card__cta">
                      <Plus size={14} /> View
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="store-sticky-bar -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{service.name}</p>
            <p className="text-xs font-semibold text-slate-500">{formatCurrency(estimatedTotal)} estimated total</p>
          </div>
          <button type="button" onClick={handleAddToOrder} className="btn-primary shrink-0 rounded-full gap-2">
            <ShoppingCart size={16} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
