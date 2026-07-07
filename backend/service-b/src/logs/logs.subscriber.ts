import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { EVENTS_STREAM, getRedisUrl } from '@fs-assignment/common';
import { LogsService } from './logs.service';

const CONSUMER_GROUP = 'service-b';
const CONSUMER_NAME = `service-b-${process.pid}`;
const READ_BLOCK_MS = 5000;
const READ_BATCH = 100;
const CONNECT_RETRY_MS = 5000;

/**
 * Consumes Service A events from a Redis Stream with a consumer group.
 * Unlike Pub/Sub, events published while Service B is down stay in the stream
 * and are delivered after restart; unacknowledged events are re-read first.
 */
@Injectable()
export class LogsSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogsSubscriberService.name);
  private client!: RedisClientType;
  private running = false;
  private groupReady = false;

  constructor(private readonly logsService: LogsService) {}

  async onModuleInit() {
    this.client = createClient({ url: getRedisUrl() });
    this.client.on('error', (err: Error) => this.logger.warn(`Redis: ${err.message}`));
    this.running = true;
    void this.runConsumerLoop();
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  private async runConsumerLoop() {
    while (this.running) {
      try {
        if (!this.client.isOpen) {
          await this.client.connect();
          await this.ensureGroup();
          await this.consumePending();
          this.logger.log(`Consuming ${EVENTS_STREAM} as ${CONSUMER_GROUP}/${CONSUMER_NAME}`);
        }

        const batch = await this.readGroup('>');
        if (batch.length > 0) {
          await this.handleBatch(batch);
        }
      } catch (err) {
        if (!this.running) return;
        this.groupReady = false;
        this.logger.warn(`Stream consumer error, retrying: ${(err as Error).message}`);
        try {
          if (this.client.isOpen) {
            await this.client.disconnect();
          }
        } catch {
          // ignore disconnect errors while recovering
        }
        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_MS));
      }
    }
  }

  private async ensureGroup() {
    if (this.groupReady) return;
    try {
      await this.client.xGroupCreate(EVENTS_STREAM, CONSUMER_GROUP, '0', { MKSTREAM: true });
    } catch (err) {
      if (!(err as Error).message.includes('BUSYGROUP')) {
        throw err;
      }
    }
    this.groupReady = true;
  }

  private async consumePending() {
    const batch = await this.readGroup('0');
    if (batch.length > 0) {
      this.logger.log(`Recovering ${batch.length} unacknowledged event(s)`);
      await this.handleBatch(batch);
    }
  }

  private async readGroup(id: '0' | '>'): Promise<Array<{ id: string; message: Record<string, string> }>> {
    const response = await this.client.xReadGroup(
      CONSUMER_GROUP,
      CONSUMER_NAME,
      { key: EVENTS_STREAM, id },
      { COUNT: READ_BATCH, BLOCK: id === '>' ? READ_BLOCK_MS : undefined },
    );
    return response?.[0]?.messages ?? [];
  }

  private async handleBatch(batch: Array<{ id: string; message: Record<string, string> }>) {
    for (const { id, message } of batch) {
      try {
        await this.logsService.create({
          eventType: message['type'] ?? 'unknown',
          timestamp: message['timestamp'] ?? new Date().toISOString(),
          payload: safeJsonParse(message['payload']),
        });
        await this.client.xAck(EVENTS_STREAM, CONSUMER_GROUP, id);
      } catch (err) {
        // Not acked — the event stays pending and is retried on next startup.
        this.logger.error(`Failed to store event ${id}: ${(err as Error).message}`);
      }
    }
  }
}

function safeJsonParse(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
