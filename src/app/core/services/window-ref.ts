import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class WindowRef {
  constructor(@Inject(PLATFORM_ID) private platformId: any) {}

  get nativeWindow(): Window | null {
    if (isPlatformBrowser(this.platformId)) {
      return window;
    }
    return null; // Zwroć null po stronie serwera
  }
}