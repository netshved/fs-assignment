import { createActionGroup, props } from '@ngrx/store';
import { PolygonData } from '../../models';

export const PolygonActions = createActionGroup({
  source: 'Polygon',
  events: {
    'Save For Character': props<{ characterId: number; polygons: PolygonData[] }>(),
  },
});
