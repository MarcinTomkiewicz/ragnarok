import { Injectable, inject } from '@angular/core';
import { PlatformService } from '../platform/platform.service';

@Injectable({ providedIn: 'root' })
export class GtmService {
  private readonly platform = inject(PlatformService);

  private gtmId = 'GTM-P5FPPLDC';

  init() {
    if (!this.platform.isBrowser) return;

    const win = this.platform.getWindow();
    // if (!win.dataLayer) {
    //   (win as any).dataLayer = [];
    // }
    console.log(win);
    
    (win as any).dataLayer.push({ event: 'gtm.js', 'gtm.start': Date.now() });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${this.gtmId}`;
    document.head.appendChild(script);

    // Wypełnij noscript dla fallbacku
    const iframe = `<iframe src="https://www.googletagmanager.com/ns.html?id=${this.gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    const noscript = document.getElementById('gtm-noscript');
    if (noscript) noscript.innerHTML = iframe;
  }

  pushEvent(event: any) {
    if (this.platform.isBrowser && (window as any).dataLayer) {
      (window as any).dataLayer.push(event);
    }
  }
}
