import { createFeature, createReducer, on } from '@ngrx/store';
import { createEntityAdapter } from '@ngrx/entity';
import { Character, SearchQuery } from '../../models';
import { QueryHistoryActions, SearchActions } from './search.actions';

export interface SearchState {
  query: string;
  results: Character[];
  loading: boolean;
  error: string | null;
  page: number;
  hasNext: boolean;
  total: number;
}

export const initialSearchState: SearchState = {
  query: '',
  results: [],
  loading: false,
  error: null,
  page: 1,
  hasNext: false,
  total: 0,
};

const queryAdapter = createEntityAdapter<SearchQuery>({
  selectId: (q) => q.id,
  sortComparer: (a, b) => b.timestamp - a.timestamp,
});

export { queryAdapter };

export const searchFeature = createFeature({
  name: 'search',
  reducer: createReducer(
    initialSearchState,
    // Only tracks what the user typed. Loading flips on searchStarted, which the
    // effect emits solely for queries that actually reach the API — flipping it
    // here would strand the spinner on debounced/deduplicated keystrokes.
    on(SearchActions.queryChanged, (state, { query }) => ({ ...state, query })),
    on(SearchActions.searchStarted, (state) => ({
      ...state,
      loading: true,
      error: null,
      page: 1,
      hasNext: false,
    })),
    on(SearchActions.searchSuccess, (state, { results, total, page, hasNext }) => ({
      ...state,
      results,
      total,
      page,
      loading: false,
      error: null,
      hasNext,
    })),
    on(SearchActions.searchFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error,
      hasNext: false,
    })),
    on(SearchActions.loadMore, (state) => ({ ...state, loading: true })),
    on(SearchActions.loadMoreSuccess, (state, { query, results, page, hasNext }) => {
      // Ignore late responses that belong to a previous query.
      if (query.trim() !== state.query.trim()) {
        return state;
      }
      return {
        ...state,
        results: [...state.results, ...results],
        page,
        hasNext,
        loading: false,
        error: null,
      };
    }),
    // A failed page load must not wipe already shown results, and a stale
    // failure from a previous query must not disturb the current one.
    on(SearchActions.loadMoreFailure, (state, { query, error }) => {
      if (query.trim() !== state.query.trim()) {
        return state;
      }
      return { ...state, loading: false, error };
    }),
  ),
});

export const queryHistoryFeature = createFeature({
  name: 'queryHistory',
  reducer: createReducer(
    queryAdapter.getInitialState(),
    on(QueryHistoryActions.saveQuery, (state, { text, resultCount }) => {
      const normalized = text.trim().toLowerCase();
      if (!normalized || resultCount <= 0) return state;

      const id = normalized.replace(/\s+/g, '-');
      const existing = state.entities[id];
      if (existing) {
        return queryAdapter.updateOne(
          { id, changes: { timestamp: Date.now(), resultCount } },
          state,
        );
      }
      return queryAdapter.addOne(
        { id, text: text.trim(), timestamp: Date.now(), resultCount },
        state,
      );
    }),
  ),
});

export const { selectQueryHistoryState } = queryHistoryFeature;
