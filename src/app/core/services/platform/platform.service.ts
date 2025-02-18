import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PlatformService {
  private readonly _isBrowser: boolean;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this._isBrowser = isPlatformBrowser(platformId);
  }

  get isBrowser(): boolean {
    return this._isBrowser;
  }
}
