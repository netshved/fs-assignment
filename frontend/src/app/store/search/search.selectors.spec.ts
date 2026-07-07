import { matchQuerySuggestions, selectMatchingSuggestions } from './search.selectors';
import { SearchQuery } from '../../models';

function query(text: string, timestamp = 0): SearchQuery {
  return { id: text.replace(/\s+/g, '-'), text, timestamp, resultCount: 1 };
}

describe('selectMatchingSuggestions', () => {
  const history = [
    query('rick sanchez'),
    query('morty smith'),
    query('summer'),
    query('birdperson'),
  ];

  function suggest(input: string, queries = history) {
    return matchQuerySuggestions(input, queries).map((q) => q.text);
  }

  it('returns recent queries for blank input', () => {
    expect(suggest('')).toEqual(['rick sanchez', 'morty smith', 'summer', 'birdperson']);
    expect(suggest('   ')).toEqual(['rick sanchez', 'morty smith', 'summer', 'birdperson']);
  });

  it('selectMatchingSuggestions factory matches matchQuerySuggestions', () => {
    expect(selectMatchingSuggestions('ric').projector(history).map((q) => q.text)).toEqual(['rick sanchez']);
  });

  it('matches by word prefix', () => {
    expect(suggest('ric')).toEqual(['rick sanchez']);
  });

  it('matches every input word against stored query words (word breakdown)', () => {
    expect(suggest('mor smi')).toEqual(['morty smith']);
    expect(suggest('smith morty')).toEqual(['morty smith']);
  });

  it('rejects when one input word matches nothing', () => {
    expect(suggest('morty xyz')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(suggest('SUMMER')).toEqual(['summer']);
  });

  it('caps the number of suggestions at 5', () => {
    const many = Array.from({ length: 10 }, (_, i) => query(`rick ${i}`));
    expect(suggest('rick', many)).toHaveLength(5);
  });
});
