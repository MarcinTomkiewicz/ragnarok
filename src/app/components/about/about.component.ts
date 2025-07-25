import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { PlatformService } from '../../core/services/platform/platform.service';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent {
  showMore = signal(false);
  isLargeScreen = signal(false);

  private readonly seo = inject(SeoService);
  private readonly platformService = inject(PlatformService);

  constructor() {
    if (this.platformService.isBrowser) {
      this.isLargeScreen.set(window.innerWidth >= 481);
      this.observeResize();
    }
  }

  ngOnInit(): void {
    this.seo.setTitleAndMeta('O nas');
    this.checkHash(); // tylko jeśli chcesz wspierać #kotwice
  }

  toggleShowMore() {
    this.showMore.set(!this.showMore());
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
}
