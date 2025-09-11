import { Component, inject, computed } from '@angular/core';
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

type MenuItem = {
  label: string;
  path: string;
  badgeBucket?: NotificationBucket;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
  alwaysVisible?: boolean;
};

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

  readonly notifCounts = toSignal(this.notifications.counts$, {
    initialValue: {} as Record<NotificationBucket, number>,
  });

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

  readonly menuSections = computed<MenuSection[]>(() => {
    const u = this.auth.user();
    const strict = (r: CoworkerRoles) => hasStrictCoworkerRole(u, r);
    const min = (r: CoworkerRoles) => hasMinimumCoworkerRole(u, r);

    const sections: MenuSection[] = [];

    sections.push({
      title: 'Strefa użytkownika',
      items: [
        { label: 'Edytuj dane', path: '/auth/edit-data' },
        { label: 'Rezerwuj salkę', path: '/auth/reservation' },
        { label: 'Moje rezerwacje', path: '/auth/my-reservations' },
      ],
    });

    sections.push({
      title: 'Strefa Drużyn',
      items: [
        { label: 'Znajdź drużynę', path: '/auth/find-party' },
        { label: 'Załóż drużynę', path: '/auth/create-party' },
        {
          label: 'Moje drużyny',
          path: '/auth/my-parties',
          badgeBucket: NotificationBucket.PartyMembershipRequests,
        },
      ],
    });

    if (strict(CoworkerRoles.Member)) {
      sections.push({
        title: 'Strefa Klubowicza',
        items: [{ label: 'Moje benefity', path: '/auth/benefits' }],
      });
    }

    if (strict(CoworkerRoles.Gm)) {
      sections.push({
        title: 'Strefa Mistrza Gry',
        items: [
          { label: 'Profil Mistrza Gry', path: '/auth/manage-gm' },
          { label: 'Nadchodzące sesje', path: '/auth/upcoming-sessions' },
          { label: 'Twoja dostępność', path: '/auth/availability' },
        ],
      });
    }

    const receptionItems: MenuItem[] = [];
    if (min(CoworkerRoles.Gm)) {
      receptionItems.push({ label: 'Dyspozycyjność na recepcji', path: '/auth/reception-availability' });
    }
    if (min(CoworkerRoles.Reception)) {
      receptionItems.push(
        { label: 'Nowa Rezerwacja', path: '/auth/guest-reservation' },
        { label: 'Kalendarz Rezerwacji', path: '/auth/reservations-calendar' },
        { label: 'Zarządzaj Drużynami', path: '/auth/party-list' },
      );
    }
    if (receptionItems.length) {
      sections.push({ title: 'Strefa Recepcji', items: receptionItems });
    }

    if (min(CoworkerRoles.Reception)) {
      sections.push({
        title: 'Strefa Admina',
        items: [],
        alwaysVisible: true,
      });
    }

    return sections.filter((s) => s.alwaysVisible || s.items.length);
  });

  logout(): void {
    this.auth.logout().subscribe();
  }
}
