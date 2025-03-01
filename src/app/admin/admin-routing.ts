import { Routes } from '@angular/router';
import { AdminWrapperComponent } from './admin-wrapper/admin-wrapper.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminWrapperComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];