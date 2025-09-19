import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PlatformService } from '../platform/platform.service';
import { fromEvent, merge, of, ReplaySubject } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';

declare global {
  interface CookiebotType {
    consent: {
      marketing: boolean;
      statistics: boolean;
      preferences: boolean;
      necessary: boolean;
    };
  }
  var Cookiebot: CookiebotType | undefined;
}

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(PlatformService);

  private gtmLoaded$ = new ReplaySubject<boolean>(1);

  initGtm(containerId: string): void {
    if (!this.platform.isBrowser) return;

    const g: any = globalThis as any;
    g.dataLayer = g.dataLayer || [];
    const dataLayer = g.dataLayer as any[];

    dataLayer.push({
      'gtm.start': Date.now(),
      event: 'gtm.js',
    });
    dataLayer.push({
      event: 'default_consent',
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
    });

    const src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(
      containerId
    )}`;
    if (!this.document.querySelector(`script[src="${src}"]`)) {
      const s = this.document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-cookieconsent', 'marketing'); // Cookiebot kontroluje ładowanie
      this.document.head.appendChild(s);
      s.addEventListener('load', () => this.gtmLoaded$.next(true));
    } else {
      this.gtmLoaded$.next(true);
    }

    this.bindCookiebotConsentToGtm();
  }

  pushEvent(eventName: string, params: Record<string, unknown> = {}): void {
    if (!this.platform.isBrowser) return;
    const g: any = globalThis as any;
    g.dataLayer = g.dataLayer || [];
    g.dataLayer.push({ event: eventName, ...params });
  }

  whenReady(cb: () => void): void {
    this.gtmLoaded$
      .pipe(startWith(false), filter(Boolean))
      .subscribe(() => cb());
  }

  private bindCookiebotConsentToGtm(): void {
    if (!this.platform.isBrowser) return;

    const consent$ = merge(
      fromEvent<CustomEvent>(document as any, 'CookiebotOnAccept').pipe(
        map(() => true)
      ),
      fromEvent<CustomEvent>(document as any, 'CookiebotOnDecline').pipe(
        map(() => true)
      ),
      of(true)
    ).pipe(
      map(() => {
        const cb: any = (globalThis as any).Cookiebot;
        const c = cb?.consent;
        return {
          ad_storage: c?.marketing ? 'granted' : 'denied',
          ad_user_data: c?.marketing ? 'granted' : 'denied',
          ad_personalization: c?.marketing ? 'granted' : 'denied',
          analytics_storage: c?.statistics ? 'granted' : 'denied',
          functionality_storage: 'granted',
          security_storage: 'granted',
        };
      })
    );

    consent$.subscribe((flags) => {
      const g: any = globalThis as any;
      g.dataLayer = g.dataLayer || [];
      g.dataLayer.push({ event: 'consent_update', ...flags });
    });
  }
}
