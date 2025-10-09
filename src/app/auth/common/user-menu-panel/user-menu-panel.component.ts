import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/services/auth/auth.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import { hasMinimumCoworkerRole, hasStrictCoworkerRole } from '../../../core/utils/required-roles';

import { NotificationBadgeComponent } from '../notification-badge/notification-badge.component';
import { NotificationService } from '../../core/services/notifications/notifications.service';
import { NotificationBucket } from '../../../core/enums/notification-bucket';
import { MenuSection } from '../../../core/types/menu';
import { buildUserMenu } from './user-menu.factory';

@Component({
  selector: 'app-user-menu-panel',
  standalone: true,
  imports: [CommonModule, NotificationBadgeComponent],
  templateUrl: './user-menu-panel.component.html',
  styleUrls: ['./user-menu-panel.component.scss'],
})
export class UserMenuPanelComponent {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  readonly NotificationBucket = NotificationBucket;

  readonly usernameDisplay = computed(
    () => this.auth.userDisplayName(this.auth.user()) ?? ''
  );

  // sygnał z liczbami do badge’y
  readonly notifCounts = toSignal(this.notifications.counts$, {
    initialValue: {} as Record<NotificationBucket, number>,
  });

  // zamiana liczb na „stringi” (np. 99+)
  readonly notifLabels = computed(() => {
    const counts = this.notifCounts();
    const out = {} as Record<NotificationBucket, string>;
    (Object.keys(NotificationBucket) as Array<keyof typeof NotificationBucket>).forEach((k) => {
      const bucket = NotificationBucket[k] as NotificationBucket;
      const n = counts[bucket] ?? 0;
      out[bucket] = n > 99 ? '99+' : String(n);
    });
    return out;
  });

  // helpers do ról
  private readonly hasMin = (r: CoworkerRoles) => hasMinimumCoworkerRole(this.auth.user(), r);
  private readonly hasStrict = (r: CoworkerRoles) => hasStrictCoworkerRole(this.auth.user(), r);

  // sekcje menu z fabryki
  readonly menuSections = computed<MenuSection[]>(() =>
    buildUserMenu({
      user: this.auth.user() ?? null,
      hasMin: this.hasMin,
      hasStrict: this.hasStrict,
      notifLabels: this.notifLabels(),
    })
  );

  // rozwijanie/zwijanie sekcji
  private readonly expanded = new Set<string>(['Rezerwacje']);

  isExpanded(title: string): boolean {
    return this.expanded.has(title);
  }
  toggleSection(title: string) {
    if (this.expanded.has(title)) this.expanded.delete(title);
    else this.expanded.add(title);
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
