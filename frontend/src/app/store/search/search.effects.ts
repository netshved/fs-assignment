import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  catchError,
  concat,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  filter,
  map,
  merge,
  of,
  switchMap,
} from 'rxjs';
import { SearchApiService } from '../../core/services/search-api.service';
import { QueryHistoryActions, SearchActions } from './search.actions';

/** Service A returns 200 with empty data; treat HTTP 404 as empty results if encountered. */
function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}

function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return error.status === 0 ? 'Network error — check your connection' : `Search failed (HTTP ${error.status})`;
  }
  return 'Search failed';
}

/**
 * Merged into the query stream after a failure so distinctUntilChanged does not
 * swallow a retry of the exact same query.
 */
const RETRY_RESET = Symbol('retry-reset');

@Injectable()
export class SearchEffects {
  // inject() must be used instead of constructor DI here: class field
  // initializers (createEffect) run before constructor parameters are assigned.
  private readonly actions$ = inject(Actions);
  private readonly api = inject(SearchApiService);

  search$ = createEffect(() => {
    const query$ = this.actions$.pipe(
      ofType(SearchActions.queryChanged),
      debounceTime(300),
      map(({ query }): string | typeof RETRY_RESET => query.trim()),
    );
    const retryReset$ = this.actions$.pipe(
      ofType(SearchActions.searchFailure),
      map((): string | typeof RETRY_RESET => RETRY_RESET),
    );

    return merge(query$, retryReset$).pipe(
      distinctUntilChanged(),
      filter((query): query is string => typeof query === 'string'),
      switchMap((query) => {
        if (!query) {
          return of(SearchActions.searchSuccess({ query: '', results: [], total: 0, page: 1, hasNext: false }));
        }
        // searchStarted comes from here, not from queryChanged in the reducer:
        // loading must only turn on for queries that actually reach the API,
        // otherwise a debounced/deduplicated keystroke leaves the spinner stuck.
        return concat(
          of(SearchActions.searchStarted({ query })),
          this.api.searchByName(query, 1).pipe(
            map(({ results, total, page, hasNext }) =>
              SearchActions.searchSuccess({ query, results, total, page, hasNext }),
            ),
            catchError((error: unknown) =>
              of(
                isNotFound(error)
                  ? SearchActions.searchSuccess({ query, results: [], total: 0, page: 1, hasNext: false })
                  : SearchActions.searchFailure({ error: errorMessage(error) }),
              ),
            ),
          ),
        );
      }),
    );
  });

  saveQuery$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.searchSuccess),
      filter(({ query, results, total }) => query.trim().length > 0 && results.length > 0 && total > 0),
      map(({ query, total }) =>
        QueryHistoryActions.saveQuery({ text: query, resultCount: total }),
      ),
    ),
  );

  loadMore$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.loadMore),
      exhaustMap(({ query, page }) =>
        this.api.searchByName(query, page).pipe(
          map(({ results, hasNext }) =>
            SearchActions.loadMoreSuccess({ query, results, page, hasNext }),
          ),
          catchError((error: unknown) =>
            of(SearchActions.loadMoreFailure({ query, error: errorMessage(error) })),
          ),
        ),
      ),
    ),
  );
}
