import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  computed,
  effect,
  inject
} from '@angular/core';
import {
  toSignal
} from '@angular/core/rxjs-interop';
import { UserMenuPanelComponent } from '../../auth/common/user-menu-panel/user-menu-panel.component';
import { LoginComponent } from '../../auth/components/login/login.component';
import { NotificationService } from '../../auth/core/services/notifications/notifications.service';
import { IUser } from '../../core/interfaces/i-user';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [CommonModule, LoginComponent, UserMenuPanelComponent],
  templateUrl: './user-menu.component.html',
  styleUrls: ['./user-menu.component.scss'],
})
export class UserMenuComponent {
  readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  isOpen = false;

  private prevUser: IUser | null = null;

  readonly totalCount = toSignal(this.notifications.total$, {
    initialValue: 0,
  });
  readonly totalLabel = computed(() => {
    const n = this.totalCount() || 0;
    return n > 99 ? '99+' : String(n);
  });

  constructor() {
    effect(() => {
      const current = this.auth.user();
      if (!this.prevUser && current && this.isOpen) this.isOpen = false;
      this.prevUser = current;
    });
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) this.isOpen = false;
  }
}
