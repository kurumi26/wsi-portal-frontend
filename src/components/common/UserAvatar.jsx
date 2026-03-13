import { useEffect, useState } from 'react';

export default function UserAvatar({ user, size = 'h-10 w-10', textSize = 'text-base' }) {
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? '?';
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [user?.profilePhotoUrl]);

  if (user?.profilePhotoUrl && !hasImageError) {
    return (
      <img
        src={user.profilePhotoUrl}
        alt={user.name ?? 'User avatar'}
        className={`${size} rounded-full object-cover ring-1 ring-white/10`}
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <div className={`flex ${size} items-center justify-center rounded-full bg-sky-400/15 font-semibold text-sky-300 ${textSize}`}>
      {initial}
    </div>
  );
}
