import { initialSearchState, queryAdapter, queryHistoryFeature, searchFeature } from './search.reducer';
import { QueryHistoryActions, SearchActions } from './search.actions';
import { Character } from '../../models';

function character(id: number, name = `Char ${id}`): Character {
  return {
    id,
    name,
    status: 'Alive',
    species: 'Human',
    type: '',
    gender: 'Male',
    origin: { name: 'Earth' },
    location: { name: 'Earth' },
    image: `https://example.com/${id}.jpg`,
    episode: [],
    url: `https://example.com/character/${id}`,
  };
}

describe('searchFeature reducer', () => {
  const reducer = searchFeature.reducer;

  it('only records the typed query on queryChanged — loading waits for searchStarted', () => {
    const state = reducer(initialSearchState, SearchActions.queryChanged({ query: 'rick' }));
    expect(state.query).toBe('rick');
    expect(state.loading).toBe(false);
  });

  it('sets loading and resets error/page when a search actually starts', () => {
    const state = reducer(
      { ...initialSearchState, query: 'rick', error: 'boom', page: 3 },
      SearchActions.searchStarted({ query: 'rick' }),
    );
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
    expect(state.page).toBe(1);
  });

  it('stores results on searchSuccess', () => {
    const results = [character(1), character(2)];
    const state = reducer(
      { ...initialSearchState, loading: true },
      SearchActions.searchSuccess({ query: 'rick', results, total: 2, page: 1, hasNext: false }),
    );
    expect(state.results).toEqual(results);
    expect(state.loading).toBe(false);
    expect(state.total).toBe(2);
  });

  it('appends results on loadMoreSuccess for the current query', () => {
    const state = {
      ...initialSearchState,
      query: 'rick',
      results: [character(1)],
      page: 1,
    };
    const next = searchFeature.reducer(
      state,
      SearchActions.loadMoreSuccess({ query: 'rick', results: [character(2)], page: 2, hasNext: true }),
    );
    expect(next.results.map((c) => c.id)).toEqual([1, 2]);
    expect(next.page).toBe(2);
  });

  it('ignores a stale loadMoreSuccess from a previous query', () => {
    const state = {
      ...initialSearchState,
      query: 'morty',
      results: [character(3)],
    };
    const next = reducer(
      state,
      SearchActions.loadMoreSuccess({ query: 'rick', results: [character(2)], page: 2, hasNext: true }),
    );
    expect(next).toBe(state);
  });

  it('keeps already loaded results when a page load fails', () => {
    const state = {
      ...initialSearchState,
      query: 'rick',
      results: [character(1), character(2)],
      loading: true,
    };
    const next = reducer(state, SearchActions.loadMoreFailure({ query: 'rick', error: 'HTTP 500' }));
    expect(next.results).toHaveLength(2);
    expect(next.loading).toBe(false);
    expect(next.error).toBe('HTTP 500');
  });

  it('ignores a stale loadMoreFailure from a previous query', () => {
    const state = {
      ...initialSearchState,
      query: 'morty',
      results: [character(3)],
      loading: true,
    };
    const next = reducer(state, SearchActions.loadMoreFailure({ query: 'rick', error: 'HTTP 500' }));
    expect(next).toBe(state);
  });

  it('keeps already loaded results when a new search fails', () => {
    const state = { ...initialSearchState, results: [character(1)], loading: true };
    const next = reducer(state, SearchActions.searchFailure({ error: 'Network error' }));
    expect(next.results).toEqual([character(1)]);
    expect(next.error).toBe('Network error');
    expect(next.loading).toBe(false);
  });
});

describe('queryHistoryFeature reducer', () => {
  const reducer = queryHistoryFeature.reducer;
  const initial = queryAdapter.getInitialState();

  it('saves a meaningful query', () => {
    const state = reducer(initial, QueryHistoryActions.saveQuery({ text: 'Rick', resultCount: 5 }));
    expect(state.ids).toEqual(['rick']);
    expect(state.entities['rick']?.text).toBe('Rick');
    expect(state.entities['rick']?.resultCount).toBe(5);
  });

  it('ignores queries without results', () => {
    const state = reducer(initial, QueryHistoryActions.saveQuery({ text: 'zzz', resultCount: 0 }));
    expect(state.ids).toHaveLength(0);
  });

  it('ignores blank queries regardless of result count', () => {
    const state = reducer(initial, QueryHistoryActions.saveQuery({ text: '   ', resultCount: 3 }));
    expect(state.ids).toHaveLength(0);
  });

  it('deduplicates case-insensitively, updating the existing entry', () => {
    let state = reducer(initial, QueryHistoryActions.saveQuery({ text: 'rick', resultCount: 5 }));
    state = reducer(state, QueryHistoryActions.saveQuery({ text: 'RICK', resultCount: 7 }));
    expect(state.ids).toHaveLength(1);
    expect(state.entities['rick']?.resultCount).toBe(7);
  });

  it('normalizes multi-word queries into a stable id', () => {
    const state = reducer(
      initial,
      QueryHistoryActions.saveQuery({ text: '  Morty   Smith ', resultCount: 2 }),
    );
    expect(state.ids).toEqual(['morty-smith']);
    expect(state.entities['morty-smith']?.text).toBe('Morty   Smith');
  });

  it('keeps distinct queries as separate entities', () => {
    let state = reducer(initial, QueryHistoryActions.saveQuery({ text: 'rick', resultCount: 5 }));
    state = reducer(state, QueryHistoryActions.saveQuery({ text: 'morty', resultCount: 3 }));
    expect(state.ids).toHaveLength(2);
  });
});
