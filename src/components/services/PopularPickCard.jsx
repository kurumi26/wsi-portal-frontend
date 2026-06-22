import { useState } from 'react';
import { formatCurrency } from '../../utils/format';
import { DEFAULT_POPULAR_PICK_IMAGE, getPopularPickImage } from '../../data/categoryImages';

const formatBillingCycleLabel = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) return 'flexible';
  if (normalized === 'one_time' || normalized === 'onetime') return 'one-time';
  return normalized.replace(/_/g, ' ');
};

const formatServiceDisplayText = (value) => String(value ?? '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export default function PopularPickCard({ service, onViewPlans, isActive }) {
  const displayName = formatServiceDisplayText(service.name);
  const billingLabel = formatBillingCycleLabel(service.billingCycle ?? service.billing);
  const preferredImage = getPopularPickImage(service);
  const [imageUrl, setImageUrl] = useState(preferredImage);

  return (
    <article className={`popular-pick-card ${isActive ? 'is-active' : ''}`}>
      <div className="popular-pick-card__visual">
        <img
          src={imageUrl}
          alt={displayName}
          className="popular-pick-card__image"
          loading="lazy"
          onError={() => setImageUrl(DEFAULT_POPULAR_PICK_IMAGE)}
        />
      </div>
      <div className="popular-pick-card__content">
        <p className="popular-pick-card__category">{service.category}</p>
        <h2 className="popular-pick-card__title">{displayName}</h2>
        <div className="popular-pick-card__pricing">
          <p className="popular-pick-card__price-label">STARTING AT</p>
          <p className="popular-pick-card__price">
            {formatCurrency(service.price)}
            <span> /{billingLabel}</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onViewPlans?.(service)}
        className="popular-pick-card__cta"
      >
        View Plans
      </button>
    </article>
  );
}
