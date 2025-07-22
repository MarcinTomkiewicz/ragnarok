import { Component, effect, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../../auth/components/login/login.component';
import { AuthService } from '../../core/services/auth/auth.service';
import { IUser } from '../../core/interfaces/i-user';
import { UserMenuPanelComponent } from "../../auth/common/user-menu-panel/user-menu-panel.component";

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, LoginComponent, UserMenuPanelComponent],
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent {
  isOpen = false;
  readonly auth = inject(AuthService);
  private prevUser: IUser | null = null;

  constructor() {
    effect(() => {
      const current = this.auth.user();
      if (!this.prevUser && current && this.isOpen) {
        this.isOpen = false;
      }
      this.prevUser = current;
    });
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.isOpen = false;
    }
  }
}
