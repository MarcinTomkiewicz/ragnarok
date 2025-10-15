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
  // Cookiebot global
  // eslint-disable-next-line no-var
  var Cookiebot: CookiebotType | undefined;

  // FB Pixel globals
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(PlatformService);

  // ───── GTM ──────────────────────────────────────────────────────────────────
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
          _marketingGranted: !!c?.marketing,
        } as any;
      })
    );

    consent$.subscribe((flags) => {
      const { _marketingGranted, ...gtmFlags } = flags;
      const g: any = globalThis as any;
      g.dataLayer = g.dataLayer || [];
      g.dataLayer.push({ event: 'consent_update', ...gtmFlags });

      // zsynchronizuj także Pixel (ładowanie/wyłączenie) – szczegóły niżej
      this.syncFacebookPixelWithConsent(_marketingGranted);
    });
  }

  // ───── Facebook Pixel ───────────────────────────────────────────────────────
  private fbqLoaded$ = new ReplaySubject<boolean>(1);
  private fbPixelId: string | null = null;
  private fbInitialized = false;
  private fbPageViewFired = false;

  /**
   * Inicjalizacja Facebook Pixel (ładuje się tylko przy zgodzie marketingowej).
   */
  initFacebookPixel(pixelId: string): void {
    if (!this.platform.isBrowser) return;
    this.fbPixelId = pixelId;

    // sprawdź aktualną zgodę Cookiebot
    const currentConsent =
      (globalThis as any).Cookiebot?.consent?.marketing === true;

    if (currentConsent) {
      this.loadFacebookPixelIfNeeded();
    }
    // jeżeli zgoda nie jest jeszcze dana – poczekamy na CookiebotOnAccept w syncFacebookPixelWithConsent
  }

  /**
   * Wysyłka zdarzenia do Facebook Pixel (bezpieczna — ignoruje brak zgody/brak inicjalizacji).
   */
  trackPixel(eventName: string, params: Record<string, any> = {}): void {
    if (!this.platform.isBrowser) return;
    if (!this.fbInitialized) return; // brak zgody/niezaładowany pixel

    const fbq = (window as Window).fbq;
    if (typeof fbq === 'function') {
      try {
        fbq('track', eventName, params);
      } catch {
        // no-op
      }
    }
  }

  /**
   * Alternatywa: niestandardowe eventy (np. 'trackCustom', 'XYZ').
   */
  trackPixelCustom(eventName: string, params: Record<string, any> = {}): void {
    if (!this.platform.isBrowser) return;
    if (!this.fbInitialized) return;

    const fbq = (window as Window).fbq;
    if (typeof fbq === 'function') {
      try {
        fbq('trackCustom', eventName, params);
      } catch {
        // no-op
      }
    }
  }

  /**
   * Inicjalizuje fbq, wstrzykuje skrypt z atrybutem Cookiebot i odpala PageView (raz).
   */
  private loadFacebookPixelIfNeeded(): void {
    if (!this.platform.isBrowser) return;
    if (this.fbInitialized) {
      // już jest — upewnij się, że PageView poleciał choć raz
      this.fireFbPageViewOnce();
      return;
    }
    if (!this.fbPixelId) return;

    // Bootstrap fbq (oficjalny snippet – lekko uproszczony)
    const w = window as Window;
    if (!w.fbq) {
      const fbq: any = function () {
        (fbq.callMethod ? fbq.callMethod : fbq.queue.push).apply(
          fbq,
          arguments as any
        );
      };
      fbq.push = fbq;
      fbq.loaded = false;
      fbq.version = '2.0';
      fbq.queue = [];
      w.fbq = fbq;
      w._fbq = fbq;
    }

    // wstrzyknij skrypt (kontrolowany przez Cookiebot: marketing)
    const src = 'https://connect.facebook.net/en_US/fbevents.js';
    if (!this.document.querySelector(`script[src="${src}"]`)) {
      const s = this.document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-cookieconsent', 'marketing'); // Cookiebot go włączy/wyłączy
      this.document.head.appendChild(s);
      s.addEventListener('load', () => {
        this.initFbInstance();
      });
    } else {
      // skrypt już obecny (np. z poprzedniej wizyty/route) – zainicjuj
      this.initFbInstance();
    }
  }

  private initFbInstance(): void {
    if (!this.fbPixelId) return;
    const fbq = (window as Window).fbq;
    if (typeof fbq !== 'function') return;

    try {
      fbq('init', this.fbPixelId);
      this.fbInitialized = true;
      this.fbqLoaded$.next(true);
      this.fireFbPageViewOnce();
    } catch {
      // no-op
    }
  }

  private fireFbPageViewOnce(): void {
    if (this.fbPageViewFired) return;
    const fbq = (window as Window).fbq;
    if (typeof fbq === 'function') {
      try {
        fbq('track', 'PageView');
        this.fbPageViewFired = true;
      } catch {
        // no-op
      }
    }
  }

  /**
   * Reaguje na zmiany Cookiebot: jeśli marketing = true, ładuje/aktywuje Pixel.
   * Gdy marketing = false – po prostu nie wysyłamy zdarzeń (Pixel nie jest inicjalizowany).
   */
  private syncFacebookPixelWithConsent(marketingGranted: boolean): void {
    if (!this.platform.isBrowser) return;
    if (!this.fbPixelId) return;

    if (marketingGranted) {
      this.loadFacebookPixelIfNeeded();
    }
  }

  trackBuyNowClick(payload: {
    id?: string;
    name?: string;
    value?: number;
    currency?: string;
  }) {
    this.pushEvent('buy_now_click', {
      item_id: payload.id,
      item_name: payload.name,
      value: payload.value,
      currency: payload.currency || 'PLN',
    });

    this.trackPixel('InitiateCheckout', {
      content_ids: payload.id ? [payload.id] : undefined,
      content_name: payload.name,
      value: payload.value,
      currency: payload.currency || 'PLN',
    });

    this.trackPixelCustom('BuyNowClick', {
      content_id: payload.id,
      content_name: payload.name,
      value: payload.value,
      currency: payload.currency || 'PLN',
    });
  }
}
