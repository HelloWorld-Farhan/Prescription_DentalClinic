import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Universal ScrollToTop component
 * Automatically resets browser window, html, and body scroll offsets to 0,0
 * whenever the user navigates between routes or alters search parameters.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}
