import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router } from '@angular/router'; // Router do pobierania URL
import { PlatformService } from '../platform/platform.service';

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly router = inject(Router);
  private readonly platformService = inject(PlatformService);

  private readonly defaultDescription = 'Ragnarok – epickie sesje RPG w klimatycznych salach w Poznaniu. Gry fabularne, wynajem pokoi RPG i niezapomniane przygody. Zbierz drużynę i graj!';
  private readonly defaultImageUrl = 'ragnarok.webp';

  setTitleAndMeta(pageTitle: string, description: string = this.defaultDescription, imageUrl: string = this.defaultImageUrl): void {
    const baseTitle = 'Ragnarok - Pokoje do sesji RPG w Poznaniu';
    const fullTitle = `${baseTitle} | ${pageTitle}`;
    this.titleService.setTitle(fullTitle);

    
    let canonicalUrl = 'https://ragnarok-rooms.pl';
    if (this.platformService.isBrowser) {
      const currentUrl = this.router.url;
      canonicalUrl = `https://ragnarok-rooms.pl${currentUrl}`;
    }

    this.metaService.updateTag({
      name: 'canonical',
      content: canonicalUrl,
    });

    this.metaService.updateTag({
      name: 'description',
      content: description,
    });

    this.metaService.updateTag({
      property: 'og:title',
      content: fullTitle,
    });
    this.metaService.updateTag({
      property: 'og:description',
      content: description,
    });
    this.metaService.updateTag({
      property: 'og:image',
      content: imageUrl,
    });

    this.metaService.updateTag({
      name: 'twitter:title',
      content: fullTitle,
    });
    this.metaService.updateTag({
      name: 'twitter:description',
      content: description,
    });
    this.metaService.updateTag({
      name: 'twitter:image',
      content: imageUrl,
    });
  }
}
