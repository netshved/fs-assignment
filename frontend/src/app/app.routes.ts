import { Routes } from '@angular/router';
import { SearchPageComponent } from './features/search/search-page.component';

export const routes: Routes = [
  { path: '', component: SearchPageComponent },
  { path: '**', redirectTo: '' },
];
