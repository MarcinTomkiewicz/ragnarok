import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  Event,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { PlatformService } from './core/services/platform/platform.service';
import { SeoService } from './core/services/seo/seo.service'; // Wstrzykiwanie SeoService
import { ToastContainerComponent } from './common/toast-container/toast-container.component';

declare let fbq: Function;
declare let gtag: Function;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FooterComponent,
    RouterOutlet,
    NavbarComponent,
    HeaderComponent,
    ToastContainerComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly platformService = inject(PlatformService);
  private readonly seoService = inject(SeoService);

  ngOnInit(): void {
    if (this.platformService.isBrowser) {
      this.seoService.setTitleAndMeta('Strona Główna');
      this.seoService.loadTrackingScripts();

      this.router.events.subscribe((event: Event) => {
        if (event instanceof NavigationEnd) {
          this.trackPageView(event.urlAfterRedirects);
        }
      });
    }
  }

  private trackPageView(url: string): void {
    if (typeof gtag === 'function') {
      gtag('event', 'page_view', { page_path: url });
    }

    if (typeof fbq === 'function') {
      fbq('track', 'PageView', { page_path: url });

      const events: Record<string, string> = {
        '/services': 'ViewServices',
        '/contact': 'ViewContact',
      };

      if (events[url]) {
        fbq('track', events[url]);
      }
    }
  }
}
