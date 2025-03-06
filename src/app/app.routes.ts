import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './auth/auth.routes';
import { ADMIN_ROUTES } from './admin/admin-routing';

export const routes: Routes = [
  { path: 'admin', children: ADMIN_ROUTES },
  { path: 'auth', children: AUTH_ROUTES },
  {
    path: '',
    loadComponent: () =>
      import('./components/main/main.component').then((m) => m.MainComponent),
    pathMatch: 'full',
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./components/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./components/services/services.component').then(
        (m) => m.ServicesComponent
      ),
  },
  {
    path: 'our-rooms',
    loadComponent: () =>
      import('./components/our-rooms/our-rooms.component').then(
        (m) => m.OurRoomsComponent
      ),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./components/contact/contact.component').then(
        (m) => m.ContactComponent
      ),
  },
  {
    path: 'tech-stack',
    loadComponent: () =>
      import('./components/tech-stack/tech-stack.component').then(
        (m) => m.TechStackComponent
      ),
  },
  {
    path: 'events',
    loadComponent: () =>
      import('./components/event-calendar/event-calendar.component').then(
        (m) => m.EventCalendarComponent
      ),
  },
  {
    path: 'event/:id',
    loadComponent: () =>
      import('./common/event-details/event-details.component').then(
        (m) => m.EventDetailsComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
