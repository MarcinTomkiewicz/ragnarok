import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/services/auth/auth.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import {
  hasMinimumCoworkerRole,
  hasStrictCoworkerRole,
} from '../../../core/utils/required-roles';

import { NotificationBadgeComponent } from '../notification-badge/notification-badge.component';
import { NotificationService } from '../../core/services/notifications/notifications.service';
import { NotificationBucket } from '../../../core/enums/notification-bucket';

type MenuItem = {
  label: string;
  path: string;
  badgeBucket?: NotificationBucket;
};
type MenuSection = { title: string; items: MenuItem[] };

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

  private readonly isMin = (r: CoworkerRoles) =>
    hasMinimumCoworkerRole(this.auth.user(), r);
  private readonly isStrict = (r: CoworkerRoles) =>
    hasStrictCoworkerRole(this.auth.user(), r);

  readonly menuSections = computed<MenuSection[]>(() => {
    const sections: MenuSection[] = [];

    const reservations: MenuItem[] = [
      { label: 'Rezerwuj salkę', path: '/auth/reservation' },
      { label: 'Moje rezerwacje', path: '/auth/my-reservations' },
    ];
    if (reservations.length)
      sections.push({ title: 'Rezerwacje', items: reservations });

    const parties: MenuItem[] = [
      { label: 'Znajdź drużynę', path: '/auth/find-party' },
      { label: 'Załóż drużynę', path: '/auth/create-party' },
      {
        label: 'Moje drużyny',
        path: '/auth/my-parties',
        badgeBucket: NotificationBucket.PartyMembershipRequests,
      },
    ];
    if (parties.length) sections.push({ title: 'Drużyny', items: parties });

    const events: MenuItem[] = [
      { label: 'Poprowadź wydarzenie', path: '/auth/events' },
    ];
    if (events.length) sections.push({ title: 'Wydarzenia', items: events });

    const account: MenuItem[] = [
      { label: 'Edytuj dane', path: '/auth/edit-data' },
    ];
    if (this.isMin(CoworkerRoles.Member)) {
      account.unshift({ label: 'Moje benefity', path: '/auth/benefits' });
    }
    if (account.length) sections.push({ title: 'Konto', items: account });

    const gm: MenuItem[] = [];
    if (this.isMin(CoworkerRoles.Gm)) {
      gm.push(
        { label: 'Profil Mistrza Gry', path: '/auth/manage-gm' },
        { label: 'Nadchodzące sesje', path: '/auth/upcoming-sessions' },
        { label: 'Dostępność Mistrza Gry', path: '/auth/availability' },
        {
          label: 'Dostępność na recepcji',
          path: '/auth/reception-availability',
        }
      );
      if (this.isStrict(CoworkerRoles.Gm)) {
        gm.push(
          { label: 'Mój grafik', path: '/auth/my-roster' },
          { label: 'Podgląd grafiku', path: '/auth/roster-overview' },
          { label: 'Czas pracy', path: '/auth/work-log' },
          { label: 'Akta zleceniobiorcy', path: '/auth/coworker-files' }
        );
      }
    }
    if (gm.length) sections.push({ title: 'Mistrz Gry', items: gm });

    const reception: MenuItem[] = [];
    if (this.isMin(CoworkerRoles.Reception)) {
      reception.push(
        { label: 'Nowa rezerwacja', path: '/auth/guest-reservation' },
        { label: 'Kalendarz rezerwacji', path: '/auth/reservations-calendar' },
        { label: 'Zarządzaj użytkownikami', path: '/auth/users-admin' },
        { label: 'Zarządzaj Drużynami', path: '/auth/party-list' },
        { label: 'Zarządzaj wydarzeniami', path: '/auth/events' },
        { label: 'Nowe wydarzenie', path: '/auth/events/new' },
        { label: 'Mój grafik', path: '/auth/my-roster' },
        { label: 'Czas pracy', path: '/auth/work-log' },
        { label: 'Akta zleceniobiorcy', path: '/auth/coworker-files' },
        { label: 'Podgląd grafiku', path: '/auth/roster-overview' },
        { label: 'Podgląd dostępności', path: '/auth/availability-overview' },
        { label: 'Ewidencja godzin', path: '/auth/work-logs-overview' }
      );
    }
    if (this.isStrict(CoworkerRoles.Owner)) {
      reception.push({
        label: 'Grafik recepcji',
        path: '/auth/reception-roster',
      });
    }
    if (reception.length)
      sections.push({ title: 'Recepcja', items: reception });

    const admin: MenuItem[] = [];
    // Tu dodasz pozycje wyłącznie dla systemowego admina, jeśli zajdzie potrzeba.
    if (admin.length) sections.push({ title: 'Administracja', items: admin });

    return sections;
  });

  private readonly expanded = signal<Set<string>>(new Set(['Rezerwacje']));

  isExpanded(title: string): boolean {
    return this.expanded().has(title);
  }

  toggleSection(title: string) {
    const next = new Set(this.expanded());
    if (next.has(title)) next.delete(title);
    else next.add(title);
    this.expanded.set(next);
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
