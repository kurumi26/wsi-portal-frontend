import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import DomainSearchResults from '../../components/domains/DomainSearchResults';
import { heroExtensionPills } from '../../data/domainExtensions';
import { buildFullDomain, normalizeBaseName } from '../../utils/domainSearch';

export { domainExtensions } from '../../data/domainExtensions';

export default function DomainsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchedDomain = searchParams.get('domain');

  const [domainQuery, setDomainQuery] = useState(searchedDomain || '');
  const [selectedPill, setSelectedPill] = useState('.com');
  const [showMorePills, setShowMorePills] = useState(false);

  useEffect(() => {
    if (searchedDomain) {
      setDomainQuery(searchedDomain);
    }
  }, [searchedDomain]);

  const handleSearch = () => {
    const baseName = normalizeBaseName(domainQuery);
    const fullDomain = domainQuery.includes('.')
      ? domainQuery.trim().toLowerCase()
      : buildFullDomain(baseName, selectedPill);

    setSearchParams({ domain: fullDomain });
  };

  const applyPill = (ext) => {
    setSelectedPill(ext);
    const base = normalizeBaseName(domainQuery);
    setDomainQuery(buildFullDomain(base, ext));
  };

  const visiblePills = showMorePills ? [...heroExtensionPills, '.com.ph', '.io', '.xyz'] : heroExtensionPills;

  return (
    <div className="domain-page">
      <section className={`domain-hero ${searchedDomain ? '' : 'domain-hero--landing'}`}>
        <div className="domain-page__container">
          <p className="domain-hero__eyebrow">DOMAIN REGISTRATION</p>
          <h1 className="domain-hero__title">Find your perfect domain name</h1>
          <p className="domain-hero__subtitle">
            Search and register your domain with WebFocus Solutions, Inc. Secure your brand online with trusted local and global extensions.
          </p>

          <div className="domain-hero__search">
            <label className="domain-hero__search-field">
              <Search size={20} className="domain-hero__search-icon" />
              <input
                value={domainQuery}
                onChange={(event) => setDomainQuery(event.target.value)}
                placeholder="Type the domain you want"
                className="domain-hero__search-input"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
            </label>
            <button type="button" onClick={handleSearch} className="domain-hero__search-btn">
              Search Domains
            </button>
          </div>

          <div className="domain-hero__pills">
            {visiblePills.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => applyPill(item)}
                className={`domain-hero__pill ${selectedPill === item ? 'is-active' : ''}`}
              >
                {item}
              </button>
            ))}
            {!showMorePills ? (
              <button type="button" onClick={() => setShowMorePills(true)} className="domain-hero__pill domain-hero__pill--outline">
                + View More
              </button>
            ) : null}
          </div>

          <p className="domain-hero__note">
            Domain availability is checked in real time. Final pricing confirmed at checkout.
          </p>
        </div>
      </section>

      {searchedDomain ? (
        <section className="domain-page__results">
          <div className="domain-page__container">
            <DomainSearchResults
              domain={searchedDomain}
              onDomainChange={(nextDomain) => setSearchParams({ domain: nextDomain })}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
