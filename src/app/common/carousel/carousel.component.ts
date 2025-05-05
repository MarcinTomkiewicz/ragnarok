import { 
  Component, TemplateRef, ChangeDetectionStrategy, 
  ChangeDetectorRef, inject, computed, signal, input, viewChild, OnInit 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCarousel, NgbCarouselConfig, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { TechStack } from '../../core/interfaces/i-techStack';
import { PlatformService } from '../../core/services/platform/platform.service';
import { IRooms } from '../../core/interfaces/i-rooms';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule],
  providers: [NgbCarouselConfig],
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  // changeDetection: ChangeDetectionStrategy.OnPush
})
export class CarouselComponent implements OnInit {
  items = input<TechStack[] | IRooms[]>([]);
  itemTemplate = input<TemplateRef<any> | null>(null);

  carousel = viewChild(NgbCarousel);

  carouselConfig = inject(NgbCarouselConfig);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformService = inject(PlatformService);

  /** Szerokość ekranu jako Signal */
  screenWidth = signal(0);

  /** Zgrupowane elementy na podstawie szerokości */
  groupedItems = signal<TechStack[][] | IRooms[][]>([]);

  /** Czy pokazywać nawigację */
  showNavigation = computed(() => 
    this.items().length > 4 || this.screenWidth() < 1601
  );

  ngOnInit(): void {
    // Jeśli jesteśmy w przeglądarce, ustawiamy szerokość ekranu i obserwujemy zmiany
    if (this.platformService.isBrowser) {
      this.screenWidth.set(window.innerWidth);
      this.observeResize();
    }

    computed(() => {
      const data = this.items();
      if (data.length) {
        this.initializeGroups();
        this.cdr.detectChanges();
      }
    });
    this.initializeGroups();
  }

  /** Obserwacja zmian szerokości ekranu (tylko w przeglądarce) */
  private observeResize(): void {
    if (!this.platformService.isBrowser) return;

    const resizeObserver = new ResizeObserver(() => {
      this.screenWidth.set(window.innerWidth);
      this.initializeGroups();
    });
    resizeObserver.observe(document.body);
  }

  /** Podział elementów na grupy */
  private chunkArray(array: TechStack[] | IRooms[], chunkSize: number): TechStack[][]  | IRooms[][]{
    return Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, i) =>
      array.slice(i * chunkSize, i * chunkSize + chunkSize)
    );
  }

  /** Inicjalizacja grup na podstawie szerokości */
  private initializeGroups(): void {
    const chunkSize = this.calculateChunkSize();
    this.groupedItems.set(this.chunkArray(this.items(), chunkSize));
  }

  /** Obliczanie rozmiaru grupy na podstawie szerokości */
  private calculateChunkSize(): number {
    const width = this.screenWidth();
    if (width < 823) return 1;
    if (width < 1201) return 2;
    if (width < 1601) return 3;
    return 4;
  }

  /** Obsługa gestów przesuwania */
  handleSwipeGesture(startX: number, endX: number): void {
    const swipeDistance = startX - endX;
    if (swipeDistance > 50) this.carousel()?.next();
    if (swipeDistance < -50) this.carousel()?.prev();
  }
}
