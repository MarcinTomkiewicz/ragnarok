import { Component, HostListener, Input, ViewChild, AfterViewInit, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCarousel, NgbCarouselConfig, NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';
import { TechStack } from '../../core/interfaces/i-techStack';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, NgbCarouselModule],
  providers: [NgbCarouselConfig],
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss']
})
export class CarouselComponent implements AfterViewInit {
  @Input() items!: TechStack[]; // Elementy do wyświetlenia w karuzeli
  @Input() itemTemplate!: TemplateRef<any>; // Template dla elementów
  @ViewChild('carousel', { static: false }) carousel: NgbCarousel | undefined;
  carouselConfig = inject(NgbCarouselConfig);

  groupedItems: TechStack[][] = [];
  private touchStartX = 0;
  private touchEndX = 0;
  public screenWidth = window.innerWidth;

  ngAfterViewInit(): void {
    this.initializeGroups();
    console.log(this.carouselConfig);
    
  }

  chunkArray(array: TechStack[], chunkSize: number): TechStack[][] {
    const result: TechStack[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  }

  setShowNavigation() {
    return this.items.length > 4 || this.screenWidth < 1200
  }

  initializeGroups(): void {
    const chunkSize = this.calculateChunkSize();
    this.groupedItems = this.chunkArray(this.items, chunkSize);
  }

  calculateChunkSize(): number {
    
    if (this.screenWidth < 768) return 1;
    if (this.screenWidth < 1000) return 2;
    if (this.screenWidth < 1200) return 3;
    return 5;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.initializeGroups();
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

  trackByGroup(index: number, item: TechStack[]): any {
    return index;
  }

  trackByFn(index: number, item: TechStack): any {
    return index;
  }
}