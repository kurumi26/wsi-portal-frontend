import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PopularPickCard from '../../components/services/PopularPickCard';
import ProductSearchHero from '../../components/services/ProductSearchHero';
import ServicePlansPanel from '../../components/services/ServicePlansPanel';
import { usePortal } from '../../context/PortalContext';
import { getAddonLabel } from '../../utils/addons';

const POPULAR_PICK_TARGETS = [
  { category: 'Shared Hosting', name: 'Business' },
  { category: 'Domains', name: 'Country Level Domains' },
  { category: 'Dedicated Server', name: 'Dedicated BareMetal_Linux' },
];

function getConfigurationLabel(option) {
  if (option === null || option === undefined) {
    return '';
  }

  return typeof option === 'object'
    ? option.label ?? option.name ?? JSON.stringify(option)
    : String(option);
}

function scrollToPlansPanel() {
  const panel = document.getElementById('service-plans-panel');
  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { services } = usePortal();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeServiceId, setActiveServiceId] = useState(searchParams.get('plan') || null);
  const [searchResultIds, setSearchResultIds] = useState(null);

  const popularPicks = useMemo(() => {
    const picks = POPULAR_PICK_TARGETS.map((target) =>
      services.find(
        (service) =>
          service.category === target.category
          && String(service.name).toLowerCase() === target.name.toLowerCase(),
      ),
    ).filter(Boolean);

    if (picks.length >= 3) {
      return picks;
    }

    const fallback = services.filter(
      (service) => !picks.some((pick) => String(pick.id) === String(service.id)),
    );

    return [...picks, ...fallback].slice(0, 3);
  }, [services]);

  const activeService = useMemo(
    () => services.find((service) => String(service.id) === String(activeServiceId)) ?? null,
    [activeServiceId, services],
  );

  const categoryPlans = useMemo(() => {
    if (!activeService) return [];
    return services.filter((service) => service.category === activeService.category);
  }, [activeService, services]);

  const searchPlans = useMemo(() => {
    if (!searchResultIds?.length) return [];
    return services.filter((service) => searchResultIds.includes(String(service.id)));
  }, [searchResultIds, services]);

  const showCategoryPanel = activeService && categoryPlans.length > 0;
  const showSearchPanel = searchResultIds !== null && searchResultIds.length > 0 && !activeServiceId;
  const showEmptySearch = searchParams.get('q') && searchResultIds !== null && searchResultIds.length === 0;

  useEffect(() => {
    const planId = searchParams.get('plan');
    const query = searchParams.get('q');

    if (planId) {
      setActiveServiceId(planId);
      setSearchResultIds(null);
      setTimeout(scrollToPlansPanel, 100);
      return;
    }

    if (query) {
      setSearchQuery(query);
      setActiveServiceId(null);
      const normalizedQuery = query.trim().toLowerCase();
      const matches = services.filter((service) => {
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
      setSearchResultIds(matches.map((service) => String(service.id)));
      setTimeout(scrollToPlansPanel, 100);
    }
  }, [searchParams, services]);

  const handleViewPlans = (service) => {
    setActiveServiceId(String(service.id));
    setSearchResultIds(null);
    setSearchParams({ plan: String(service.id) });
    setTimeout(scrollToPlansPanel, 100);
  };

  const handleProductSearch = () => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return;

    const matches = services.filter((service) => {
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

    setActiveServiceId(null);
    setSearchResultIds(matches.map((service) => String(service.id)));
    setSearchParams({ q: searchQuery.trim() });
    setTimeout(scrollToPlansPanel, 100);
  };

  const clearPanels = () => {
    setActiveServiceId(null);
    setSearchResultIds(null);
    setSearchParams({});
  };

  return (
    <div className="services-browse">
      <ProductSearchHero
        title="Find the right product for your business."
        subtitle="Your WSI services come with tools to help you grow online."
        placeholder="Search using your business name or desired product"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleProductSearch}
        features={[
          'Managed hosting and domains',
          'Secure checkout before login',
          'Local Philippine support',
          'And much more...',
        ]}
        footerLink={
          <Link to="/domains" className="product-search-hero__link">
            Go to Domain Manager
          </Link>
        }
      />

      {popularPicks.length > 0 ? (
        <section className="popular-picks-section">
          <div>
            <p className="popular-picks-heading">POPULAR PICKS</p>
            <h2 className="popular-picks-title">Get online faster</h2>
          </div>

          <div className="popular-picks-grid">
            {popularPicks.map((service) => (
              <PopularPickCard
                key={service.id}
                service={service}
                onViewPlans={handleViewPlans}
                isActive={String(service.id) === String(activeServiceId)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {showCategoryPanel ? (
        <ServicePlansPanel
          title={`All ${activeService.category} plans`}
          plans={categoryPlans}
          highlightId={activeServiceId}
          onClose={clearPanels}
        />
      ) : null}

      {showSearchPanel ? (
        <ServicePlansPanel
          title="Search results"
          plans={searchPlans}
          onClose={clearPanels}
        />
      ) : null}

      {showEmptySearch ? (
        <section className="service-plans-panel" id="service-plans-panel">
          <div className="service-plans-panel__header">
            <div>
              <h2 className="service-plans-panel__title">Search results</h2>
              <p className="service-plans-panel__subtitle">
                No products found for &quot;{searchQuery.trim()}&quot;
              </p>
            </div>
            <button type="button" onClick={clearPanels} className="service-plans-panel__close">
              Close
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default ServicesPage;
