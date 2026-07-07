import { createActionGroup, props } from '@ngrx/store';
import { Character } from '../../models';

export const SearchActions = createActionGroup({
  source: 'Search',
  events: {
    'Query Changed': props<{ query: string }>(),
    'Search Started': props<{ query: string }>(),
    'Search Success': props<{ query: string; results: Character[]; total: number; page: number; hasNext: boolean }>(),
    'Search Failure': props<{ error: string }>(),
    'Load More': props<{ query: string; page: number }>(),
    'Load More Success': props<{ query: string; results: Character[]; page: number; hasNext: boolean }>(),
    'Load More Failure': props<{ query: string; error: string }>(),
  },
});

export const QueryHistoryActions = createActionGroup({
  source: 'Query History',
  events: {
    'Save Query': props<{ text: string; resultCount: number }>(),
  },
});
