import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';
export const GM_ROUTES: Routes = [
  {
    path: 'manage-gm',
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Gm },
    loadComponent: () =>
      import('../../components/manage-gm/manage-gm.component')
        .then(m => m.ManageGmComponent),
  },
  {
    path: 'upcoming-sessions',
    loadComponent: () =>
      import('../../components/upcoming-sessions/upcoming-sessions.component')
        .then(m => m.UpcomingSessionsComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Gm },
  },
  {
    path: 'availability',
    loadComponent: () =>
      import('../../components/gm-availability/gm-availability.component')
        .then(m => m.GmAvailabilityComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Gm },
  },
];
