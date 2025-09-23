import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';


export const ROSTER_ROUTES: Routes = [
  {
    path: 'reception-roster',
    loadComponent: () =>
      import('../../components/reception-roster-editor/reception-roster-editor.component')
        .then(m => m.ReceptionRosterEditorComponent),
    canActivate: [AuthGuard],
    data: { strictCoworkerRole: CoworkerRoles.Owner },
  },
  {
    path: 'my-roster',
    loadComponent: () =>
      import('../../components/my-roster-calendar/my-roster-calendar.component')
        .then(m => m.MyRosterCalendarComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Gm },
  },
];
