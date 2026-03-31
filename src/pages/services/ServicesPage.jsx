import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import ServiceCard from '../../components/common/ServiceCard';
import { usePortal } from '../../context/PortalContext';

export default function ServicesPage() {
  const navigate = useNavigate();
  const { services, addToCart } = usePortal();
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(
      services.map((service) => [service.id, { configuration: service.configurations[0] ?? '', addon: '' }]),
    ),
  );
  const [category, setCategory] = useState('All');

  const categories = useMemo(() => ['All', ...new Set(services.map((service) => service.category))], [services]);
  const filteredServices = useMemo(
    () => (category === 'All' ? services : services.filter((service) => service.category === category)),
    [category, services],
  );

  const handleConfigure = (serviceId, field, value) => {
    setSelections((current) => ({
      ...current,
      [serviceId]: {
        ...current[serviceId],
        [field]: value,
      },
    }));
  };

  const handleAdd = (service) => {
    const selection = selections[service.id];
    addToCart(service, selection.configuration, selection.addon);
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
            addon={selections[service.id]?.addon ?? ''}
            onConfigure={handleConfigure}
            onAdd={handleAdd}
          />
        ))}
      </div>
    </div>
  );
}
