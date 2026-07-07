import { Db } from 'mongodb';
import { LogsService, buildLogsFilter } from './logs.service';

describe('buildLogsFilter', () => {
  it('returns an empty filter when nothing is set', () => {
    expect(buildLogsFilter({})).toEqual({});
  });

  it('filters by event type', () => {
    expect(buildLogsFilter({ type: 'GET /search' })).toEqual({ eventType: 'GET /search' });
  });

  it('builds a closed date range', () => {
    const filter = buildLogsFilter({
      date_from: '2026-01-01T00:00:00.000Z',
      date_to: '2026-01-31T23:59:59.999Z',
    });
    expect(filter.timestamp).toEqual({
      $gte: new Date('2026-01-01T00:00:00.000Z'),
      $lte: new Date('2026-01-31T23:59:59.999Z'),
    });
  });

  it('supports open-ended ranges', () => {
    expect(buildLogsFilter({ date_from: '2026-01-01T00:00:00.000Z' }).timestamp).toEqual({
      $gte: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(buildLogsFilter({ date_to: '2026-01-01T00:00:00.000Z' }).timestamp).toEqual({
      $lte: new Date('2026-01-01T00:00:00.000Z'),
    });
  });
});

describe('LogsService.findLogs', () => {
  function createDbMock(docs: unknown[], total: number) {
    const cursor = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue(docs),
    };
    const collection = {
      find: jest.fn().mockReturnValue(cursor),
      countDocuments: jest.fn().mockResolvedValue(total),
    };
    const db = { collection: jest.fn().mockReturnValue(collection) } as unknown as Db;
    return { db, collection, cursor };
  }

  it('paginates and returns the real total, not the page size', async () => {
    const { db, cursor } = createDbMock([{ eventType: 'x' }], 500);
    const service = new LogsService(db);

    const result = await service.findLogs({ page: 3, limit: 50 });

    expect(cursor.skip).toHaveBeenCalledWith(100);
    expect(cursor.limit).toHaveBeenCalledWith(50);
    expect(result.meta).toEqual({ total: 500, page: 3, limit: 50, totalPages: 10 });
  });

  it('sorts newest first and applies the filter', async () => {
    const { db, collection, cursor } = createDbMock([], 0);
    const service = new LogsService(db);

    await service.findLogs({ type: 'GET /health' });

    expect(collection.find).toHaveBeenCalledWith({ eventType: 'GET /health' });
    expect(cursor.sort).toHaveBeenCalledWith({ timestamp: -1 });
  });
});

describe('LogsService.create', () => {
  it('falls back to "now" for an unparsable timestamp instead of storing Invalid Date', async () => {
    const insertOne = jest.fn().mockResolvedValue({});
    const db = {
      collection: jest.fn().mockReturnValue({ insertOne }),
    } as unknown as Db;
    const service = new LogsService(db);

    await service.create({ eventType: 'x', timestamp: 'garbage', payload: {} });

    const stored = insertOne.mock.calls[0][0];
    expect(Number.isNaN(stored.timestamp.getTime())).toBe(false);
  });
});
