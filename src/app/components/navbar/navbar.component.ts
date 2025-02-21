import { Component, inject, signal } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  private readonly offcanvasService = inject(NgbOffcanvas);
  isOffcanvasOpen = signal(false);

  menuLinks = [
    { label: 'O nas', path: '/about' },
    { label: 'Cennik', path: '/services' },
    { label: 'Nasz zespół', path: '/tech-stack' },
    { label: 'Pomieszczenia', path: '/our-rooms' },
    { label: 'Kontakt', path: '/contact' },
  ];

  openOffcanvas(content: any) {
    this.isOffcanvasOpen.set(true);
    this.offcanvasService.open(content, { position: 'end', panelClass: 'offcanvas-menu' });
  }
}
