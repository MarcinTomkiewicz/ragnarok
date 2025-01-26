import {
  Component,
  HostListener,
  Inject,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { WindowRef } from '../../core/services/window-ref';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  standalone: true,
  imports: [CommonModule],
  providers: [Document],
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  showMore = false;
  isLargeScreen = true;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  isScrolledToTop = true;
  isScrolledToBottom = false;
  private readonly document = inject(Document);
  private readonly windowRef = inject(WindowRef);

  // constructor(
  //   @Inject(PLATFORM_ID) private platformId: any
  // ) {}

  ngOnInit(): void {
    this.checkHash();
  }

  ngAfterViewInit() {
    this.scrollContainer.nativeElement.addEventListener(
      'scroll',
      this.updateScrollState.bind(this)
    );
    this.updateScrollState(); // Sprawdzamy początkowy stan
  }

  updateScrollState() {
    const container = this.scrollContainer.nativeElement;
    this.isScrolledToTop = container.scrollTop === 0;
    this.isScrolledToBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight;
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

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.isLargeScreen = window.innerWidth >= 481;
  }

  private checkHash() {
    const window = this.windowRef.nativeWindow;
    if (window) {
      const hash = window.location.hash;
      if (hash) {
        const element = this.document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }

  toggleShowMore() {
    this.showMore = !this.showMore;
    console.log(
      this.isLargeScreen || !this.showMore,
      window.innerWidth,
      this.isLargeScreen,
      !this.showMore
    );
  }
}
