const cleanClientValue = (value) => {
  const normalized = String(value ?? '').trim();

  if (!normalized || normalized === '—' || normalized === '-') {
    return '';
  }

  return normalized;
};

const normalizeClientValue = (value) => cleanClientValue(value)
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getClientIdentityValues = (client) => [client?.company, client?.name]
  .map((value) => cleanClientValue(value))
  .filter(Boolean);

export const getClientDisplayName = (client, fallback = 'Unknown client') => {
  const displayValue = [client?.company, client?.name, client?.email]
    .map((value) => cleanClientValue(value))
    .find(Boolean);

  return displayValue ?? fallback;
};

export const clientMatchesRecord = (client, recordName = '', recordEmail = '') => {
  if (!client || typeof client !== 'object') {
    return false;
  }

  const normalizedRecordEmail = normalizeClientValue(recordEmail);
  const normalizedRecordName = normalizeClientValue(recordName);

  if (normalizedRecordEmail && normalizeClientValue(client.email) === normalizedRecordEmail) {
    return true;
  }

  if (!normalizedRecordName) {
    return false;
  }

  return getClientIdentityValues(client)
    .map((value) => normalizeClientValue(value))
    .includes(normalizedRecordName);
};

export const findClientByRecord = (clients = [], recordName = '', recordEmail = '') => {
  if (!Array.isArray(clients)) {
    return null;
  }

  return clients.find((client) => clientMatchesRecord(client, recordName, recordEmail)) ?? null;
};
