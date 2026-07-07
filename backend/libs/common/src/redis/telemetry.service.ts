import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import {
  EVENTS_MAX_LEN,
  EVENTS_STREAM,
  TS_METRICS_PREFIX,
  TS_RETENTION_MS,
  getRedisUrl,
} from '../config/app.config';

export interface ApiEvent {
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
}

/** TS.MRANGE returns [key, labels, [[ts, value], ...]] per series; sum them per bucket. */
export function mergeTimeSeries(raw: unknown): MetricPoint[] {
  const buckets = new Map<number, number>();
  if (!Array.isArray(raw)) return [];

  for (const series of raw) {
    if (!Array.isArray(series) || series.length < 3) continue;
    const datapoints = series[2];
    if (!Array.isArray(datapoints)) continue;
    for (const point of datapoints) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const ts = Number(point[0]);
      const value = Number.parseFloat(String(point[1]));
      if (!Number.isFinite(ts) || !Number.isFinite(value)) continue;
      buckets.set(ts, (buckets.get(ts) ?? 0) + value);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, value]) => ({ timestamp, value }));
}

/**
 * Telemetry over Redis: per-action RedisTimeSeries metrics and a durable
 * event stream. Recording is fire-and-forget by design — an unavailable Redis
 * must degrade telemetry, never break the business request path.
 */
@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryService.name);
  private client!: RedisClientType;

  onModuleInit() {
    this.client = createClient({ url: getRedisUrl() });
    this.client.on('error', (err: Error) => this.logger.warn(`Redis: ${err.message}`));
    // Do not block or fail bootstrap: the client keeps reconnecting in background.
    this.client.connect().catch((err: Error) => {
      this.logger.error(`Initial Redis connection failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  /** Increments the per-action time series. Never throws; drops the sample if Redis is down. */
  async recordMetric(action: string): Promise<void> {
    if (!this.client.isReady) {
      this.logger.warn(`recordMetric(${action}) dropped: Redis is not connected`);
      return;
    }
    try {
      // ON_DUPLICATE SUM makes concurrent same-millisecond samples additive
      // instead of failing with a duplicate-policy error.
      await this.client.sendCommand([
        'TS.ADD',
        this.metricKey(action),
        Date.now().toString(),
        '1',
        'RETENTION',
        TS_RETENTION_MS.toString(),
        'ON_DUPLICATE',
        'SUM',
        'LABELS',
        'service',
        'a',
        'action',
        action,
      ]);
    } catch (err) {
      this.logger.warn(`recordMetric(${action}) failed: ${(err as Error).message}`);
    }
  }

  /** Appends an event to the durable stream. Never throws; logs and drops if Redis is down. */
  async publishEvent(eventType: string, payload: Record<string, unknown> = {}): Promise<void> {
    if (!this.client.isReady) {
      this.logger.warn(`publishEvent(${eventType}) dropped: Redis is not connected`);
      return;
    }
    try {
      await this.client.xAdd(
        EVENTS_STREAM,
        '*',
        {
          type: eventType,
          timestamp: new Date().toISOString(),
          payload: JSON.stringify(payload),
        },
        { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: EVENTS_MAX_LEN } },
      );
    } catch (err) {
      this.logger.warn(`publishEvent(${eventType}) failed: ${(err as Error).message}`);
    }
  }

  /**
   * Aggregated request counts (sum per bucket) across all action series,
   * optionally filtered by action. Throws if Redis is unavailable — callers
   * (report API) must surface that instead of inventing data.
   */
  async getMetricsRange(
    fromMs: number,
    toMs: number,
    bucketMs: number,
    action?: string,
  ): Promise<MetricPoint[]> {
    // Fail fast: while disconnected, node-redis queues commands instead of
    // rejecting them, which would hang the report request until the HTTP
    // client gives up rather than surfacing a 503.
    if (!this.client?.isReady) {
      throw new Error('Redis is not connected');
    }
    const filter = action ? `action=${action}` : 'service=a';
    const raw = (await this.client.sendCommand([
      'TS.MRANGE',
      fromMs.toString(),
      toMs.toString(),
      'AGGREGATION',
      'sum',
      bucketMs.toString(),
      'FILTER',
      filter,
    ])) as unknown;

    return mergeTimeSeries(raw);
  }

  getClient(): RedisClientType {
    return this.client;
  }

  private metricKey(action: string): string {
    return `${TS_METRICS_PREFIX}:${action.replace(/\s+/g, '_')}`;
  }
}
