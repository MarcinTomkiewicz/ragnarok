import { Component, computed, inject, signal } from '@angular/core';
import {
  NgbAccordionModule,
  NgbDropdownModule,
  NgbOffcanvas,
} from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { UserMenuComponent } from '../../common/user-menu/user-menu.component';
import { PlatformService } from '../../core/services/platform/platform.service';
import { IMenu } from '../../core/interfaces/i-menu';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterModule,
    NgOptimizedImage,
    UserMenuComponent,
    NgbDropdownModule,
    NgbAccordionModule,
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  private readonly offcanvasService = inject(NgbOffcanvas);
  private readonly platform = inject(PlatformService);
  private readonly auth = inject(AuthService);
  
  isOffcanvasOpen = signal(false);
  mobileExpanded = new Map<string, boolean>();
  readonly isGuest = computed(() => !this.auth.user());


readonly menuLinks = computed<IMenu[]>(() => {
  const base: IMenu[] = [
    { label: 'O nas', path: '/about' },
    {
      label: 'Oferta',
      children: [
        { label: 'Wynajem Pomieszczeń', path: '/offers/rooms' },
        { label: 'Vouchery', path: '/offers/vouchers' },
        { label: 'Kursy', path: '/offers/courses' },
        { label: 'Sklep', path: '/offers-list' },
      ],
    },
    { label: 'Klub Gier Fabularnych', path: '/memberships' },
    { label: 'Wydarzenia', path: '/events' },
    { label: 'Nasz Zespół', path: '/tech-stack' },
    { label: 'Kontakt', path: '/contact' },
  ];

  // Dodaj pozycję tylko dla niezalogowanego użytkownika
  if (!this.auth.user()) {
    base.push({ label: 'Załóż konto', path: '/auth/register' });
  }

  return base;
});

  openOffcanvas(content: any) {
    if (this.platform.isBrowser) {
      const icon = document.querySelector('.d20-icon');
      icon?.classList.add('spin');
      setTimeout(() => icon?.classList.remove('spin'), 200);
    }

    this.isOffcanvasOpen.set(true);
    this.offcanvasService.open(content, {
      position: 'end',
      panelClass: 'offcanvas-menu',
    });
  }

  toggleMobileSection(label: string): void {
  const current = this.mobileExpanded.get(label);
  this.mobileExpanded.set(label, !current);
}
}
