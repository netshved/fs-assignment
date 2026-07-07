import { Action, ActionReducer, INIT, MetaReducer, UPDATE } from '@ngrx/store';
import { EntityState } from '@ngrx/entity';
import { AppState } from '../index';
import { polygonFeature, CharacterPolygons } from './polygon.reducer';
import { PolygonActions } from './polygon.actions';

const STORAGE_KEY = 'fs-assignment-polygons';

/** Persists polygon annotations to localStorage across page reloads. */
export function polygonStorageMetaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state, action) => {
    const nextState = reducer(state, action);

    if (action.type === INIT || action.type === UPDATE) {
      const stored = readStoredPolygons();
      if (stored) {
        return { ...nextState, [polygonFeature.name]: stored };
      }
    }

    if (action.type === PolygonActions.saveForCharacter.type && typeof localStorage !== 'undefined') {
      const polygons = nextState[polygonFeature.name];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(polygons));
      } catch {
        // Quota exceeded or storage blocked — persistence is best-effort.
      }
    }

    return nextState;
  };
}

export const metaReducers: MetaReducer<AppState>[] = [polygonStorageMetaReducer];

function readStoredPolygons(): EntityState<CharacterPolygons> | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EntityState<CharacterPolygons>;
  } catch {
    return null;
  }
}
