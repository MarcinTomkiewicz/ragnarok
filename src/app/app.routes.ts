import { Routes } from '@angular/router';
import { ADMIN_ROUTES } from './admin/admin-routing';
import { NotAuthorizedComponent } from './common/not-authorized/not-authorized.component';
import { NotFoundComponent } from './common/not-found/not-found.component';
import { AUTH_ROUTES } from './auth/core/routes';

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

  // Wydarzenia
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

  // News (tu nadal po id, jeśli tak masz w bazie)
  {
    path: 'news/:id',
    loadComponent: () =>
      import('./common/news-details/news-details.component').then(
        (m) => m.NewsDetailsComponent
      ),
  },

  // Sklep (lista)
  {
    path: 'offers/store',
    loadComponent: () =>
      import('./components/offers-list/offers-list.component').then(
        (m) => m.OffersListComponent
      ),
  },

  // Szczegóły produktu w sklepie — TERAZ po SLUGU
  {
    path: 'offers/store/:slug',
    loadComponent: () =>
      import('./common/offer-details/offer-details.component').then(
        (m) => m.OfferDetailsComponent
      ),
  },

  // Marka własna (lista)
  {
    path: 'offers/brand',
    loadComponent: () =>
      import('./components/brand-offers/brand-offers.component').then(
        (m) => m.BrandOffersComponent
      ),
  },

  // Inne podstrony oferty (rooms/vouchers/courses) – te zostają po :slug
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
