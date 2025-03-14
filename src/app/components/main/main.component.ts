import { CommonModule, NgOptimizedImage } from '@angular/common';
import { AfterViewInit, Component, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { NgbCarousel, NgbCarouselConfig, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { INews } from '../../core/interfaces/i-news';
import { BackendService } from '../../core/services/backend/backend.service';
import { ConverterService } from '../../core/services/converter/converter.service';
import { PlatformService } from '../../core/services/platform/platform.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule, NgOptimizedImage],
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

  private readonly backend = inject(BackendService);
  private readonly converter = inject(ConverterService);
  private readonly platformService = inject(PlatformService);

  ngOnInit() {
    if (this.platformService.isBrowser) {     
      this.isMobile.set(window.innerWidth <= 768);  
      this.backend.getAll<INews>('news', 'created_at', 'desc').subscribe({
        next: (news: INews[]) => {
          this.newsItems = news.map((item) => ({
            ...item,
            createdAt: this.converter.convert(item.created_at, 'date', 'dd-MM-yyyy HH:mm'),
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
    if (swipeDistance > 50 && this.carousel) this.carousel.next();
    if (swipeDistance < -50 && this.carousel) this.carousel.prev();
  }

  navigate(link: string) {
    if (this.platformService.isBrowser) {
      const isExternal = this.isExternalLink(link);
      
      if (isExternal) {
        window.open(link, '_blank');
      } else {
        window.location.href = link;
      }
    }
  }

  // Funkcja do sprawdzania, czy link jest zewnętrzny
  isExternalLink(url: string): boolean {
    try {
      const link = new URL(url, window.location.href);
      return link.hostname !== window.location.hostname;
    } catch (e) {
      return false;
    }
  }
}
