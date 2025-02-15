import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { NgbCarousel, NgbCarouselConfig, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { INews } from '../../core/interfaces/i-news';
import { BackendService } from '../../core/services/backend/backend.service';
import { ConverterService } from '../../core/services/converter/converter.service';
import { LoaderService } from '../../core/services/loader/loader.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule, NgOptimizedImage],
  providers: [NgbCarouselConfig],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnInit {
  @ViewChild('carousel', { static: false }) carousel: NgbCarousel | undefined;

  isMobile: boolean = window.innerWidth <= 768;
  newsItems: INews[] = [];

  private touchStartX = 0;
  private touchEndX = 0;

  private readonly backend = inject(BackendService)
  private readonly converter = inject(ConverterService)
  private readonly loaderService = inject(LoaderService)
  

  ngOnInit() {
    this.loaderService.show();
    this.backend.getAll<INews>('news', 'created_at', 'asc').subscribe({
      next: (news: INews[]) => {
        this.newsItems = news.map((item) => ({
          ...item,
          createdAt: this.converter.convert(item.created_at, 'date', 'dd-MM-yyyy HH:mm'),
        }));
      },
      error: (err) => console.error('Błąd pobierania newsów:', err),
      complete: () => this.loaderService.hide(),
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.isMobile = window.innerWidth <= 768;
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
    window.open(link);
  }
}
