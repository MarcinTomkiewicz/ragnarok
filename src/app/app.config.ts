import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideClientHydration,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AppInitializerProvider } from './core/config/app.initializer';
import { ENV_FACEBOOK_PIXEL_ID, ENV_GOOGLE_MAPS_API_KEY, ENV_GTM_ID } from './core/tokens';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions(), withComponentInputBinding()),
    provideAnimations(),
    provideAnimationsAsync(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
    provideClientHydration(
      withHttpTransferCacheOptions({
        includePostRequests: true,
      })
    ),
    {
      provide: ENV_GOOGLE_MAPS_API_KEY,
      useValue: 'AIzaSyDiASRjUg6MXHh0K7Ct9U3TpaLtSfYZmIs',
    },
    { provide: ENV_GTM_ID, useValue: 'GTM-P5FPPLDC' },
    { provide: ENV_FACEBOOK_PIXEL_ID, useValue: '691368896799868' },
    AppInitializerProvider,
  ],
};
