import { normalizeTelemetryAction } from './normalize-telemetry-action';

describe('normalizeTelemetryAction', () => {
  it('strips the /api prefix and query string from request.url', () => {
    expect(
      normalizeTelemetryAction({
        method: 'get',
        url: '/api/search?q=rick&page=1&limit=20',
      }),
    ).toBe('GET /search');
  });

  it('prefers route.path when Nest provides it', () => {
    expect(
      normalizeTelemetryAction({
        method: 'POST',
        url: '/api/ingestion/fetch/json',
        route: { path: '/ingestion/fetch/json' },
      }),
    ).toBe('POST /ingestion/fetch/json');
  });

  it('uses request.path when available', () => {
    expect(
      normalizeTelemetryAction({
        method: 'GET',
        url: '/api/search?q=morty',
        path: '/api/search',
      }),
    ).toBe('GET /search');
  });
});
