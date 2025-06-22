import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  AfterViewInit,
  Component,
  HostListener,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import {
  NgbCarousel,
  NgbCarouselConfig,
  NgbCarouselModule,
} from '@ng-bootstrap/ng-bootstrap';

import { animate, style, transition, trigger } from '@angular/animations';
import { INews } from '../../core/interfaces/i-news';
import { BackendService } from '../../core/services/backend/backend.service';
import { ConverterService } from '../../core/services/converter/converter.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { Router } from '@angular/router';
import { NewsCarouselComponent } from '../../common/news-carousel/news-carousel.component';
import { AudienceSectionComponent } from '../audience-section/audience-section.component';
import { HowItWorksComponent } from '../how-it-works/how-it-works.component';
import { UpcomingEventsComponent } from '../upcoming-events/upcoming-events.component';
import { MeetTheTeamComponent } from '../meet-the-team/meet-the-team.component';
import { TestimonialComponent } from '../testimonial/testimonial.component';
import { HighlightComponent } from '../../common/highlight/highlight.component';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    CommonModule,
    NgbCarouselModule,
    AudienceSectionComponent,
    HowItWorksComponent,
    UpcomingEventsComponent,
    MeetTheTeamComponent,
    TestimonialComponent,
    HighlightComponent,
  ],
  providers: [NgbCarouselConfig],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnInit, AfterViewInit {
  @ViewChild('carousel', { static: false }) carousel: NgbCarousel | undefined;
  isLoading = signal(true);
  isMobile = signal(false);
  newsItems: INews[] = [];
  private touchStartX = 0;
  private touchEndX = 0;

  private readonly router = inject(Router);
  private readonly backend = inject(BackendService);
  private readonly converter = inject(ConverterService);
  private readonly platformService = inject(PlatformService);

  highlightData = {
    heading: 'Graj w RPG bez ograniczeń!',
    text: 'Szukasz sposobu na wakacje pełne RPG? Złoty Bilet do Valhalli to miesięczny dostęp do gry w salce RPG bez limitu godzinowego – dla Ciebie i Twojej ekipy. Zniżki na Mistrza Gry, darmowe wydarzenia i rabaty obowiązujące do końca 2025 roku. Tylko 30 miejsc – zdobądź swój bilet już dziś, zanim znikną.',
    link: '/special/2',
    linkText: 'Zdobądź swój bilet',
    icon: 'bi bi-ticket-detailed',
  };

  ngOnInit() {
    this.backend
      .getAll<INews>('news', 'created_at', 'desc', { page: 1, pageSize: 5 })
      .subscribe({
        next: (news: INews[]) => {
          this.newsItems = news.map((item) => ({
            ...item,
            createdAt: this.converter.convert(
              item.created_at,
              'date',
              'dd-MM-yyyy HH:mm'
            ),
          }));

          if (news.length > 0) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = news[0].image;
            document.head.appendChild(link);
          }
        },
        error: (err) => console.error('Błąd pobierania newsów:', err),
        complete: () => {
          if (this.platformService.isBrowser) {
            this.isLoading.set(false);
          }
        },
      });
    if (this.platformService.isBrowser) {
      this.isMobile.set(window.innerWidth <= 768);
    }
  }

  ngAfterViewInit() {
    if (this.platformService.isBrowser) {
      this.addResizeListener();
    }
  }

  addResizeListener() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    this.isMobile.set(window.innerWidth <= 768);
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

  handleSwipeGesture() {
    const swipeDistance = this.touchStartX - this.touchEndX;
    const carouselInstance = this.carousel;
    if (!carouselInstance) return;

    if (swipeDistance > 50) carouselInstance.next();
    if (swipeDistance < -50) carouselInstance.prev();
  }

  navigate(link: string) {
    if (!this.platformService.isBrowser) return;

    if (this.isExternalLink(link)) {
      window.open(link, '_blank');
    } else {
      this.router.navigateByUrl(link); // Zamiast window.location.href
    }
  }

  isExternalLink(url: string): boolean {
    try {
      const link = new URL(url, window.location.href);
      return link.hostname !== window.location.hostname;
    } catch (e) {
      return false;
    }
  }
}
