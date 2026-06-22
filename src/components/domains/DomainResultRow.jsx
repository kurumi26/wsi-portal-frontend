import { formatCurrency } from '../../utils/format';

export default function DomainResultRow({ domain, price, available, onAddToCart }) {
  return (
    <div className="domain-result-row">
      <span className="domain-result-row__name">{domain}</span>
      <span className="domain-result-row__price">from: {formatCurrency(price)}</span>
      {available ? (
        <button type="button" onClick={onAddToCart} className="domain-result-row__cta domain-result-row__cta--available">
          + ADD TO CART
        </button>
      ) : (
        <button type="button" disabled className="domain-result-row__cta domain-result-row__cta--taken">
          TAKEN
        </button>
      )}
    </div>
  );
}
