import { Component, HostListener, inject, ViewChild } from '@angular/core';
import { TechStack } from '../../core/interfaces/i-techStack';
import { CommonModule } from '@angular/common';
import { NgbCarousel, NgbCarouselConfig, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-tech-stack',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule],
  providers: [NgbCarouselConfig],
  templateUrl: './tech-stack.component.html',
  styleUrl: './tech-stack.component.scss'
})
export class TechStackComponent {
  techStack: TechStack[] = [
    {
      name: 'JavaScript',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png',
      websiteUrl: 'https://www.javascript.com/',
      description: 'JavaScript to język programowania wykorzystywany do tworzenia dynamicznych treści na stronach internetowych.'
    },
    {
      name: 'TypeScript',
      logoUrl: 'ts-logo-round-512.png',
      websiteUrl: 'https://www.typescriptlang.org/',
      description: 'TypeScript to nadzbiór JavaScriptu, który dodaje statyczne typowanie do języka.'
    },
    {
      name: 'Angular',
      logoUrl: 'https://angular.io/assets/images/logos/angular/angular.svg',
      websiteUrl: 'https://angular.io/',
      description: 'Angular to platforma do budowania aplikacji internetowych na urządzenia mobilne i komputery stacjonarne.'
    },
    {
      name: 'RxJS',
      logoUrl: 'https://rxjs.dev/generated/images/marketing/home/Rx_Logo-512-512.png',
      websiteUrl: 'https://rxjs.dev/',
      description: 'RxJS to biblioteka do programowania reaktywnego przy użyciu obserwowalnych strumieni danych.'
    },
    {
      name: 'Bootstrap',
      logoUrl: 'https://getbootstrap.com/docs/5.1/assets/brand/bootstrap-logo.svg',
      websiteUrl: 'https://getbootstrap.com/',
      description: 'Bootstrap to popularny framework do budowania responsywnych stron internetowych przyjaznych dla urządzeń mobilnych.'
    },
    {
      name: 'Angular Bootstrap',
      logoUrl: 'https://ng-bootstrap.github.io/img/logo-stack.svg',
      websiteUrl: 'https://ng-bootstrap.github.io/',
      description: 'Angular Bootstrap to zestaw komponentów Angulara opartych na frameworku Bootstrap.'
    },
    {
      name: 'SCSS',
      logoUrl: 'https://sass-lang.com/assets/img/styleguide/seal-color.png',
      websiteUrl: 'https://sass-lang.com/',
      description: 'SCSS to preprocesor CSS, który dodaje zmienne, zagnieżdżanie i inne zaawansowane funkcje do kodu CSS.'
    },
    {
      name: 'Strapi',
      logoUrl: 'https://strapi.io/assets/strapi-logo.svg',
      websiteUrl: 'https://strapi.io/',
      description: 'Strapi to otwartoźródłowy headless CMS zbudowany przy użyciu JavaScriptu.'
    },
    {
      name: 'Firebase',
      logoUrl: 'https://firebase.google.com/downloads/brand-guidelines/PNG/logo-vertical.png',
      websiteUrl: 'https://firebase.google.com/',
      description: 'Firebase to platforma Google służąca do tworzenia aplikacji mobilnych i internetowych.'
    },
    {
      name: 'npm',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/db/Npm-logo.svg',
      websiteUrl: 'https://www.npmjs.com/',
      description: 'npm (Node Package Manager) to menedżer pakietów dla JavaScriptu, używany do instalowania i zarządzania bibliotekami.'
    },
    {
      name: 'Node.js',
      logoUrl: 'https://nodejs.org/static/logos/nodejsDark.svg',
      websiteUrl: 'https://nodejs.org/',
      description: 'Node.js to środowisko uruchomieniowe JavaScriptu po stronie serwera, które umożliwia budowanie skalowalnych aplikacji sieciowych.'
    },
    {
      name: 'Git',
      logoUrl: 'https://git-scm.com/images/logos/downloads/Git-Logo-2Color.png',
      websiteUrl: 'https://git-scm.com/',
      description: 'Git to rozproszony system kontroli wersji używany do śledzenia zmian w kodzie źródłowym.'
    },
    {
      name: 'GitHub',
      logoUrl: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      websiteUrl: 'https://github.com/',
      description: 'GitHub to platforma hostingowa dla projektów programistycznych oparta na systemie kontroli wersji Git.'
    }
  ];

  techStackGroups: TechStack[][] = [];
  carouselConfig = inject(NgbCarouselConfig);
  @ViewChild('carousel', { static: false }) carousel: NgbCarousel | undefined;
  // carousel = inject(NgbCarousel)

  private touchStartX = 0;
  private touchEndX = 0;

  constructor() {
    this.initializeTechStackGroups();
  }

   // Funkcja do dzielenia tablicy na grupy
   chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  }

  // Funkcja do inicjalizacji grup kart
  initializeTechStackGroups(): void {
    const chunkSize = this.calculateChunkSize();
    this.techStackGroups = this.chunkArray(this.techStack, chunkSize);
  }

  // Funkcja do obliczenia rozmiaru grupy na podstawie szerokości ekranu
  calculateChunkSize(): number {
    if (typeof window !== 'undefined') { // Upewniamy się, że kod jest uruchamiany w przeglądarce
      const screenWidth = window.innerWidth;
      if (screenWidth < 768) {
        return 1;
      } else if (screenWidth < 1000) {
        return 2;
      }
      else if (screenWidth < 1200) {
        return 3;
      } 
    }
    return 5;
  }

  trackTechs(index: number, item: TechStack[]): string {
    return item[0].name;
  }

  trackById(index: number, item: TechStack): string {
    return item.name; // Zakładamy, że nazwa technologii jest unikalnym identyfikatorem
  }

  // Event listener do aktualizacji grup przy zmianie rozmiaru okna
  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.initializeTechStackGroups();
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipeGesture();
  }

  handleSwipeGesture(): void {
    const swipeDistance = this.touchStartX - this.touchEndX;

    // Przesunięcie w lewo (next slide)
    if (swipeDistance > 50 && this.carousel) {
      this.carousel.next();
    }

    // Przesunięcie w prawo (previous slide)
    if (swipeDistance < -50 && this.carousel) {
      this.carousel.prev();
    }
  }
}
