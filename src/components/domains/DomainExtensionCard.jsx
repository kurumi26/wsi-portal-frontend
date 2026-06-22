import { formatCurrency } from '../../utils/format';

export default function DomainExtensionCard({ ext, price, available, isNew, onAction }) {
  return (
    <article className="domain-ext-card">
      {isNew ? <span className="domain-ext-card__badge">NEW</span> : null}
      <div className="domain-ext-card__body">
        <p className="domain-ext-card__tld">{ext}</p>
        <p className="domain-ext-card__price">
          from: <span>{formatCurrency(price)}</span>
        </p>
      </div>
      {available ? (
        <button type="button" onClick={onAction} className="domain-ext-card__cta domain-ext-card__cta--available">
          + ADD TO CART
        </button>
      ) : (
        <button type="button" disabled className="domain-ext-card__cta domain-ext-card__cta--taken">
          TAKEN
        </button>
      )}
    </article>
  );
}
