import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';

export const RESERVATION_ROUTES: Routes = [
  {
    path: 'reservation',
    loadComponent: () =>
      import('../../components/reservation/reservation-stepper/reservation-stepper.component')
        .then(m => m.ReservationStepperComponent),
    canActivate: [AuthGuard],
    data: { authOnly: true },
  },
  {
    path: 'guest-reservation',
    loadComponent: () =>
      import('../../components/reservation/reservation-stepper/reservation-stepper.component')
        .then(m => m.ReservationStepperComponent),
    canActivate: [AuthGuard],
    data: {
      minCoworkerRole: CoworkerRoles.Reception,
      initialStep: 0,
      receptionMode: true,
    },
  },
  {
    path: 'reservations-calendar',
    loadComponent: () =>
      import('../../components/room-reservation-overview/room-reservation-overview.component')
        .then(m => m.RoomReservationsOverviewComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
  },
  {
    path: 'my-reservations',
    loadComponent: () =>
      import('../../components/reservation/my-reservations/my-reservations.component')
        .then(m => m.MyReservationsComponent),
    canActivate: [AuthGuard],
    data: { authOnly: true },
  },
];
