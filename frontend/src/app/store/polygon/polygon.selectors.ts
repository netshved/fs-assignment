import { createSelector } from '@ngrx/store';
import { adapter, polygonFeature } from './polygon.reducer';

export const { selectEntities: selectPolygonEntities } = adapter.getSelectors(polygonFeature.selectPolygonsState);

export const selectPolygonsForCharacter = (characterId: number) =>
  createSelector(selectPolygonEntities, (entities) => entities[characterId.toString()]?.polygons ?? []);
