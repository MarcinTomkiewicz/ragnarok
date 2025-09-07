// user-menu-panel.component.ts
import { Component, inject, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth/auth.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import {
  hasMinimumCoworkerRole,
  hasStrictCoworkerRole,
} from '../../../core/utils/required-roles';
import { NotificationService } from '../../core/services/notifications/notifications.service';
import { NotificationBucket } from '../../../core/enums/notification-bucket';
import { toSignal } from '@angular/core/rxjs-interop';
import { NotificationBadgeComponent } from '../notification-badge/notification-badge.component';

@Component({
  selector: 'app-user-menu-panel',
  standalone: true,
  imports: [CommonModule, NotificationBadgeComponent],
  templateUrl: './user-menu-panel.component.html',
  styleUrls: ['./user-menu-panel.component.scss'],
})
export class UserMenuPanelComponent {
  readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  readonly NotificationBucket = NotificationBucket;

  readonly usernameDisplay = computed(
    () => this.auth.userDisplayName(this.auth.user()) ?? ''
  );
  readonly isGm = computed(() =>
    hasStrictCoworkerRole(this.auth.user(), CoworkerRoles.Gm)
  );
  readonly isMember = computed(() =>
    hasStrictCoworkerRole(this.auth.user(), CoworkerRoles.Member)
  );
  readonly isAdminSection = computed(() =>
    hasMinimumCoworkerRole(this.auth.user(), CoworkerRoles.Reception)
  );

  readonly notifCounts = toSignal(this.notifications.counts$, {
    initialValue: {} as Record<NotificationBucket, number>,
  });

  readonly notifLabels = computed(() => {
    const counts = this.notifCounts();
    const out = {} as Record<NotificationBucket, string>;
    (
      Object.keys(NotificationBucket) as Array<keyof typeof NotificationBucket>
    ).forEach((k) => {
      const bucket = NotificationBucket[k] as NotificationBucket;
      const n = counts[bucket] ?? 0;
      out[bucket] = n > 99 ? '99+' : String(n);
    });
    return out;
  });

  logout(): void {
    this.auth.logout().subscribe();
  }
}
