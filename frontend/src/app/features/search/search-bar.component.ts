import { Component, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { AsyncPipe } from '@angular/common';
import { combineLatest, distinctUntilChanged, map, startWith, take, tap } from 'rxjs';
import { SearchActions } from '../../store/search/search.actions';
import { matchQuerySuggestions, selectAllQueries } from '../../store';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatAutocompleteModule,
    AsyncPipe,
  ],
  template: `
    <mat-form-field appearance="outline" class="search-field">
      <mat-label>Search characters</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input
        matInput
        [formControl]="searchControl"
        [matAutocomplete]="auto"
        #autoTrigger="matAutocompleteTrigger"
        placeholder="e.g. Rick, Morty, Summer — word fragments work too"
        (focus)="onInputFocus()"
      />
      @if (searchControl.value) {
        <button mat-icon-button matSuffix type="button" aria-label="Clear search" (click)="clearSearch()">
          <mat-icon>close</mat-icon>
        </button>
      }
      <mat-autocomplete #auto="matAutocomplete" class="search-autocomplete" (optionSelected)="onSuggestionSelected()">
        @for (suggestion of suggestions$ | async; track suggestion.id) {
          <mat-option [value]="suggestion.text">
            <mat-icon class="suggestion-icon">history</mat-icon>
            {{ suggestion.text }}
            <span class="count">({{ suggestion.resultCount }} results)</span>
          </mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: [`
    .search-field {
      width: 100%;
      margin-bottom: 1.5rem;
      --mdc-outlined-text-field-container-shape: 12px;
    }

    ::ng-deep .search-field .mat-mdc-form-field-subscript-wrapper { display: none; }

    ::ng-deep .search-field .mat-mdc-text-field-wrapper {
      background: rgba(30, 41, 59, 0.85);
      border-radius: 12px;
      transition: background 0.2s;
    }

    ::ng-deep .search-field.mat-focused .mat-mdc-text-field-wrapper {
      background: #1e293b;
    }

    ::ng-deep .search-field .mdc-notched-outline__leading,
    ::ng-deep .search-field .mdc-notched-outline__notch,
    ::ng-deep .search-field .mdc-notched-outline__trailing {
      border-color: #334155 !important;
    }

    ::ng-deep .search-field:hover:not(.mat-focused) .mdc-notched-outline__leading,
    ::ng-deep .search-field:hover:not(.mat-focused) .mdc-notched-outline__notch,
    ::ng-deep .search-field:hover:not(.mat-focused) .mdc-notched-outline__trailing {
      border-color: #475569 !important;
    }

    ::ng-deep .search-field.mat-focused .mdc-notched-outline__leading,
    ::ng-deep .search-field.mat-focused .mdc-notched-outline__notch,
    ::ng-deep .search-field.mat-focused .mdc-notched-outline__trailing {
      border-color: #3b82f6 !important;
      border-width: 2px;
    }

    ::ng-deep .search-field .mat-mdc-form-field-label,
    ::ng-deep .search-field.mat-focused .mat-mdc-form-field-label,
    ::ng-deep .search-field .mat-mdc-floating-label.mdc-floating-label--float-above {
      color: #94a3b8 !important;
    }

    ::ng-deep .search-field .mat-mdc-input-element {
      color: #e2e8f0 !important;
      caret-color: #3b82f6;
    }

    ::ng-deep .search-field .mat-mdc-input-element::placeholder {
      color: rgba(226, 232, 240, 0.35);
    }

    ::ng-deep .search-field .mat-icon.mat-prefix {
      color: #64748b;
      padding-right: 0.5rem;
    }

    ::ng-deep .search-field .mat-mdc-icon-button {
      color: #64748b;
    }

    ::ng-deep .search-field .mat-mdc-icon-button:hover {
      color: #e2e8f0;
    }

    .suggestion-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 8px; vertical-align: middle; color: #64748b; }
    .count { color: #64748b; font-size: 0.85em; margin-left: 8px; }

    ::ng-deep .search-autocomplete.mat-mdc-autocomplete-panel {
      max-height: 240px;
    }
  `],
})
export class SearchBarComponent {
  @ViewChild('autoTrigger') autoTrigger?: MatAutocompleteTrigger;

  private readonly store = inject(Store);
  private skipFocusOpen = false;
  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly suggestions$ = combineLatest([
    this.searchControl.valueChanges.pipe(startWith(''), distinctUntilChanged()),
    this.store.select(selectAllQueries),
  ]).pipe(map(([input, queries]) => matchQuerySuggestions(input, queries)));

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((query) => this.store.dispatch(SearchActions.queryChanged({ query })));

    // Re-open the panel when word-breakdown matching yields suggestions while typing.
    this.suggestions$
      .pipe(
        tap((suggestions) => {
          if (suggestions.length && this.searchControl.value.trim()) {
            queueMicrotask(() => this.autoTrigger?.openPanel());
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  onInputFocus(): void {
    if (this.skipFocusOpen) {
      this.skipFocusOpen = false;
      return;
    }
    this.suggestions$.pipe(take(1)).subscribe((suggestions) => {
      if (suggestions.length) {
        queueMicrotask(() => this.autoTrigger?.openPanel());
      }
    });
  }

  onSuggestionSelected(): void {
    this.skipFocusOpen = true;
    this.autoTrigger?.closePanel();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }
}
