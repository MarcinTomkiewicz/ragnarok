import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router } from '@angular/router'; // Router do pobierania URL

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly titleService = inject(Title); // Injectowanie Title
  private readonly metaService = inject(Meta); // Injectowanie Meta
  private readonly router = inject(Router); // Injectowanie Router

  // Domyślne wartości
  private readonly defaultDescription = 'Ragnarok – epickie sesje RPG w klimatycznych salach w Poznaniu. Gry fabularne, wynajem pokoi RPG i niezapomniane przygody. Zbierz drużynę i graj!';
  private readonly defaultImageUrl = 'ragnarok.webp'; // Obrazek w głównym katalogu public

  setTitleAndMeta(pageTitle: string, description: string = this.defaultDescription, imageUrl: string = this.defaultImageUrl): void {
    // Bazowy tytuł strony
    const baseTitle = 'Ragnarok - Pokoje do sesji RPG w Poznaniu';
    const fullTitle = `${baseTitle} | ${pageTitle}`;
    this.titleService.setTitle(fullTitle);

    // Ustawienia meta tagów
    const currentUrl = this.router.url;
    const canonicalUrl = `https://ragnarok-rooms.pl${currentUrl}`;

    // Ustawienie linku kanonicznego
    this.metaService.updateTag({
      name: 'canonical',
      content: canonicalUrl,
    });

    // Ustawienie meta description (domyślne lub dynamiczne)
    this.metaService.updateTag({
      name: 'description',
      content: description,
    });

    // Ustawienia Open Graph
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

    // Ustawienia Twitter Card
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
