import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';


export const BENEFITS_ROUTES: Routes = [
  {
    path: 'benefits',
    loadComponent: () =>
      import('../../components/benefits/benefits.component')
        .then(m => m.BenefitsComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Member },
  },
];
