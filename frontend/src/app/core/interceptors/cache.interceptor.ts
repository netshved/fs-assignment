import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';

interface CacheEntry {
  expiry: number;
  response: HttpResponse<unknown>;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 100;

// Map preserves insertion order, so the first key is always the oldest — a
// re-inserted key on read gives simple LRU eviction with a bounded memory footprint.
const cache = new Map<string, CacheEntry>();

function get(key: string): HttpResponse<unknown> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiry <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.response;
}

function set(key: string, response: HttpResponse<unknown>) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expiry: Date.now() + TTL_MS, response });
}

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }

  const cached = get(req.urlWithParams);
  if (cached) {
    return of(cached.clone());
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && event.ok) {
        set(req.urlWithParams, event);
      }
    }),
  );
};
