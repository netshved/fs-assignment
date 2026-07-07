import { createSelector } from '@ngrx/store';
import { SearchQuery } from '../../models';
import { queryAdapter, queryHistoryFeature, searchFeature } from './search.reducer';

export const {
  selectQuery,
  selectResults,
  selectLoading,
  selectPage,
  selectHasNext,
  selectTotal,
  selectError,
} = searchFeature;

export const { selectQueryHistoryState } = queryHistoryFeature;
export const { selectAll: selectAllQueries } = queryAdapter.getSelectors(selectQueryHistoryState);

const MAX_SUGGESTIONS = 5;

/**
 * Word-breakdown matching: every input word must match some word of the stored
 * query (substring in either direction), e.g. "mor smi" matches "morty smith".
 * Empty input returns the most recent queries for focus/autocomplete.
 */
export function matchQuerySuggestions(input: string, queries: SearchQuery[]): SearchQuery[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return queries.slice(0, MAX_SUGGESTIONS);
  }

  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  return queries
    .filter((query) => {
      const queryWords = query.text.toLowerCase().split(/\s+/);
      return words.every((word) =>
        queryWords.some((part) => part.includes(word) || word.includes(part)),
      );
    })
    .slice(0, MAX_SUGGESTIONS);
}

export const selectMatchingSuggestions = (input: string) =>
  createSelector(selectAllQueries, (queries) => matchQuerySuggestions(input, queries));
