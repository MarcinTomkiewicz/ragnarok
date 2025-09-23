import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';

export const WORK_LOG_ROUTES: Routes = [
  {
    path: 'work-log',
    loadComponent: () =>
      import('../../components/my-work-log/my-work-log.component')
        .then(m => m.MyWorkLogComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Gm },
  },
  {
    path: 'work-logs-overview',
    loadComponent: () =>
      import('../../components/work-log-overview/work-log-overview.component')
        .then(m => m.WorkLogOverviewComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
  },
];
