import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements AfterViewInit {
  showMore = signal(false);
  isScrolledToTop = signal(true);
  isScrolledToBottom = signal(false);
  isLargeScreen = signal(false);
  private readonly seo = inject(SeoService);

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  private readonly platformService = inject(PlatformService);

  constructor() {
    // Ustawiamy wartość ekranu tylko w CSR
    if (this.platformService.isBrowser) {
      this.isLargeScreen.set(window.innerWidth >= 481);
      this.observeResize();
    }
  }

  ngOnInit(): void {
    this.seo.setTitleAndMeta('O nas');
  }

  ngAfterViewInit() {
    if (!this.platformService.isBrowser) return;

    this.scrollContainer.nativeElement.addEventListener('scroll', () =>
      this.updateScrollState()
    );
    this.updateScrollState();
    this.checkHash();
  }

  private updateScrollState() {
    const container = this.scrollContainer.nativeElement;
    this.isScrolledToTop.set(container.scrollTop === 0);
    this.isScrolledToBottom.set(
      container.scrollTop + container.clientHeight >= container.scrollHeight
    );
  }

  scrollUp() {
    this.scrollContainer.nativeElement.scrollBy({
      top: -50,
      behavior: 'smooth',
    });
  }

  scrollDown() {
    this.scrollContainer.nativeElement.scrollBy({
      top: 50,
      behavior: 'smooth',
    });
  }

  private observeResize(): void {
    if (!this.platformService.isBrowser) return;

    const resizeObserver = new ResizeObserver(() => {
      this.isLargeScreen.set(window.innerWidth >= 481);
    });
    resizeObserver.observe(document.body);
  }

  private checkHash() {
    if (!this.platformService.isBrowser) return;

    const hash = window.location.hash;
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  toggleShowMore() {
    this.showMore.set(!this.showMore());
  }
}
