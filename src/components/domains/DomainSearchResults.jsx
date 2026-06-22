import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DomainExtensionCard from './DomainExtensionCard';
import DomainResultRow from './DomainResultRow';
import { usePortal } from '../../context/PortalContext';
import { additionalExtensions, allExtensions, primaryExtensions } from '../../data/domainExtensions';
import {
  buildFullDomain,
  generateSuggestedDomains,
  isDomainAvailable,
  parseDomainFromQuery,
} from '../../utils/domainSearch';

const RESULT_TABS = [
  { id: 'results', label: 'Results' },
  { id: 'new', label: 'New Domains' },
  { id: 'international', label: 'International' },
];

export default function DomainSearchResults({ domain, onDomainChange }) {
  const navigate = useNavigate();
  const { services, addToCart, updateCartItem } = usePortal();
  const [searchInput, setSearchInput] = useState(domain);
  const [activeTab, setActiveTab] = useState('results');

  const { baseName, ext, fullDomain } = useMemo(
    () => parseDomainFromQuery(domain),
    [domain],
  );

  const primaryAvailable = isDomainAvailable(baseName, ext);

  const domainService = useMemo(
    () => services.find((service) => String(service.category).toLowerCase().includes('domain')) ?? services[0],
    [services],
  );

  const allResults = useMemo(
    () => generateSuggestedDomains(baseName, allExtensions),
    [baseName],
  );

  const extensionCards = useMemo(
    () => primaryExtensions.map((item) => ({
      ...item,
      available: isDomainAvailable(baseName, item.ext),
    })),
    [baseName],
  );

  const moreExtensionCards = useMemo(
    () => additionalExtensions.map((item) => ({
      ...item,
      available: isDomainAvailable(baseName, item.ext),
    })),
    [baseName],
  );

  const suggestedResults = useMemo(
    () => allResults.filter((item) => item.tier === 'suggested' || item.tier === 'extension'),
    [allResults],
  );

  const premiumResults = useMemo(
    () => allResults.filter((item) => item.tier === 'premium'),
    [allResults],
  );

  const newDomainResults = useMemo(
    () => allResults.filter((item) => item.ext === '.shop' || item.ext === '.xyz' || item.ext === '.ai'),
    [allResults],
  );

  const internationalResults = useMemo(
    () => allResults.filter((item) => item.ext.includes('.ph') || item.ext === '.io' || item.ext === '.co'),
    [allResults],
  );

  const handleSearchAgain = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    onDomainChange?.(trimmed);
  };

  const handleAddToCart = (domainName, price, extension) => {
    if (!domainService) return;

    const item = addToCart(
      {
        ...domainService,
        price,
        name: `${extension} Domain Registration`,
        category: 'Domains',
      },
      extension,
      [],
    );

    if (item?.lineId) {
      updateCartItem(item.lineId, { desiredDomain: domainName });
    }

    navigate('/checkout');
  };

  const tabResults = activeTab === 'new'
    ? newDomainResults
    : activeTab === 'international'
      ? internationalResults
      : null;

  return (
    <div className="domain-results space-y-5">
      <div className="domain-results__search-row">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="domain-results__search-input"
          aria-label="Search domain"
        />
        <button type="button" onClick={handleSearchAgain} className="domain-results__search-btn">
          SEARCH AGAIN
        </button>
      </div>

      <div className={`domain-results__status ${primaryAvailable ? 'is-available' : 'is-taken'}`}>
        <strong>{fullDomain}</strong>
        {primaryAvailable ? ' is available' : ' is not available'}
      </div>

      <div className="domain-ext-grid">
        {extensionCards.map((item) => (
          <DomainExtensionCard
            key={item.ext}
            ext={item.ext}
            price={item.price}
            available={item.available}
            isNew={item.isNew}
            onAction={() => handleAddToCart(buildFullDomain(baseName, item.ext), item.price, item.ext)}
          />
        ))}
      </div>

      <div className="domain-ext-grid domain-ext-grid--compact">
        {moreExtensionCards.map((item) => (
          <DomainExtensionCard
            key={item.ext}
            ext={item.ext}
            price={item.price}
            available={item.available}
            isNew={item.isNew}
            onAction={() => handleAddToCart(buildFullDomain(baseName, item.ext), item.price, item.ext)}
          />
        ))}
      </div>

      <section className="domain-results-panel">
        <div className="domain-results-tabs">
          {RESULT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`domain-results-tabs__btn ${activeTab === tab.id ? 'is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'results' ? (
          <div className="domain-results-columns">
            <div className="domain-results-column">
              <h2 className="domain-results-column__title">Suggested</h2>
              <div className="domain-results-list">
                {suggestedResults.map((item) => (
                  <DomainResultRow
                    key={item.domain}
                    domain={item.domain}
                    price={item.price}
                    available={item.available}
                    onAddToCart={() => handleAddToCart(item.domain, item.price, item.ext)}
                  />
                ))}
              </div>
            </div>

            <div className="domain-results-column">
              <h2 className="domain-results-column__title">Premium</h2>
              <div className="domain-results-list">
                {premiumResults.map((item) => (
                  <DomainResultRow
                    key={item.domain}
                    domain={item.domain}
                    price={item.price}
                    available={item.available}
                    onAddToCart={() => handleAddToCart(item.domain, item.price, item.ext)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="domain-results-single">
            <div className="domain-results-list">
              {tabResults?.map((item) => (
                <DomainResultRow
                  key={item.domain}
                  domain={item.domain}
                  price={item.price}
                  available={item.available}
                  onAddToCart={() => handleAddToCart(item.domain, item.price, item.ext)}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
