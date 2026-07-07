// Defaults target a local unauthenticated MongoDB; real deployments (incl. the
// provided docker-compose) must pass full URIs via environment — no credentials in code.
export function getMongoUri(): string {
  return process.env.MONGO_URI || 'mongodb://localhost:27017/fs_assignment';
}

export function getLogsMongoUri(): string {
  return (
    process.env.LOGS_MONGO_URI ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017/fs_assignment_logs'
  );
}

export function getRedisUrl(): string {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  return `redis://${host}:${port}`;
}

/** Durable event stream (Redis Streams): Service B reads it with a consumer group. */
export const EVENTS_STREAM = 'service-a:events';
export const EVENTS_MAX_LEN = 10_000;

/** Every API action gets its own time series key so per-type filtering works. */
export const TS_METRICS_PREFIX = 'api:metrics';
export const TS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
