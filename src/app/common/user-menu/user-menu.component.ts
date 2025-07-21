import { Component, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../../auth/login/login.component';
@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, LoginComponent],
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss']
})
export class UserMenuComponent {
  isOpen = false;

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.isOpen = false;
    }
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }
}
