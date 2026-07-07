import { Db } from 'mongodb';
import { SearchService } from './search.service';

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

describe('SearchService', () => {
  it('combines the text index with a name substring match and ranks by score', async () => {
    const { db, collection, cursor } = createDbMock([{ name: 'Rick' }], 1);
    const service = new SearchService(db);

    await service.search('rick', 1, 20);

    expect(collection.find).toHaveBeenCalledWith(
      {
        $or: [
          { $text: { $search: 'rick' } },
          { name: { $regex: 'rick', $options: 'i' } },
        ],
      },
      { projection: { score: { $meta: 'textScore' } } },
    );
    expect(cursor.sort).toHaveBeenCalledWith({ score: { $meta: 'textScore' }, name: 1 });
  });

  it('breaks multi-word queries into per-word name clauses ("mor smi" finds "Morty Smith")', async () => {
    const { db, collection } = createDbMock([], 0);
    const service = new SearchService(db);

    await service.search('mor smi', 1, 20);

    const filter = (collection.find as jest.Mock).mock.calls[0][0];
    expect(filter.$or[0]).toEqual({ $text: { $search: 'mor smi' } });
    expect(filter.$or[1]).toEqual({
      $and: [
        { name: { $regex: 'mor', $options: 'i' } },
        { name: { $regex: 'smi', $options: 'i' } },
      ],
    });
  });

  it('escapes regex metacharacters so a hostile query cannot break the substring clause', async () => {
    const { db, collection } = createDbMock([], 0);
    const service = new SearchService(db);

    await service.search('r.i(c*k', 1, 20);

    const filter = (collection.find as jest.Mock).mock.calls[0][0];
    expect(filter.$or[1].name.$regex).toBe('r\\.i\\(c\\*k');
  });

  it('lists everything sorted by name when the query is blank', async () => {
    const { db, collection, cursor } = createDbMock([], 0);
    const service = new SearchService(db);

    await service.search('   ', 1, 20);

    expect(collection.find).toHaveBeenCalledWith({}, {});
    expect(cursor.sort).toHaveBeenCalledWith({ name: 1 });
  });

  it('applies skip/limit and computes pagination meta', async () => {
    const { db, cursor } = createDbMock([{ name: 'A' }], 45);
    const service = new SearchService(db);

    const result = await service.search('rick', 2, 20);

    expect(cursor.skip).toHaveBeenCalledWith(20);
    expect(cursor.limit).toHaveBeenCalledWith(20);
    expect(result.meta).toEqual({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('reports no next page on the last page and at least one total page when empty', async () => {
    const { db } = createDbMock([], 0);
    const service = new SearchService(db);

    const result = await service.search('nothing', 1, 20);

    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.hasNext).toBe(false);
    expect(result.meta.hasPrev).toBe(false);
  });
});
