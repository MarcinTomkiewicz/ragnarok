import { Injectable, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ENV_GOOGLE_MAPS_API_KEY } from '../../tokens';

type ImportLibrary = (name: 'maps' | 'marker' | 'places' | string) => Promise<any>;

@Injectable({ providedIn: 'root' })
export class MapLoaderService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiKey = inject(ENV_GOOGLE_MAPS_API_KEY, { optional: true });

  private loadingPromise: Promise<void> | null = null;

  load(libraries: string[] = ['marker']): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve();

    const g = globalThis as any;
    if (g.google?.maps?.importLibrary) return Promise.resolve();

    if (this.loadingPromise) return this.loadingPromise;

    if (!this.apiKey) {
      return Promise.reject(new Error('Missing ENV_GOOGLE_MAPS_API_KEY'));
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      v: 'weekly',
    });
    if (libraries.length) params.set('libraries', libraries.join(','));

    const src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    this.loadingPromise = new Promise<void>((resolve, reject) => {
      if (this.document.querySelector(`script[src^="https://maps.googleapis.com/maps/api/js?"]`)) {
        resolve(); return;
      }
      const s = this.document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Google Maps JS failed to load'));
      this.document.head.appendChild(s);
    });

    return this.loadingPromise;
  }

  async importLibrary<T = any>(name: string): Promise<T> {
    await this.load();
    const g = globalThis as any;
    return (g.google.maps.importLibrary as ImportLibrary)(name as any) as Promise<T>;
  }
}
