import { 
  Component, TemplateRef, ChangeDetectionStrategy, 
  ChangeDetectorRef, inject, computed, signal, input, viewChild, AfterViewInit, 
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCarousel, NgbCarouselConfig, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { TechStack } from '../../core/interfaces/i-techStack';

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
  items = input<TechStack[]>([]);                  
  itemTemplate = input<TemplateRef<any> | null>(null);

  carousel = viewChild(NgbCarousel);               

  carouselConfig = inject(NgbCarouselConfig);
  private readonly cdr = inject(ChangeDetectorRef);

  screenWidth = signal(window.innerWidth);         
  groupedItems = signal<TechStack[][]>([]);        

  showNavigation = computed(() =>                  
    this.items().length > 4 || this.screenWidth() < 1601
  );

  ngOnInit(): void {
    computed(() => {
      const data = this.items();
      if (data.length) {
        this.initializeGroups();
        this.cdr.detectChanges();
      }
    });
    this.initializeGroups();
    this.observeResize();
  }

  private observeResize(): void {
    const resizeObserver = new ResizeObserver(() => {
      this.screenWidth.set(window.innerWidth);
      this.initializeGroups();
    });
    resizeObserver.observe(document.body);
  }

  private chunkArray(array: TechStack[], chunkSize: number): TechStack[][] {
    return Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, i) =>
      array.slice(i * chunkSize, i * chunkSize + chunkSize)
    );
  }

  private initializeGroups(): void {
    const chunkSize = this.calculateChunkSize();
    this.groupedItems.set(this.chunkArray(this.items(), chunkSize));
  }

  private calculateChunkSize(): number {
    const width = this.screenWidth();
    if (width < 823) return 1;
    if (width < 1201) return 2;
    if (width < 1601) return 3;
    return 4;
  }

  handleSwipeGesture(startX: number, endX: number): void {
    const swipeDistance = startX - endX;
    if (swipeDistance > 50) this.carousel()?.next();
    if (swipeDistance < -50) this.carousel()?.prev();
  }
}
