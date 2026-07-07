import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { MatIconModule } from '@angular/material/icon';
import { AsyncPipe } from '@angular/common';
import { auditTime, combineLatest, debounceTime, take } from 'rxjs';
import { selectHasNext, selectLoading, selectPage, selectQuery, selectResults, selectTotal } from '../../store';
import { SearchActions } from '../../store/search/search.actions';
import { Character } from '../../models';

/** Start fetching the next page when rendered rows are this close to the end. */
const LOAD_MORE_THRESHOLD = 5;

@Component({
  selector: 'app-results-list',
  standalone: true,
  imports: [ScrollingModule, MatIconModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (results$ | async; as results) {
      @if (results.length > 0) {
        <div class="results-card">
          <div class="results-header">
            <mat-icon>filter_list</mat-icon>
            <span>
              {{ total$ | async }} {{ (total$ | async) === 1 ? 'result' : 'results' }}
              @if ((query$ | async)?.trim(); as q) { for &ldquo;{{ q }}&rdquo; }
            </span>
            <span class="header-hint">Click a row to open and annotate the image</span>
          </div>
          <cdk-virtual-scroll-viewport
            #viewport
            itemSize="72"
            class="viewport"
            (scrolledIndexChange)="onScroll()"
          >
            <div
              *cdkVirtualFor="let character of results; trackBy: trackById"
              class="result-row"
              role="button"
              tabindex="0"
              (click)="characterClick.emit(character)"
              (keydown.enter)="characterClick.emit(character)"
            >
              <img [src]="character.image" [alt]="character.name" class="avatar" loading="lazy" />
              <div class="info">
                <span class="name">{{ character.name }}</span>
                <span class="meta">
                  <span class="status-dot" [class]="statusClass(character)"></span>
                  {{ character.status }} · {{ character.species }} · {{ character.location.name }}
                </span>
              </div>
              <mat-icon class="chevron">chevron_right</mat-icon>
            </div>
          </cdk-virtual-scroll-viewport>
        </div>
      } @else if (!(loading$ | async)) {
        @if ((query$ | async)?.trim(); as q) {
          <div class="empty">
            <mat-icon>search_off</mat-icon>
            <p>No results for &ldquo;{{ q }}&rdquo;</p>
            <p class="hint">Try a different spelling or fewer words</p>
          </div>
        } @else {
          <div class="empty">
            <mat-icon>person_search</mat-icon>
            <p>Start typing to search characters</p>
            <p class="hint">Results appear as you type — word fragments like &ldquo;mor smi&rdquo; work too</p>
          </div>
        }
      }
    }
  `,
  styles: [`
    .results-card {
      border: 1px solid rgba(148, 163, 184, 0.15);
      background: rgba(15, 23, 42, 0.45);
      border-radius: 16px;
      overflow: hidden;
    }
    .results-header {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1.25rem; font-size: 0.85rem; color: #94a3b8;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }
    .results-header mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
    .header-hint { margin-left: auto; color: #475569; }
    .viewport {
      height: calc(100vh - 350px);
      min-height: 360px;
    }
    .result-row {
      display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1.25rem;
      height: 72px; cursor: pointer; transition: background 0.2s;
      overflow: hidden;
    }
    .result-row:hover, .result-row:focus-visible { background: rgba(59, 130, 246, 0.08); outline: none; }
    .avatar {
      width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      border: 1px solid rgba(148, 163, 184, 0.25); background: #334155;
    }
    .info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .name { font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta {
      font-size: 0.85rem; color: #94a3b8; display: flex; align-items: center; gap: 6px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
    .status-dot.alive { background: #22c55e; }
    .status-dot.dead { background: #ef4444; }
    .status-dot.unknown { background: #64748b; }
    .chevron { color: #64748b; }
    .empty { text-align: center; padding: 4rem 2rem; color: #64748b; }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 1rem; }
    .empty p { margin: 0.25rem 0; }
    .empty .hint { font-size: 0.85rem; color: #475569; }

    @media (max-width: 600px) {
      .header-hint { display: none; }
      .viewport { height: calc(100vh - 320px); }
    }
  `],
})
export class ResultsListComponent {
  @Output() characterClick = new EventEmitter<Character>();
  @ViewChild(CdkVirtualScrollViewport)
  set viewportRef(viewport: CdkVirtualScrollViewport | undefined) {
    this.viewportScrollSub?.unsubscribe();
    this.viewport = viewport;
    if (!viewport) return;

    viewport.checkViewportSize();
    this.viewportScrollSub = viewport
      .elementScrolled()
      .pipe(auditTime(100))
      .subscribe(() => this.maybeLoadMore());

    queueMicrotask(() => this.maybeLoadMore());
  }

  private viewport?: CdkVirtualScrollViewport;
  private viewportScrollSub?: { unsubscribe(): void };

  private readonly store = inject(Store);
  readonly results$ = this.store.select(selectResults);
  readonly loading$ = this.store.select(selectLoading);
  readonly query$ = this.store.select(selectQuery);
  readonly total$ = this.store.select(selectTotal);

  constructor() {
    this.results$
      .pipe(debounceTime(0), takeUntilDestroyed())
      .subscribe(() => {
        queueMicrotask(() => {
          this.viewport?.checkViewportSize();
          this.maybeLoadMore();
        });
      });
  }

  trackById(_: number, character: Character) {
    return character.id;
  }

  statusClass(character: Character): 'alive' | 'dead' | 'unknown' {
    const status = character.status.toLowerCase();
    return status === 'alive' || status === 'dead' ? status : 'unknown';
  }

  onScroll() {
    this.maybeLoadMore();
  }

  private maybeLoadMore() {
    const viewport = this.viewport;
    if (!viewport) return;

    const renderedEnd = viewport.getRenderedRange().end;
    const dataLength = viewport.getDataLength();
    const nearRenderedEnd = renderedEnd >= Math.max(1, dataLength - LOAD_MORE_THRESHOLD);
    const noScrollGap = viewport.measureScrollOffset('bottom') <= 72;

    if (!nearRenderedEnd && !noScrollGap) {
      return;
    }

    combineLatest([
      this.store.select(selectResults),
      this.store.select(selectHasNext),
      this.store.select(selectQuery),
      this.store.select(selectPage),
      this.store.select(selectLoading),
    ])
      .pipe(take(1))
      .subscribe(([results, hasNext, query, page, loading]) => {
        if (!loading && results.length && hasNext && query.trim()) {
          this.store.dispatch(SearchActions.loadMore({ query, page: page + 1 }));
        }
      });
  }
}
