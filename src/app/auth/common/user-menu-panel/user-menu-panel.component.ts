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

const ADMIN_ON_TOP = false;

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

  // Przełącznik alternatywnego układu:

readonly menuSections = computed<MenuSection[]>(() => {
  const u = this.auth.user();
  const strict = (r: CoworkerRoles) => hasStrictCoworkerRole(u, r);
  const min   = (r: CoworkerRoles) => hasMinimumCoworkerRole(u, r);

  // =========================
  // Sekcje user-facing
  // =========================

  // 1) Rezerwacje
  const reservations: MenuItem[] = [
    { label: 'Rezerwuj salkę', path: '/auth/reservation' },
    { label: 'Moje rezerwacje', path: '/auth/my-reservations' },
  ];
  if (!ADMIN_ON_TOP && min(CoworkerRoles.Reception)) {
    reservations.push(
      { label: 'Nowa rezerwacja', path: '/auth/guest-reservation' },
      { label: 'Kalendarz rezerwacji', path: '/auth/reservations-calendar' },
    );
  }

  // 2) Drużyny
  const parties: MenuItem[] = [
    { label: 'Znajdź drużynę', path: '/auth/find-party' },
    { label: 'Załóż drużynę', path: '/auth/create-party' },
    {
      label: 'Moje drużyny',
      path: '/auth/my-parties',
      badgeBucket: NotificationBucket.PartyMembershipRequests,
    },
  ];
  if (!ADMIN_ON_TOP && min(CoworkerRoles.Reception)) {
    parties.push({ label: 'Zarządzaj Drużynami', path: '/auth/party-list' });
  }

  // 3) Wydarzenia
  const events: MenuItem[] = [];
  if (!ADMIN_ON_TOP && min(CoworkerRoles.Reception)) {
    events.push(
      { label: 'Zarządzaj wydarzeniami', path: '/auth/events' },
      { label: 'Nowe wydarzenie', path: '/auth/events/new' },
    );
  } else if (min(CoworkerRoles.User)) {
    events.push({ label: 'Poprowadź wydarzenie', path: '/auth/events' });
  }

  // 4) Konto (benefity na górze + Akta współpracownika tutaj)
  const account: MenuItem[] = [];
  if (strict(CoworkerRoles.Member)) {
    account.push({ label: 'Moje benefity', path: '/auth/benefits' });
  }
  account.push({ label: 'Edytuj dane', path: '/auth/edit-data' });
  if (min(CoworkerRoles.Gm)) {
    account.push(
      { label: 'Profil Mistrza Gry', path: '/auth/manage-gm' },
      { label: 'Akta zleceniobiorcy', path: '/auth/coworker-files' },
    );
  }

  // 5) Grafik i dostępność (na końcu menu, sprawy pracownicze)
  const schedule: MenuItem[] = [];
  if (strict(CoworkerRoles.Gm)) {
    schedule.push({ label: 'Dostępność Mistrza Gry', path: '/auth/availability' });
  }
  if (min(CoworkerRoles.Gm)) {
    schedule.push(
      { label: 'Dostępność na recepcji', path: '/auth/reception-availability' },
      { label: 'Mój grafik', path: '/auth/my-roster' },
      { label: 'Czas pracy', path: '/auth/work-log' },
    );
  }
  if (min(CoworkerRoles.Reception)) {
    schedule.push(
      { label: 'Podgląd dostępności', path: '/auth/availability-overview' },
      { label: 'Ewidencja godzin', path: '/auth/work-logs-overview' },
    );
  }
  if (strict(CoworkerRoles.Owner)) {
    schedule.push({ label: 'Grafik recepcji', path: '/auth/reception-roster' });
  }

  // =========================
  // Alternatywa: Administracja na górze
  // =========================
  const adminTop: MenuSection | null = ADMIN_ON_TOP
    ? {
        title: 'Administracja',
        items: [
          // Rezerwacje (stanowiskowe)
          ...(min(CoworkerRoles.Reception) ? [
            { label: 'Nowa rezerwacja', path: '/auth/guest-reservation' },
            { label: 'Kalendarz rezerwacji', path: '/auth/reservations-calendar' },
          ] : []),

          // Drużyny (zarządzanie)
          ...(min(CoworkerRoles.Reception) ? [
            { label: 'Zarządzaj Drużynami', path: '/auth/party-list' },
          ] : []),

          // Wydarzenia (zarządzanie)
          ...(min(CoworkerRoles.Reception) ? [
            { label: 'Zarządzaj wydarzeniami', path: '/auth/events' },
            { label: 'Nowe wydarzenie', path: '/auth/events/new' },
          ] : []),

          // Dostępności / ewidencja / grafik recepcji (operacyjne)
          ...(min(CoworkerRoles.Reception) ? [
            { label: 'Podgląd dostępności', path: '/auth/availability-overview' },
            { label: 'Ewidencja godzin', path: '/auth/work-logs-overview' },
          ] : []),
          ...(strict(CoworkerRoles.Owner) ? [
            { label: 'Grafik recepcji', path: '/auth/reception-roster' },
          ] : []),
        ],
      }
    : null;

  // =========================
  // Składamy finalną listę
  // =========================
  const sections: MenuSection[] = [];

  if (adminTop && adminTop.items.length) sections.push(adminTop);

  // Kolejność sekcji wg Twoich wytycznych
  if (reservations.length) sections.push({ title: 'Rezerwacje', items: reservations });
  if (parties.length)      sections.push({ title: 'Drużyny',     items: parties });
  if (events.length)       sections.push({ title: 'Wydarzenia',  items: events });
  if (account.length)      sections.push({ title: 'Konto',       items: account });
  if (schedule.length)     sections.push({ title: 'Grafik i dostępność', items: schedule });

  return sections.filter(s => s.items.length);
});


  logout(): void {
    this.auth.logout().subscribe();
  }
}
