import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/registration/registration.component').then(
        (m) => m.RegistrationComponent
      ),
  },
];

