import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Resilient lazy loader with automatic reload on stale chunk deployment or network glitch.
 * When Vite deploys a new build, chunk hashes change. If a client is running an old index.html,
 * dynamic imports of missing chunks throw "Failed to fetch dynamically imported module".
 * This helper automatically performs a hard reload once to pull the latest index.html manifest.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    const key = `smileclinic_chunk_retry_${chunkName}`;
    try {
      const component = await factory();
      sessionStorage.removeItem(key);
      return component;
    } catch (error: any) {
      const msg = error?.message || '';
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('dynamically imported module') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError) {
        const hasRetried = sessionStorage.getItem(key);
        if (!hasRetried) {
          sessionStorage.setItem(key, 'true');
          console.warn(`[Auto-Recovery] Detected stale chunk '${chunkName}'. Refreshing to fetch new version.`);
          window.location.reload();
          // Return an unresolved promise while the browser performs the reload
          return new Promise<{ default: T }>(() => {});
        }
      }

      // If already reloaded once and still failing, throw to ErrorBoundary
      sessionStorage.removeItem(key);
      throw error;
    }
  });
}

