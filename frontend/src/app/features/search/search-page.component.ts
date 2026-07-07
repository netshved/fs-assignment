import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { take } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { SearchBarComponent } from './search-bar.component';
import { ResultsListComponent } from './results-list.component';
import { CharacterDialogComponent } from '../character-dialog/character-dialog.component';
import { selectError, selectLoading, selectQuery } from '../../store';
import { SearchActions } from '../../store/search/search.actions';
import { Character } from '../../models';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [SearchBarComponent, ResultsListComponent, MatIconModule, MatButtonModule, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="header">
        <h1>Character Search</h1>
        <p class="subtitle">Find Rick &amp; Morty characters as you type — open any result to annotate its image</p>
      </header>
      <app-search-bar />
      @if (loading$ | async) {
        <div class="loading-bar"></div>
      }
      @if (error$ | async; as error) {
        <div class="error-banner" role="alert">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error }}</span>
          <button mat-stroked-button class="retry" (click)="retry()">
            <mat-icon>refresh</mat-icon> Retry
          </button>
        </div>
      }
      <app-results-list (characterClick)="openCharacter($event)" />
    </div>
  `,
  styles: [`
    .page { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
    .header { text-align: center; margin-bottom: 2rem; }
    h1 {
      font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem;
      background: linear-gradient(90deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .subtitle { color: #94a3b8; margin: 0; }
    .loading-bar {
      height: 3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      border-radius: 2px; margin-bottom: 1rem; animation: pulse 1s ease-in-out infinite;
    }
    .error-banner {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem;
      margin-bottom: 1rem; border-radius: 8px; color: #fca5a5;
      background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35);
    }
    .error-banner .retry {
      margin-left: auto; color: #fca5a5;
      --mdc-outlined-button-outline-color: rgba(239, 68, 68, 0.4);
      --mdc-outlined-button-label-text-color: #fca5a5;
    }
    @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  `],
})
export class SearchPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(Store);
  readonly loading$ = this.store.select(selectLoading);
  readonly error$ = this.store.select(selectError);

  openCharacter(character: Character) {
    this.dialog.open(CharacterDialogComponent, {
      data: character,
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '95vh',
      // Esc is handled by the dialog itself: it first cancels an in-progress
      // polygon and only closes when there is nothing to cancel.
      disableClose: true,
    });
  }

  /** After a failure the effect resets its dedup filter, so re-dispatching the same query retries it. */
  retry() {
    this.store
      .select(selectQuery)
      .pipe(take(1))
      .subscribe((query) => this.store.dispatch(SearchActions.queryChanged({ query })));
  }
}
