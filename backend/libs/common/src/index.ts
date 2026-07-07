export { MongoModule } from './mongo/mongo.module';
export type { MongoConnectionName } from './mongo/mongo.module';
export { RedisModule } from './redis/redis.module';
export { TelemetryService, mergeTimeSeries } from './redis/telemetry.service';
export type { ApiEvent, MetricPoint } from './redis/telemetry.service';
export { DATABASE_CONNECTION, LOGS_DATABASE_CONNECTION } from './mongo/mongo.types';
export type { CharacterDocument, EventLogDocument } from './mongo/mongo.types';
export {
  EVENTS_STREAM,
  EVENTS_MAX_LEN,
  TS_METRICS_PREFIX,
  TS_RETENTION_MS,
  getMongoUri,
  getLogsMongoUri,
  getRedisUrl,
} from './config/app.config';
