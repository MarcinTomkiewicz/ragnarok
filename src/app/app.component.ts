import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Event, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, RouteConfigLoadEnd, RouteConfigLoadStart, Router, RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/footer/footer.component';
import { MainComponent } from './components/main/main.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HeaderComponent } from './components/header/header.component';
import { AboutComponent } from './components/about/about.component';
import { ServicesComponent } from './components/services/services.component';
import { ContactComponent } from './components/contact/contact.component';
import { TechStackComponent } from './components/tech-stack/tech-stack.component';
import { OurRoomsComponent } from './components/our-rooms/our-rooms.component';
import { LoaderComponent } from './common/loader/loader.component';
import { LoaderService } from './core/services/loader/loader.service';

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
  private readonly loaderService = inject(LoaderService)
  private readonly router = inject(Router)

  ngOnInit(): void {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationStart || event instanceof RouteConfigLoadStart) {
        this.loaderService.show();
      } 
      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError || event instanceof RouteConfigLoadEnd) {
        this.loaderService.hide();
      }
    });
  }

  navigateToServices() {
    if (this.services) {
      this.services.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      console.error('Services element is undefined');
    }
  }
}
