import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Db, Filter } from 'mongodb';
import { LOGS_DATABASE_CONNECTION, EventLogDocument } from '@fs-assignment/common';
import { EventPayload } from './event.dto';
import { LogsQueryDto } from './logs-query.dto';

export interface PaginatedLogs {
  data: EventLogDocument[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function buildLogsFilter(query: LogsQueryDto): Filter<EventLogDocument> {
  const filter: Filter<EventLogDocument> = {};
  if (query.type) {
    filter.eventType = query.type;
  }
  if (query.date_from || query.date_to) {
    filter.timestamp = {
      ...(query.date_from ? { $gte: new Date(query.date_from) } : {}),
      ...(query.date_to ? { $lte: new Date(query.date_to) } : {}),
    };
  }
  return filter;
}

@Injectable()
export class LogsService implements OnModuleInit {
  constructor(@Inject(LOGS_DATABASE_CONNECTION) private readonly db: Db) {}

  async onModuleInit() {
    const collection = this.db.collection<EventLogDocument>('event_logs');
    await collection.createIndex({ timestamp: -1 });
    await collection.createIndex({ eventType: 1, timestamp: -1 });
  }

  async create(event: EventPayload): Promise<void> {
    const timestamp = new Date(event.timestamp);
    await this.db.collection<EventLogDocument>('event_logs').insertOne({
      eventType: event.eventType,
      timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      payload: event.payload,
    });
  }

  async findLogs(query: LogsQueryDto): Promise<PaginatedLogs> {
    const collection = this.db.collection<EventLogDocument>('event_logs');
    const filter = buildLogsFilter(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [data, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) },
    };
  }
}
