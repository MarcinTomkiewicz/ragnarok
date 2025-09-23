import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';
import { EventResolver } from '../resolvers/event-resolver';


export const EVENTS_ROUTES: Routes = [
  {
    path: 'events',
    loadComponent: () =>
      import('../../components/events-admin-list/events-admin-list.component')
        .then(m => m.EventsAdminListComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.User },
  },
  {
    path: 'events/:slug/host-signup/:date',
    loadComponent: () =>
      import('../../components/host-signup-form/host-signup-form.component')
        .then(m => m.HostSignupFormComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.User },
  },
  {
    path: 'events/new',
    loadComponent: () =>
      import('../../components/event-form/event-form.component')
        .then(m => m.EventFormComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
  },
  {
    path: 'events/:slug/edit',
    loadComponent: () =>
      import('../../components/event-form/event-form.component')
        .then(m => m.EventFormComponent),
    resolve: { event: EventResolver },
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
  },
];
