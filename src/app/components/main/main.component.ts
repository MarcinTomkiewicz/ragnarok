import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  inject,
  Input,
  ViewChild,
  HostListener,
  OnInit,
} from '@angular/core';
import {
  NgbCarousel,
  NgbCarouselConfig,
  NgbCarouselModule,
} from '@ng-bootstrap/ng-bootstrap';
import { Router, RouterLink } from '@angular/router';
import { BackendService } from '../../core/services/backend/backend.service';
import { INews } from '../../core/interfaces/i-news';
import { ConverterService } from '../../core/services/converter/converter.service';
import { LoaderService } from '../../core/services/loader/loader.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbCarouselModule],
  providers: [NgbCarouselConfig],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnInit {
  router = inject(Router);
  el = inject(ElementRef);
  @ViewChild('carousel', { static: false }) carousel: NgbCarousel | undefined;

  carouselConfig = inject(NgbCarouselConfig);
  backend = inject(BackendService);
  converter = inject(ConverterService)
  loaderService = inject(LoaderService)

  isMobile: boolean = window.innerWidth <= 768;

  private touchStartX = 0;
  private touchEndX = 0;

  public newsItems!: INews[];

  ngOnInit() {
    this.loaderService.show();
    
    this.backend.getAll<INews>('news').subscribe({
      next: (news: INews[]) => {
        this.newsItems = news.map((item) => ({
          ...item,
          createdAt: this.converter.convert(item.created_at, 'date', 'dd-MM-yyyy HH:mm')
        }));
  
      },
      error: (err) => console.error('Błąd pobierania newsów:', err),
      complete: () => this.loaderService.hide(),
    });

  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
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

  handleSwipeGesture(): void {
    const swipeDistance = this.touchStartX - this.touchEndX;
    if (swipeDistance > 50 && this.carousel) this.carousel.next();
    if (swipeDistance < -50 && this.carousel) this.carousel.prev();
  }

  navigate(link: string) {
    window.open(link);
    
  }
}
