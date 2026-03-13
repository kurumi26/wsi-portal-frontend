import { useEffect } from 'react';

export default function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | WSI Service Portal` : 'WSI Service Portal';
    return () => {
      document.title = previous;
    };
  }, [title]);
}
