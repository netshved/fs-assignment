import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { DATABASE_CONNECTION, CharacterDocument } from '@fs-assignment/common';
import { fetchAllCharacters, RickMortyCharacter } from './rick-morty-client';

export type { RickMortyCharacter } from './rick-morty-client';
export const ALLOWED_UPLOAD_EXTENSIONS = ['.json', '.xlsx', '.xls'] as const;

export interface ImportResult {
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

const BATCH_SIZE = 100;

/** Excel round-trips flatten the episode array to "a|b|c"; restore the array shape. */
export function toEpisodeList(episode: unknown): string[] {
  if (Array.isArray(episode)) {
    return episode.map(String);
  }
  if (typeof episode === 'string' && episode.length > 0) {
    return episode.split('|');
  }
  return [];
}

/** Validates parsed rows so a malformed file fails with a clear 400, not a broken import. */
export function assertValidItems(items: unknown): asserts items is RickMortyCharacter[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException('File must contain a non-empty array of characters');
  }
  const invalidIndex = items.findIndex(
    (item) =>
      typeof item !== 'object' ||
      item === null ||
      typeof (item as RickMortyCharacter).id !== 'number' ||
      typeof (item as RickMortyCharacter).name !== 'string',
  );
  if (invalidIndex >= 0) {
    throw new BadRequestException(
      `Row ${invalidIndex} is invalid: every item needs a numeric "id" and a string "name"`,
    );
  }
}

@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly jsonFile = path.join(this.dataDir, 'characters.json');
  private readonly excelFile = path.join(this.dataDir, 'characters.xlsx');

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Db) {}

  async onModuleInit() {
    const collection = this.db.collection<CharacterDocument>('characters');
    await collection.createIndex({ name: 'text', species: 'text', status: 'text', type: 'text' });
    await collection.createIndex({ externalId: 1 }, { unique: true });
    // Required by search: every clause of an $or containing $text must be indexed.
    await collection.createIndex({ name: 1 });
  }

  /**
   * Seeds the database from the public API if it is empty. Called after the
   * HTTP server is up; failures are logged, they must not crash the service.
   */
  async ensureDataLoaded(): Promise<void> {
    const count = await this.db.collection('characters').estimatedDocumentCount();
    if (count > 0) {
      this.logger.log(`Seed skipped: ${count} characters already present`);
      return;
    }
    this.logger.log('Database empty — seeding from the public API');
    await this.fetchAndSaveToFile('json');
    const inserted = await this.parseFileAndInsert(this.jsonFile);
    this.logger.log(
      `Seed finished: ${inserted.processed} processed (${inserted.inserted} inserted, ${inserted.updated} updated)`,
    );
  }

  async fetchAndSaveToFile(format: 'json' | 'xlsx'): Promise<number> {
    fs.mkdirSync(this.dataDir, { recursive: true });

    const items = await fetchAllCharacters();
    if (format === 'xlsx') {
      const sheet = XLSX.utils.json_to_sheet(
        items.map((item) => ({
          ...item,
          origin: item.origin?.name ?? '',
          location: item.location?.name ?? '',
          episode: (item.episode ?? []).join('|'),
        })),
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'characters');
      XLSX.writeFile(workbook, this.excelFile);
    } else {
      fs.writeFileSync(this.jsonFile, JSON.stringify(items, null, 2));
    }
    return items.length;
  }

  async uploadAndInsert(file: Express.Multer.File): Promise<ImportResult> {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
      throw new BadRequestException(
        `Unsupported file type "${ext}". Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`,
      );
    }

    const items = this.parseBuffer(file.buffer, ext);
    assertValidItems(items);
    return this.batchInsert(items);
  }

  async parseFileAndInsert(filePath: string): Promise<ImportResult> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(
        `File not found: ${path.basename(filePath)}. Run POST /ingestion/fetch/json first.`,
      );
    }
    const items = this.parseBuffer(fs.readFileSync(filePath), path.extname(filePath).toLowerCase());
    assertValidItems(items);
    return this.batchInsert(items);
  }

  private parseBuffer(buffer: Buffer, ext: string): unknown {
    try {
      if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json<RickMortyCharacter>(sheet);
      }
      return JSON.parse(buffer.toString('utf-8')) as unknown;
    } catch {
      throw new BadRequestException(`File could not be parsed as ${ext}`);
    }
  }

  private async batchInsert(items: RickMortyCharacter[]): Promise<ImportResult> {
    const collection = this.db.collection<CharacterDocument>('characters');

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const result = await collection.bulkWrite(
        batch.map((item) => ({
          updateOne: {
            filter: { externalId: item.id },
            update: {
              $set: {
                externalId: item.id,
                name: item.name,
                status: item.status || 'Unknown',
                species: item.species || 'Unknown',
                type: item.type || '',
                gender: item.gender || '',
                origin: typeof item.origin === 'object' ? (item.origin?.name ?? '') : String(item.origin ?? ''),
                location:
                  typeof item.location === 'object' ? (item.location?.name ?? '') : String(item.location ?? ''),
                image: item.image || '',
                episode: toEpisodeList(item.episode),
                url: item.url ?? '',
              },
              $setOnInsert: { createdAt: new Date() },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      inserted += result.upsertedCount;
      updated += result.modifiedCount;
      unchanged += result.matchedCount - result.modifiedCount;
    }
    return { processed: items.length, inserted, updated, unchanged };
  }
}
