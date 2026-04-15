import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import ServiceCard from '../../components/common/ServiceCard';
import { usePortal } from '../../context/PortalContext';
import { getAddonLabel } from '../../utils/addons';

const getDefaultSelection = (service) => ({
  configuration: service.configurations[0] ?? '',
  addon: [],
});

const resolveSelectedAddons = (service, selectedAddons) => {
  const addonValues = Array.isArray(selectedAddons)
    ? selectedAddons
    : selectedAddons
      ? [selectedAddons]
      : [];

  return addonValues.map((addonValue) => {
    const matchedAddon = Array.isArray(service?.addons)
      ? service.addons.find((option) => getAddonLabel(option) === getAddonLabel(addonValue))
      : null;

    return matchedAddon ?? addonValue;
  });
};

const getConfigurationLabel = (option) => {
  if (option === null || option === undefined) {
    return '';
  }

  return typeof option === 'object'
    ? option.label ?? option.name ?? JSON.stringify(option)
    : String(option);
};

export default function ServicesPage() {
  const navigate = useNavigate();
  const { services, addToCart } = usePortal();
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(
      services.map((service) => [service.id, getDefaultSelection(service)]),
    ),
  );
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSelections((current) => {
      const next = { ...current };

      services.forEach((service) => {
        if (!next[service.id]) {
          next[service.id] = getDefaultSelection(service);
          return;
        }

        next[service.id] = {
          configuration: next[service.id].configuration ?? service.configurations[0] ?? '',
          addon: Array.isArray(next[service.id].addon)
            ? next[service.id].addon
            : next[service.id].addon
              ? [next[service.id].addon]
              : [],
        };
      });

      return next;
    });
  }, [services]);

  const categories = useMemo(() => ['All', ...new Set(services.map((service) => service.category))], [services]);
  const filteredServices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory = category === 'All' || service.category === category;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        service.name,
        service.description,
        service.category,
        ...(Array.isArray(service?.configurations) ? service.configurations.map((option) => getConfigurationLabel(option)) : []),
        ...(Array.isArray(service?.addons) ? service.addons.map((option) => getAddonLabel(option)) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [category, searchQuery, services]);

  const handleConfigure = (serviceId, field, value) => {
    setSelections((current) => ({
      ...current,
      [serviceId]: {
        ...(current[serviceId] ?? { configuration: '', addon: [] }),
        [field]: value,
      },
    }));
  };

  const handleAdd = (service) => {
    const selection = selections[service.id] ?? getDefaultSelection(service);
    addToCart(service, selection.configuration, resolveSelectedAddons(service, selection.addon));
    navigate('/checkout');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Service Catalog"
        title="Browse products & services"
        description="Offer domains, hosting, security, and add-on services with configuration options and a direct add-to-order flow."
        belowDescription={
          <label className="relative block w-full max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="input pl-11"
              placeholder="Search services, add-ons, or categories"
              aria-label="Search products and services"
            />
          </label>
        }
        action={
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={item === category ? 'btn-primary' : 'btn-secondary'}
              >
                {item}
              </button>
            ))}
          </div>
        }
      />

      {filteredServices.length ? (
        <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              configuration={selections[service.id]?.configuration ?? (service.configurations[0] ?? '')}
              addon={selections[service.id]?.addon ?? []}
              onConfigure={handleConfigure}
              onAdd={handleAdd}
            />
          ))}
        </div>
      ) : (
        <div className="panel rounded-3xl px-6 py-10 text-center">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-500">No matches found</p>
          <p className="mt-3 text-base text-slate-400">Try a different keyword or switch the category filter.</p>
        </div>
      )}
    </div>
  );
}
