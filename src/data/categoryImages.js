/** Stock imagery for popular pick cards. */
export const POPULAR_PICK_IMAGES = {
  Business: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
  'Country Level Domains': 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
  Dedicated_BareMetal_Linux: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80',
};

export const DEFAULT_POPULAR_PICK_IMAGE = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80';

export function getPopularPickImage(service) {
  const name = String(service?.name ?? '').trim();
  if (POPULAR_PICK_IMAGES[name]) {
    return POPULAR_PICK_IMAGES[name];
  }

  const normalized = name.toLowerCase();
  const match = Object.entries(POPULAR_PICK_IMAGES).find(
    ([key]) => key.toLowerCase() === normalized,
  );

  return match?.[1] ?? DEFAULT_POPULAR_PICK_IMAGE;
}
