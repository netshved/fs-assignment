import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { reducers } from './store';
import { SearchEffects } from './store/search/search.effects';
import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { polygonStorageMetaReducer } from './store/polygon/polygon-storage.metareducer';
import { queryHistoryStorageMetaReducer } from './store/search/query-history-storage.metareducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([cacheInterceptor])),
    provideAnimationsAsync(),
    provideStore(reducers, { metaReducers: [polygonStorageMetaReducer, queryHistoryStorageMetaReducer] }),
    provideEffects([SearchEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ],
};
