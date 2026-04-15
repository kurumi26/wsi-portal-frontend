import { useEffect, useMemo, useState } from 'react';
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

export default function ServicesPage() {
  const navigate = useNavigate();
  const { services, addToCart } = usePortal();
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(
      services.map((service) => [service.id, getDefaultSelection(service)]),
    ),
  );
  const [category, setCategory] = useState('All');

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
  const filteredServices = useMemo(
    () => (category === 'All' ? services : services.filter((service) => service.category === category)),
    [category, services],
  );

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
        action={
          <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
