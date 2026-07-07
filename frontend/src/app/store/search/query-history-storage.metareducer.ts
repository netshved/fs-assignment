import { ActionReducer, INIT, MetaReducer, UPDATE } from '@ngrx/store';
import { EntityState } from '@ngrx/entity';
import { AppState } from '../index';
import { queryHistoryFeature } from './search.reducer';
import { QueryHistoryActions } from './search.actions';
import { SearchQuery } from '../../models';

const STORAGE_KEY = 'fs-assignment-query-history';

/** Persists meaningful past queries so word-breakdown autocomplete survives reloads. */
export function queryHistoryStorageMetaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state, action) => {
    const nextState = reducer(state, action);

    if (action.type === INIT || action.type === UPDATE) {
      const stored = readStoredQueries();
      if (stored) {
        return { ...nextState, [queryHistoryFeature.name]: stored };
      }
    }

    if (action.type === QueryHistoryActions.saveQuery.type && typeof localStorage !== 'undefined') {
      const history = nextState[queryHistoryFeature.name];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch {
        // Quota exceeded or storage blocked — persistence is best-effort.
      }
    }

    return nextState;
  };
}

export const queryHistoryMetaReducers: MetaReducer<AppState>[] = [queryHistoryStorageMetaReducer];

function readStoredQueries(): EntityState<SearchQuery> | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EntityState<SearchQuery>;
  } catch {
    return null;
  }
}
