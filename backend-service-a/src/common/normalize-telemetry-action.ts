/**
 * Normalizes an HTTP request into a stable telemetry action label.
 * Strips the global `/api` prefix and query string so labels match report filters
 * (e.g. `GET /search`, not `GET /api/search?q=rick&page=1`).
 */
export function normalizeTelemetryAction(request: {
  method: string;
  url: string;
  path?: string;
  route?: { path: string };
}): string {
  const rawPath = request.route?.path ?? request.path ?? request.url.split('?')[0] ?? '';
  const withoutPrefix = rawPath.replace(/^\/api(?=\/|$)/, '') || rawPath;
  return `${request.method.toUpperCase()} ${withoutPrefix}`;
}
