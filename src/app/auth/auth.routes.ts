import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './core/guards/auth.guard';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/registration/registration.component').then(
        (m) => m.RegistrationComponent
      ),
  },
  {
    path: 'edit-data',
    loadComponent: () =>
      import('./components/edit-data/edit-data.component').then(
        (m) => m.EditDataComponent
      ),
    canActivate: [AuthGuard],
    data: { authOnly: true },
  },
  {
  path: 'reservation',
  loadComponent: () =>
    import('./components/reservation/reservation-stepper/reservation-stepper.component').then(
      (m) => m.ReservationStepperComponent
    ),
  canActivate: [AuthGuard],
  data: { authOnly: true },
},
];
