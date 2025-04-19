import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  AfterViewInit,
  Component,
  HostListener,
  OnInit,
  TransferState,
  ViewChild,
  inject,
  makeStateKey,
  signal,
  viewChild,
} from '@angular/core';
import {
  NgbCarousel,
  NgbCarouselConfig,
  NgbCarouselModule,
} from '@ng-bootstrap/ng-bootstrap';

import { INews } from '../../core/interfaces/i-news';
import { BackendService } from '../../core/services/backend/backend.service';
import { ConverterService } from '../../core/services/converter/converter.service';
import { PlatformService } from '../../core/services/platform/platform.service';
import { Router } from '@angular/router';
import { NewsCarouselComponent } from '../../common/news-carousel/news-carousel.component';

const NEWS_STATE_KEY = makeStateKey<INews[]>('news');

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule, NgOptimizedImage, NewsCarouselComponent],
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
  private readonly state = inject(TransferState);

  ngOnInit() {
    this.backend.getAll<INews>('news', 'created_at', 'desc').subscribe({
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
          link.href = news[0].imageURL;
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
