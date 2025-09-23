import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';


export const AVAILABILITY_ROUTES: Routes = [
  {
    path: 'reception-availability',
    loadComponent: () =>
      import('../../components/reception-availability/reception-availability.component')
        .then(m => m.ReceptionAvailabilityComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Gm },
  },
  {
    path: 'availability-overview',
    loadComponent: () =>
      import('../../components/availability-overview/availability-overview.component')
        .then(m => m.AvailabilityOverviewComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
  },
];
