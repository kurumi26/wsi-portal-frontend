export const heroExtensionPills = ['.ph', '.com', '.co', '.net', '.org', '.shop', '.ai'];

export const primaryExtensions = [
  { ext: '.ph', price: 1200, isNew: false },
  { ext: '.com', price: 1200, isNew: false },
  { ext: '.co', price: 1500, isNew: false },
  { ext: '.net', price: 1500, isNew: false },
  { ext: '.org', price: 1500, isNew: false },
  { ext: '.shop', price: 1200, isNew: true },
  { ext: '.ai', price: 7999, isNew: false },
];

export const additionalExtensions = [
  { ext: '.com.ph', price: 1500, isNew: false },
  { ext: '.io', price: 4500, isNew: false },
  { ext: '.xyz', price: 1200, isNew: true },
  { ext: '.info', price: 1500, isNew: false },
  { ext: '.biz', price: 1500, isNew: false },
];

export const allExtensions = [...primaryExtensions, ...additionalExtensions];

/** @deprecated Use primaryExtensions — kept for imports that expect domainExtensions shape */
export const domainExtensions = primaryExtensions.map((item) => ({
  ext: item.ext,
  price: item.price,
  description: `Register your ${item.ext} domain with WSI.`,
  oldPrice: item.price * 2.5,
}));
