import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Event, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, RouteConfigLoadEnd, RouteConfigLoadStart, Router, RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HeaderComponent } from './components/header/header.component';
import { LoaderComponent } from './common/loader/loader.component';
import { LoaderService } from './core/services/loader/loader.service';

declare let fbq: Function; // Deklaracja Meta Pixel

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FooterComponent,
    RouterOutlet,
    NavbarComponent,
    HeaderComponent,
    LoaderComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'ragnarok';
  @ViewChild('services') services!: ElementRef;
  private readonly loaderService = inject(LoaderService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationStart || event instanceof RouteConfigLoadStart) {
        this.loaderService.show();
      } 
      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError || event instanceof RouteConfigLoadEnd) {
        this.loaderService.hide();
      }

      // Jeśli trasa została załadowana, wyślij zdarzenie do Facebook Pixel
      if (event instanceof NavigationEnd) {
        this.trackPageView(event.urlAfterRedirects);
      }
    });
  }

  trackPageView(url: string) {
    if (typeof fbq === 'function') {
      console.log(`Tracking page: ${url}`); // Debugowanie

      // Standardowe zdarzenie PageView dla każdej strony
      fbq('track', 'PageView', { page_path: url });

      // Niestandardowe zdarzenia dla konkretnych podstron
      if (url === '/services') {
        fbq('track', 'ViewServices');
      } else if (url === '/contact') {
        fbq('track', 'ViewContact');
      }
    }
  }

  navigateToServices() {
    if (this.services) {
      this.services.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      console.error('Services element is undefined');
    }
  }
}
