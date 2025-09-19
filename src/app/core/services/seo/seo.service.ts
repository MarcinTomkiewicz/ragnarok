import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { PlatformService } from '../platform/platform.service';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly platform = inject(PlatformService);
  private readonly document: Document = inject(DOCUMENT);

  private readonly defaultDescription =
    'Ragnarok to przestrzeń dla fanów RPG w Poznaniu. Wynajem sal na sesje, sprzedaż podręczników i akcesoriów oraz wydarzenia dla miłośników gier fabularnych.';
  private readonly defaultImageUrl = 'https://ragnarok-rooms.pl/ragnarok.webp';
  private readonly siteUrl = 'https://ragnarok-rooms.pl';

  setTitleAndMeta(
    pageTitle: string,
    description: string = this.defaultDescription,
    imageUrl: string = this.defaultImageUrl
  ): void {
    const baseTitle = 'Ragnarok - Centrum Gier Fabularnych';
    const fullTitle = `${baseTitle} | ${pageTitle}`;
    this.titleService.setTitle(fullTitle);

    const path = this.platform.isBrowser ? this.router.url : '/';
    const canonicalUrl =
      `${this.siteUrl}${path}`.replace(/\/+$/, '') || this.siteUrl;

    this.upsertLinkCanonical(canonicalUrl);

    this.meta.updateTag({ name: 'description', content: description });

    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: imageUrl });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:locale', content: 'pl_PL' });

    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: imageUrl });
  }

  private upsertLinkCanonical(href: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
