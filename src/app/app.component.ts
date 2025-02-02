import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/footer/footer.component';
import { MainComponent } from './components/main/main.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HeaderComponent } from './components/header/header.component';
import { AboutComponent } from './components/about/about.component';
import { ServicesComponent } from './components/services/services.component';
import { PortfolioComponent } from './components/portfolio/portfolio.component';
import { ContactComponent } from './components/contact/contact.component';
import { TechStackComponent } from './components/tech-stack/tech-stack.component';
import { OurRoomsComponent } from './components/our-rooms/our-rooms.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FooterComponent,
    MainComponent,
    NavbarComponent,
    HeaderComponent,
    AboutComponent,
    ServicesComponent,
    OurRoomsComponent,
    ContactComponent,
    TechStackComponent
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'ragnarok';
  @ViewChild('services') services!: ElementRef;

  navigateToServices() {
    if (this.services) {
      this.services.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      console.error('Services element is undefined');
    }
  }
}
