import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AuthGuard } from './core/guards/auth.guard';
import { CoworkerRoles } from '../core/enums/roles';

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
      import(
        './components/reservation/reservation-stepper/reservation-stepper.component'
      ).then((m) => m.ReservationStepperComponent),
    canActivate: [AuthGuard],
    data: { authOnly: true },
  },
  {
    path: 'guest-reservation',
    loadComponent: () =>
      import(
        './components/reservation/reservation-stepper/reservation-stepper.component'
      ).then((m) => m.ReservationStepperComponent),
    canActivate: [AuthGuard],
    data: {
      minCoworkerRole: CoworkerRoles.Reception,
      initialStep: 0,
      receptionMode: true,
    },
  },
  {
    path: 'my-reservations',
    loadComponent: () =>
      import(
        './components/reservation/my-reservations/my-reservations.component'
      ).then((m) => m.MyReservationsComponent),
    canActivate: [AuthGuard],
    data: { authOnly: true },
  },
  {
    path: 'manage-gm',
    canActivate: [AuthGuard],
    data: {
      minCoworkerRole: CoworkerRoles.Gm,
    },
    loadComponent: () =>
      import('./components/manage-gm/manage-gm.component').then(
        (m) => m.ManageGmComponent
      ),
  },
  {
    path: 'upcoming-sessions',
    loadComponent: () =>
      import('./components/upcoming-sessions/upcoming-sessions.component').then(
        (m) => m.UpcomingSessionsComponent
      ),
    canActivate: [AuthGuard],
    data: {
      minCoworkerRole: CoworkerRoles.Gm,
    },
  },
  {
    path: 'availability',
    loadComponent: () =>
      import('./components/gm-availability/gm-availability.component').then(
        (m) => m.GmAvailabilityComponent
      ),
    canActivate: [AuthGuard],
    data: {
      minCoworkerRole: CoworkerRoles.Gm,
    },
  },
];
