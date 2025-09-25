import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NotificationBucket } from '../../../core/enums/notification-bucket';
import { CoworkerRoles } from '../../../core/enums/roles';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  hasMinimumCoworkerRole,
  hasStrictCoworkerRole,
} from '../../../core/utils/required-roles';
import { NotificationService } from '../../core/services/notifications/notifications.service';
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
    (
      Object.keys(NotificationBucket) as Array<keyof typeof NotificationBucket>
    ).forEach((k) => {
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

    // Rezerwacje
    const reservations: MenuItem[] = [
      { label: 'Rezerwuj salkę', path: '/auth/reservation' },
      { label: 'Moje rezerwacje', path: '/auth/my-reservations' },
    ];
    if (min(CoworkerRoles.Reception)) {
      reservations.push(
        { label: 'Nowa Rezerwacja', path: '/auth/guest-reservation' },
        { label: 'Kalendarz Rezerwacji', path: '/auth/reservations-calendar' }
      );
    }
    sections.push({ title: 'Rezerwacje', items: reservations });

    // Drużyny
    const parties: MenuItem[] = [
      { label: 'Znajdź drużynę', path: '/auth/find-party' },
      { label: 'Załóż drużynę', path: '/auth/create-party' },
      {
        label: 'Moje drużyny',
        path: '/auth/my-parties',
        badgeBucket: NotificationBucket.PartyMembershipRequests,
      },
    ];
    if (min(CoworkerRoles.Reception)) {
      parties.push({ label: 'Zarządzaj Drużynami', path: '/auth/party-list' });
    }
    sections.push({ title: 'Drużyny', items: parties });

    // Wydarzenia
    const events: MenuItem[] = [];
    if (min(CoworkerRoles.Reception)) {
      events.push(
        { label: 'Zarządzaj wydarzeniami', path: '/auth/events' },
        { label: 'Nowe wydarzenie', path: '/auth/events/new' }
      );
    } else if (min(CoworkerRoles.User)) {
      events.push({ label: 'Poprowadź wydarzenie', path: '/auth/events' });
    }
    if (events.length) sections.push({ title: 'Wydarzenia', items: events });

    // Dyspozycyjność
    const availability: MenuItem[] = [];
    if (strict(CoworkerRoles.Gm)) {
      availability.push({
        label: 'Dostępność Mistrza Gry',
        path: '/auth/availability',
      });
    }
    if (min(CoworkerRoles.Gm)) {
      availability.push({
        label: 'Dostępność na recepcji',
        path: '/auth/reception-availability',
      });
    }
    if (min(CoworkerRoles.Reception)) {
      availability.push({
        label: 'Podgląd dostępności',
        path: '/auth/availability-overview',
      });
    }
    if (availability.length) {
      sections.push({ title: 'Dyspozycyjność', items: availability });
    }

    const workAndTime: MenuItem[] = [];
    if (strict(CoworkerRoles.Gm)) {
      workAndTime.push({
        label: 'Nadchodzące sesje',
        path: '/auth/upcoming-sessions',
      });
    }
    if (min(CoworkerRoles.Gm)) {
      workAndTime.push(
        { label: 'Czas pracy', path: '/auth/work-log' },
        { label: 'Mój grafik', path: '/auth/my-roster' },
        { label: 'Akta współpracowników', path: '/auth/coworker-files' }
      );
    }
    if (min(CoworkerRoles.Reception)) {
      workAndTime.push({
        label: 'Ewidencja godzin',
        path: '/auth/work-logs-overview',
      });
    }
    if (workAndTime.length) {
      sections.push({ title: 'Praca i czas', items: workAndTime });
    }

    if (strict(CoworkerRoles.Owner)) {
      sections.push({
        title: 'Grafik',
        items: [{ label: 'Grafik recepcji', path: '/auth/reception-roster' }],
      });
    }

    const account: MenuItem[] = [
      { label: 'Edytuj dane', path: '/auth/edit-data' },
    ];
    if (min(CoworkerRoles.Gm)) {
      account.push({ label: 'Profil Mistrza Gry', path: '/auth/manage-gm' });
    }
    if (strict(CoworkerRoles.Member)) {
      account.push({ label: 'Moje benefity', path: '/auth/benefits' });
    }
    sections.push({ title: 'Konto i członkostwo', items: account });

    return sections.filter((s) => s.items.length);
  });

  logout(): void {
    this.auth.logout().subscribe();
  }
}
