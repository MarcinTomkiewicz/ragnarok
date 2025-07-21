import { isPlatformBrowser } from '@angular/common';
import {
  Injectable,
  PLATFORM_ID,
  inject,
  NgZone,
  RendererFactory2,
  Renderer2,
} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private readonly renderer: Renderer2;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  getWindow(): Window | null {
    return this.isBrowser ? window : null;
  }

  getLocation(): Location | null {
    return this.isBrowser ? window.location : null;
  }

  listenToWindowEvent(
    type: keyof WindowEventMap,
    handler: (event: Event) => void
  ): void {
    if (this.isBrowser) {
      this.ngZone.runOutsideAngular(() => {
        window.addEventListener(type, handler);
      });
    }
  }

  preloadImage(url: string): void {
    if (this.isBrowser && url) {
      const link = this.renderer.createElement('link');
      this.renderer.setAttribute(link, 'rel', 'preload');
      this.renderer.setAttribute(link, 'as', 'image');
      this.renderer.setAttribute(link, 'href', url);
      this.renderer.appendChild(document.head, link);
    }
  }

  openNewTab(url: string): void {
    if (this.isBrowser) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
