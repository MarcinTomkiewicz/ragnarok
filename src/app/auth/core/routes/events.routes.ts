// app/auth/routes/events.routes.ts
import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CoworkerRoles } from '../../../core/enums/roles';
import { EventResolver } from '../resolvers/event-resolver';

export const EVENTS_ROUTES: Routes = [
  // LISTA / ADMIN
  {
    path: 'events',
    loadComponent: () =>
      import('../../components/events-admin-list/events-admin-list.component')
        .then(m => m.EventsAdminListComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.User },
    pathMatch: 'full',
  },

  // HOST SIGNUP Z DATĄ (np. cykliczne, single z datą w URL)
  {
    path: 'events/:slug/host-signup/:date',
    loadComponent: () =>
      import('../../components/host-signup-form/host-signup-form.component')
        .then(m => m.HostSignupFormComponent),
    resolve: { event: EventResolver },
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.User },
    pathMatch: 'full',
  },

  // HOST SIGNUP BEZ DATY (Composite SINGLE – wybór salki, parametry w query: room/start/end)
  {
    path: 'events/:slug/host-signup',
    loadComponent: () =>
      import('../../components/host-signup-form/host-signup-form.component')
        .then(m => m.HostSignupFormComponent),
    resolve: { event: EventResolver },
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.User },
    pathMatch: 'full',
  },

  // NOWE WYDARZENIE
  {
    path: 'events/new',
    loadComponent: () =>
      import('../../components/event-form/event-form.component')
        .then(m => m.EventFormComponent),
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
    pathMatch: 'full',
  },

  // EDYCJA WYDARZENIA
  {
    path: 'events/:slug/edit',
    loadComponent: () =>
      import('../../components/event-form/event-form.component')
        .then(m => m.EventFormComponent),
    resolve: { event: EventResolver },
    canActivate: [AuthGuard],
    data: { minCoworkerRole: CoworkerRoles.Reception },
    pathMatch: 'full',
  },
];
