import { EntityState } from '@ngrx/entity';
import { searchFeature, queryHistoryFeature, SearchState } from './search/search.reducer';
import { polygonFeature, CharacterPolygons } from './polygon/polygon.reducer';
import { SearchQuery } from '../models';

export const reducers = {
  [searchFeature.name]: searchFeature.reducer,
  [queryHistoryFeature.name]: queryHistoryFeature.reducer,
  [polygonFeature.name]: polygonFeature.reducer,
};

export interface AppState {
  [searchFeature.name]: SearchState;
  [queryHistoryFeature.name]: EntityState<SearchQuery>;
  [polygonFeature.name]: EntityState<CharacterPolygons>;
}

export * from './search/search.selectors';
export * from './polygon/polygon.selectors';
