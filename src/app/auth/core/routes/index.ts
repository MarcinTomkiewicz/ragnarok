import { Routes } from '@angular/router';
import { BASE_ROUTES } from './base.routes';
import { RESERVATION_ROUTES } from './reservations.routes';
import { GM_ROUTES } from './gm.routes';
import { PARTIES_ROUTES } from './parties.routes';
import { BENEFITS_ROUTES } from './benefits.routes';
import { AVAILABILITY_ROUTES } from './availability.routes';
import { WORK_LOG_ROUTES } from './work-logs.routes';
import { EVENTS_ROUTES } from './events.routes';
import { ROSTER_ROUTES } from './roster.routes';

export const AUTH_ROUTES: Routes = [
  ...BASE_ROUTES,
  ...RESERVATION_ROUTES,
  ...GM_ROUTES,
  ...PARTIES_ROUTES,
  ...BENEFITS_ROUTES,
  ...AVAILABILITY_ROUTES,
  ...WORK_LOG_ROUTES,
  ...EVENTS_ROUTES,
  ...ROSTER_ROUTES,
];
