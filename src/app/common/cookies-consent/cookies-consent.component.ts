import { Component, effect, inject, signal } from '@angular/core';
import { PlatformService } from '../../core/services/platform/platform.service';

@Component({
  selector: 'app-cookies-consent',
  standalone: true,
  templateUrl: './cookies-consent.component.html',
  styleUrl: './cookies-consent.component.scss',
})
export class CookiesConsentComponent {
  private readonly platform = inject(PlatformService);
  visible = signal(false);

  constructor() {
    const consent = this.getCookie('cookie_consent');
    if (!consent) {
      this.visible.set(true);
    } else if (consent === 'all') {
      this.loadThirdPartyScripts();
    }
  }

  acceptAll(): void {
    this.setCookie('cookie_consent', 'all', 365);
    this.loadThirdPartyScripts();
    this.visible.set(false);
  }

  acceptRequired(): void {
    this.setCookie('cookie_consent', 'required', 365);
    this.visible.set(false);
  }

  private setCookie(name: string, value: string, days: number): void {
    if (!this.platform.isBrowser) return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; path=/; expires=${expires}; SameSite=Lax`;
  }

  private getCookie(name: string): string | null {
    if (!this.platform.isBrowser) return null;
    const cookies = document.cookie.split('; ');
    const match = cookies.find((c) => c.startsWith(`${name}=`));
    return match ? match.split('=')[1] : null;
  }

  private loadThirdPartyScripts(): void {
    if (!this.platform.isBrowser) return;

    // Google Tag Manager
    const gtm = document.createElement('script');
    gtm.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-P5FPPLDC';
    gtm.async = true;
    document.head.appendChild(gtm);

    // Google Analytics
    const ga = document.createElement('script');
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=AW-16834781429';
    ga.async = true;
    document.head.appendChild(ga);

    // Typ-safe przypisanie GTAG i dataLayer
    const w = window as any;

    w.dataLayer = w.dataLayer || [];
    w.gtag = function (...args: any[]) {
      w.dataLayer.push(args);
    };

    w.gtag('js', new Date());
    w.gtag('config', 'AW-16834781429');
  }
}
