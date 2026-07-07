import { Inject, Injectable } from '@nestjs/common';
import { Db, Filter } from 'mongodb';
import { DATABASE_CONNECTION, CharacterDocument } from '@fs-assignment/common';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class SearchService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Db) {}

  async search(query: string, page: number, limit: number): Promise<PaginatedResult<CharacterDocument>> {
    const collection = this.db.collection<CharacterDocument>('characters');
    const trimmed = query.trim();
    // $text alone matches whole words only, which breaks typeahead ("ric" would
    // find nothing until "rick" is fully typed). The name clause covers partial
    // words with word breakdown — every typed word must appear somewhere in the
    // name, so "mor smi" finds "Morty Smith". All $or clauses are index-backed
    // ($text requires that).
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordClauses = words.map((word) => ({
      name: { $regex: escapeRegExp(word), $options: 'i' },
    }));
    const nameFilter: Filter<CharacterDocument> =
      wordClauses.length === 1 ? wordClauses[0] : { $and: wordClauses };
    const filter: Filter<CharacterDocument> = trimmed
      ? { $or: [{ $text: { $search: trimmed } }, nameFilter] }
      : {};

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      collection
        .find(filter, trimmed ? { projection: { score: { $meta: 'textScore' } } } : {})
        // The name tiebreaker keeps skip/limit pagination stable across equal scores.
        .sort(trimmed ? { score: { $meta: 'textScore' }, name: 1 } : { name: 1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}
