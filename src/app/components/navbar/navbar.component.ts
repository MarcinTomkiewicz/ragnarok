import { Component, inject, signal } from '@angular/core';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, NgOptimizedImage],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  private readonly offcanvasService = inject(NgbOffcanvas);
  isOffcanvasOpen = signal(false);

  menuLinks = [
    { label: 'O nas', path: '/about' },
    { label: 'Cennik', path: '/services' },
    { label: 'Oferta', path: '/offers-list'},
    { label: 'Wydarzenia', path: '/events'},
    { label: 'Nasz zespół', path: '/tech-stack' },
    { label: 'Pomieszczenia', path: '/our-rooms' },
    { label: 'Kontakt', path: '/contact' },
  ];

  openOffcanvas(content: any) {
    const icon = document.querySelector('.d20-icon');
    if (icon) {
      icon.classList.add('spin'); // Dodajemy animację
    }

    setTimeout(() => {
      this.isOffcanvasOpen.set(true);
      this.offcanvasService.open(content, {
        position: 'end',
        panelClass: 'offcanvas-menu',
      });

      if (icon) {
        icon.classList.remove('spin');
      }
    }, 200);
  }
}
