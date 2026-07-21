export { MongoModule } from './mongo/mongo.module';
export type { MongoConnectionName } from './mongo/mongo.module';
export { RedisModule } from './redis/redis.module';
export { TelemetryService, mergeTimeSeries } from './redis/telemetry.service';
export type { ApiEvent, MetricPoint } from './redis/telemetry.service';
export { DATABASE_CONNECTION } from './mongo/mongo.types';
export type { CharacterDocument } from './mongo/mongo.types';
export {
  EVENTS_STREAM,
  EVENTS_MAX_LEN,
  TS_METRICS_PREFIX,
  TS_RETENTION_MS,
  getMongoUri,
  getRedisUrl,
} from './config/app.config';
