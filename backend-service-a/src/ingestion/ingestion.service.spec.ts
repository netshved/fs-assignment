import { BadRequestException } from '@nestjs/common';
import { assertValidItems, toEpisodeList } from './ingestion.service';

describe('assertValidItems', () => {
  const validItem = { id: 1, name: 'Rick Sanchez' };

  it('accepts an array of valid items', () => {
    expect(() => assertValidItems([validItem, { id: 2, name: 'Morty' }])).not.toThrow();
  });

  it('rejects non-array payloads', () => {
    expect(() => assertValidItems({ id: 1 })).toThrow(BadRequestException);
    expect(() => assertValidItems('[]')).toThrow(BadRequestException);
    expect(() => assertValidItems(null)).toThrow(BadRequestException);
  });

  it('rejects an empty array', () => {
    expect(() => assertValidItems([])).toThrow(BadRequestException);
  });

  it('rejects items without a numeric id', () => {
    expect(() => assertValidItems([validItem, { id: 'x', name: 'Bad' }])).toThrow(/Row 1/);
  });

  it('rejects items without a name', () => {
    expect(() => assertValidItems([{ id: 3 }])).toThrow(BadRequestException);
  });
});

describe('toEpisodeList', () => {
  it('keeps arrays as-is', () => {
    expect(toEpisodeList(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('restores the array from the pipe-joined Excel format', () => {
    expect(toEpisodeList('ep1|ep2|ep3')).toEqual(['ep1', 'ep2', 'ep3']);
  });

  it('returns an empty list for empty or missing values', () => {
    expect(toEpisodeList('')).toEqual([]);
    expect(toEpisodeList(undefined)).toEqual([]);
    expect(toEpisodeList(null)).toEqual([]);
  });
});
