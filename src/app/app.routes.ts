import { Routes } from '@angular/router';
import { ADMIN_ROUTES } from './admin/admin-routing';
import { AUTH_ROUTES } from './auth/auth.routes';
import { NotAuthorizedComponent } from './common/not-authorized/not-authorized.component';
import { NotFoundComponent } from './common/not-found/not-found.component';

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
      import('./components/about/about.component').then(
        (m) => m.AboutComponent
      ),
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
    path: 'for-beginners',
    loadComponent: () =>
      import('./components/for-beginners/for-beginners.component').then(
        (m) => m.ForBeginnersComponent
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
    path: 'events/:slug',
    loadComponent: () =>
      import('./common/event-details/event-details.component').then(
        (m) => m.EventDetailsComponent
      ),
  },
  {
    path: 'news/:id',
    loadComponent: () =>
      import('./common/news-details/news-details.component').then(
        (m) => m.NewsDetailsComponent
      ),
  },
  {
    path: 'offers-list',
    loadComponent: () =>
      import('./components/offers-list/offers-list.component').then(
        (m) => m.OffersListComponent
      ),
  },
  {
    path: 'offer/:id',
    loadComponent: () =>
      import('./common/offer-details/offer-details.component').then(
        (m) => m.OfferDetailsComponent
      ),
  },
  {
    path: 'offers/:slug',
    loadComponent: () =>
      import('./components/offers-page/offers-page.component').then(
        (m) => m.OffersPageComponent
      ),
  },
  {
    path: 'memberships',
    loadComponent: () =>
      import('./components/club-membership/club-membership.component').then(
        (m) => m.ClubMembershipComponent
      ),
  },
  {
    path: 'special/:id',
    loadComponent: () =>
      import(
        './common/special-offer-details/special-offer-details.component'
      ).then((m) => m.SpecialOfferDetailsComponent),
  },

  { path: 'not-authorized', component: NotAuthorizedComponent },
  { path: '**', component: NotFoundComponent },
];
