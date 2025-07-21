import { Component, inject, signal } from '@angular/core';
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
  
  isOffcanvasOpen = signal(false);
  mobileExpanded = new Map<string, boolean>();

  menuLinks: IMenu[] = [
    { label: 'O nas', path: '/about' },
    {
      label: 'Oferta',
      children: [
        { label: 'Wynajem Pomieszczeń', path: '/services/rooms' },
        { label: 'Vouchery', path: '/services/vouchers' },
        { label: 'Kursy', path: '/services/courses' },
        { label: 'Sklep', path: '/offers-list' },
      ],
    },
    { label: 'Członkostwo w Klubie', path: '/services/memberships' },
    { label: 'Wydarzenia', path: '/events' },
    { label: 'Nasz Zespół', path: '/tech-stack' },
    { label: 'Kontakt', path: '/contact' },
  ];

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
