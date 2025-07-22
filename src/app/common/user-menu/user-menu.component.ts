import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../../auth/login/login.component';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, LoginComponent],
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent {
  isOpen = false;
  readonly auth = inject(AuthService);

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.isOpen = false;
    }
  }
}
