import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common'; // Poprawne wstrzyknięcie DOCUMENT
import { PlatformService } from '../platform/platform.service';

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly router = inject(Router);
  private readonly platformService = inject(PlatformService);
  private readonly document: Document = inject(DOCUMENT);

  private readonly defaultDescription =
    'Ragnarok to przestrzeń dla fanów RPG w Poznaniu. Wynajem sal na sesje, sprzedaż podręczników i akcesoriów oraz wydarzenia dla miłośników gier fabularnych.';
  private readonly defaultImageUrl = 'ragnarok.webp';

  setTitleAndMeta(pageTitle: string, description: string = this.defaultDescription, imageUrl: string = this.defaultImageUrl): void {
    const baseTitle = 'Ragnarok - Centrum Gier Fabularnych';
    const fullTitle = `${baseTitle} | ${pageTitle}`;
    this.titleService.setTitle(fullTitle);

    let canonicalUrl = 'https://ragnarok-rooms.pl';
    if (this.platformService.isBrowser) {
      const currentUrl = this.router.url;
      canonicalUrl = `https://ragnarok-rooms.pl${currentUrl}`;
    }

    this.metaService.updateTag({ name: 'canonical', content: canonicalUrl });
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ property: 'og:title', content: fullTitle });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:image', content: imageUrl });
    this.metaService.updateTag({ name: 'twitter:title', content: fullTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    this.metaService.updateTag({ name: 'twitter:image', content: imageUrl });
  }

  loadTrackingScripts(): void {
    if (!this.platformService.isBrowser) return; // Unikamy ładowania w SSR

    this.loadScript('https://www.googletagmanager.com/gtm.js?id=GTM-P5FPPLDC');
    this.loadScript('https://www.googletagmanager.com/gtag/js?id=AW-16834781429', true);
    this.loadFacebookPixel();
  }

  private loadScript(src: string, async: boolean = false): void {
    if (this.document.querySelector(`script[src="${src}"]`)) return; // Zapobiega duplikatom
    const script = this.document.createElement('script');
    script.src = src;
    script.defer = true;
    script.async = async;
    this.document.body.appendChild(script);
  }

  private loadFacebookPixel(): void {
    if (this.document.querySelector(`script[src*="facebook.net/fbevents.js"]`)) return;
    const script = this.document.createElement('script');
    script.innerHTML = `
      !(function(f,b,e,v,n,t,s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", "3926612600944622");
      fbq("track", "PageView");
    `;
    this.document.body.appendChild(script);
  }
}
