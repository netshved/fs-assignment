import { createFeature, createReducer, on } from '@ngrx/store';
import { EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { PolygonData } from '../../models';
import { PolygonActions } from './polygon.actions';

export interface CharacterPolygons {
  characterId: number;
  polygons: PolygonData[];
}

const polygonAdapter: EntityAdapter<CharacterPolygons> = createEntityAdapter<CharacterPolygons>({
  selectId: (entry) => entry.characterId.toString(),
});

export { polygonAdapter as adapter };

export const polygonFeature = createFeature({
  name: 'polygons',
  reducer: createReducer(
    polygonAdapter.getInitialState(),
    on(PolygonActions.saveForCharacter, (state, { characterId, polygons }) =>
      polygonAdapter.upsertOne({ characterId, polygons }, state),
    ),
  ),
});

export const { selectPolygonsState } = polygonFeature;
