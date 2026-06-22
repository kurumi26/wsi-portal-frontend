import { CheckCircle2, Search } from 'lucide-react';

const defaultFeatures = [
  'Logo maker',
  'Create social posts',
  'Accept payments',
  'And much more...',
];

export default function ProductSearchHero({
  title = 'Find the right product for your business.',
  subtitle = 'Your WSI services come with tools to help you grow online.',
  placeholder = 'Search using your business name or desired product',
  searchQuery,
  onSearchQueryChange,
  onSearch,
  features = defaultFeatures,
  footerLink,
}) {
  return (
    <section className="product-search-hero">
      <h1 className="product-search-hero__title">{title}</h1>

      <form
        className="product-search-hero__form"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch?.();
        }}
      >
        <label className="product-search-hero__input-wrap">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={placeholder}
            aria-label="Search products"
            className="product-search-hero__input"
          />
        </label>
        <button type="submit" className="product-search-hero__submit" aria-label="Search">
          <Search size={22} />
        </button>
      </form>

      <p className="product-search-hero__subtitle">{subtitle}</p>

      <ul className="product-search-hero__features">
        {features.map((feature) => (
          <li key={feature}>
            <CheckCircle2 size={16} className="product-search-hero__check" />
            {feature}
          </li>
        ))}
      </ul>

      {footerLink ? (
        <div className="product-search-hero__footer">{footerLink}</div>
      ) : null}
    </section>
  );
}
