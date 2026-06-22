const TAKEN_BASE_NAMES = new Set([
  'sample',
  'google',
  'facebook',
  'amazon',
  'test',
  'jay',
  'example',
  'wsi',
  'webfocus',
]);

export function normalizeBaseName(input) {
  const raw = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '');

  if (!raw) {
    return 'my-business';
  }

  const withoutExt = raw.includes('.') ? raw.split('.')[0] : raw;

  return withoutExt.replace(/[^a-z0-9-]/g, '') || 'my-business';
}

export function buildFullDomain(baseName, ext) {
  const base = normalizeBaseName(baseName);
  const extension = ext.startsWith('.') ? ext : `.${ext}`;
  return `${base}${extension}`;
}

export function parseDomainFromQuery(query) {
  const raw = String(query ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];

  if (!raw) {
    return { baseName: 'my-business', ext: '.com', fullDomain: 'my-business.com' };
  }

  if (raw.includes('.')) {
    const parts = raw.split('.');
    const baseName = parts[0].replace(/[^a-z0-9-]/g, '') || 'my-business';
    const ext = `.${parts.slice(1).join('.')}`;
    return { baseName, ext, fullDomain: `${baseName}${ext}` };
  }

  const baseName = raw.replace(/[^a-z0-9-]/g, '') || 'my-business';
  return { baseName, ext: '.com', fullDomain: `${baseName}.com` };
}

export function isDomainAvailable(baseName, ext) {
  const base = normalizeBaseName(baseName);
  const full = buildFullDomain(base, ext).toLowerCase();

  if (TAKEN_BASE_NAMES.has(base)) {
    return false;
  }

  if (full.includes('swift')) {
    return true;
  }

  let checksum = 0;
  for (let index = 0; index < full.length; index += 1) {
    checksum += full.charCodeAt(index);
  }

  return checksum % 4 === 0;
}

export function generateSuggestedDomains(baseName, extensions) {
  const base = normalizeBaseName(baseName);

  const suggestedTemplates = [
    { prefix: '', suffix: '.com.ph', price: 1500, tier: 'suggested' },
    { prefix: '', suffix: '.io', price: 4500, tier: 'suggested' },
    { prefix: 'get', suffix: '.com', price: 1200, tier: 'suggested' },
    { prefix: 'my', suffix: '.com', price: 1200, tier: 'suggested' },
    { prefix: 'the', suffix: '.com', price: 1200, tier: 'suggested' },
    { prefix: 'swift', suffix: '.com', price: 1200, tier: 'premium' },
    { prefix: 'go', suffix: '.com', price: 1200, tier: 'premium' },
    { prefix: 'try', suffix: '.com', price: 1200, tier: 'premium' },
    { prefix: '', suffix: '.co', price: 1500, tier: 'premium' },
    { prefix: '', suffix: '.net', price: 1500, tier: 'premium' },
  ];

  const extensionResults = extensions.map((item) => ({
    domain: buildFullDomain(base, item.ext),
    ext: item.ext,
    price: item.price,
    tier: 'extension',
    available: isDomainAvailable(base, item.ext),
    isNew: item.isNew ?? false,
  }));

  const templateResults = suggestedTemplates.map((template) => {
    const domainName = `${template.prefix}${base}${template.suffix}`;
    const ext = template.suffix;
    return {
      domain: domainName,
      ext,
      price: template.price,
      tier: template.tier,
      available: isDomainAvailable(`${template.prefix}${base}`, ext),
      isNew: false,
    };
  });

  return [...extensionResults, ...templateResults];
}
