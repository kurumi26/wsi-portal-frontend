import { formatDate } from './format';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const EXPIRING_SOON_DAYS = 7;

const getRenewalTimestamp = (value) => {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
};

export const formatRenewalTimeRemaining = (value, now = Date.now()) => {
  const renewalTime = getRenewalTimestamp(value);

  if (renewalTime == null) {
    return 'Waiting for admin schedule.';
  }

  const ms = renewalTime - now;

  if (ms <= 0) {
    return 'Expired';
  }

  const days = Math.floor(ms / DAY_MS);
  if (days >= 1) {
    return `${days} day${days > 1 ? 's' : ''} left`;
  }

  const hours = Math.floor(ms / HOUR_MS);
  if (hours >= 1) {
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
  }

  const minutes = Math.max(1, Math.ceil(ms / MINUTE_MS));
  return `${minutes} minute${minutes > 1 ? 's' : ''} left`;
};

export const formatRenewalCountdownTimer = (value, now = Date.now()) => {
  const renewalTime = getRenewalTimestamp(value);

  if (renewalTime == null) {
    return 'Not scheduled';
  }

  const ms = renewalTime - now;

  if (ms <= 0) {
    return 'Expired';
  }

  const totalMinutes = Math.max(1, Math.ceil(ms / MINUTE_MS));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return [days, hours, minutes]
    .map((part, index) => `${String(part).padStart(2, '0')}${['d', 'h', 'm'][index]}`)
    .join(' ');
};

export const hasRenewalCountdown = (service) => getRenewalTimestamp(service?.renewsOn) != null && service?.status !== 'Undergoing Provisioning';

export const isServiceExpiringSoon = (service, now = Date.now()) => {
  const renewalTime = getRenewalTimestamp(service?.renewsOn);

  if (renewalTime == null || service?.status === 'Undergoing Provisioning' || service?.status === 'Unpaid') {
    return false;
  }

  const ms = renewalTime - now;

  return ms > 0 && ms <= EXPIRING_SOON_DAYS * DAY_MS;
};

export const getServiceDisplayStatus = (service, now = Date.now()) => {
  if (!service || typeof service !== 'object') {
    return service?.status ?? 'Unknown';
  }

  if (service.status === 'Undergoing Provisioning' || service.status === 'Unpaid') {
    return service.status;
  }

  const renewalTime = getRenewalTimestamp(service?.renewsOn);

  if (renewalTime != null) {
    if (renewalTime <= now) {
      return 'Expired';
    }

    if (isServiceExpiringSoon(service, now)) {
      return 'Expiring Soon';
    }

    if (service.status === 'Expired') {
      return 'Active';
    }
  }

  return service.status ?? 'Unknown';
};

export const getRenewalCountdownMeta = (service) => {
  if (hasRenewalCountdown(service)) {
    return {
      label: 'Renews',
      value: service.renewsOn,
      helper: '',
      isInteractive: true,
    };
  }

  if (service?.status === 'Undergoing Provisioning') {
    return {
      label: 'Renewal Schedule',
      value: 'Shown after setup',
      helper: 'Your renewal date will appear once this service is live.',
      isInteractive: false,
    };
  }

  return {
    label: 'Renewal Schedule',
    value: 'Not scheduled',
    helper: 'Waiting for admin schedule.',
    isInteractive: false,
  };
};

export const getAdminServiceExpirationMeta = (service, now = Date.now()) => {
  if (hasRenewalCountdown(service)) {
    const countdown = formatRenewalTimeRemaining(service.renewsOn, now);

    return {
      label: 'Plan Expiry',
      value: countdown,
      helper: formatDate(service.renewsOn),
      isExpired: countdown === 'Expired',
    };
  }

  if (service?.status === 'Undergoing Provisioning') {
    return {
      label: 'Plan Expiry',
      value: 'Pending activation',
      helper: 'Shown after go-live.',
      isExpired: false,
    };
  }

  return {
    label: 'Plan Expiry',
    value: 'Not scheduled',
    helper: 'Waiting for schedule.',
    isExpired: false,
  };
};
