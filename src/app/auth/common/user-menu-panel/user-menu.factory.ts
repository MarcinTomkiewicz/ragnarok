import { MenuItemKey } from '../../../core/enums/menu';
import { NotificationBucket } from '../../../core/enums/notification-bucket';
import { CoworkerRoles } from '../../../core/enums/roles';
import { BuildMenuCtx, MenuItem, MenuSection } from '../../../core/types/menu';

const PREFER_RECEPTION: ReadonlySet<MenuItemKey> = new Set([
  MenuItemKey.MyRoster,
  MenuItemKey.WorkLog,
  MenuItemKey.CoworkerFiles,
  MenuItemKey.RosterOverview,
  MenuItemKey.ReceptionAvailability,
]);

function commonWorkItems(): MenuItem[] {
  return [
    {
      id: MenuItemKey.ReceptionAvailability,
      label: 'Dostępność na recepcji',
      path: '/auth/reception-availability',
    },
    { id: MenuItemKey.MyRoster, label: 'Mój grafik', path: '/auth/my-roster' },
    { id: MenuItemKey.WorkLog, label: 'Czas pracy', path: '/auth/work-log' },
    {
      id: MenuItemKey.RosterOverview,
      label: 'Podgląd grafiku',
      path: '/auth/roster-overview',
    },
    {
      id: MenuItemKey.CoworkerFiles,
      label: 'Akta zleceniobiorcy',
      path: '/auth/coworker-files',
    },
  ];
}

export function buildUserMenu(ctx: BuildMenuCtx): MenuSection[] {
  const { hasMin, hasStrict } = ctx;

  const hasGm = hasMin(CoworkerRoles.Gm);
  const hasReception = hasMin(CoworkerRoles.Reception);
  const isOwner = hasStrict(CoworkerRoles.Owner);
  const isMember = hasMin(CoworkerRoles.Member);

  const sections: MenuSection[] = [];

  const reservations: MenuItem[] = [
    {
      id: MenuItemKey.ReserveRoom,
      label: 'Rezerwuj salkę',
      path: '/auth/reservation',
    },
    {
      id: MenuItemKey.MyReservations,
      label: 'Moje rezerwacje',
      path: '/auth/my-reservations',
    },
  ];
  sections.push({ title: 'Rezerwacje', items: reservations });

  const parties: MenuItem[] = [
    {
      id: MenuItemKey.FindParty,
      label: 'Znajdź drużynę',
      path: '/auth/find-party',
    },
    {
      id: MenuItemKey.CreateParty,
      label: 'Załóż drużynę',
      path: '/auth/create-party',
    },
    {
      id: MenuItemKey.MyParties,
      label: 'Moje drużyny',
      path: '/auth/my-parties',
      badgeBucket: NotificationBucket.PartyMembershipRequests,
    },
  ];
  sections.push({ title: 'Drużyny', items: parties });

  const events: MenuItem[] = [
    {
      id: MenuItemKey.HostEvent,
      label: 'Poprowadź wydarzenie',
      path: '/auth/events',
    },
  ];
  sections.push({ title: 'Wydarzenia', items: events });

  const account: MenuItem[] = [
    ...(isMember
      ? [
          {
            id: MenuItemKey.MyBenefits,
            label: 'Moje benefity',
            path: '/auth/benefits',
          },
        ]
      : []),
    { id: MenuItemKey.EditData, label: 'Edytuj dane', path: '/auth/edit-data' },
  ];
  sections.push({ title: 'Konto', items: account });

  const shared = commonWorkItems();
  const SHARED_KEYS = new Set(shared.map((i) => i.id));

  const gmItems: MenuItem[] = [];
  if (hasGm) {
    gmItems.push(
      {
        id: MenuItemKey.GmProfile,
        label: 'Profil Mistrza Gry',
        path: '/auth/manage-gm',
      },
      {
        id: MenuItemKey.UpcomingSessions,
        label: 'Nadchodzące sesje',
        path: '/auth/upcoming-sessions',
      },
      {
        id: MenuItemKey.GmAvailability,
        label: 'Dostępność Mistrza Gry',
        path: '/auth/availability',
      },
      ...shared
    );
  }

  const receptionItems: MenuItem[] = [];
  if (hasReception) {
    receptionItems.push(
      {
        id: MenuItemKey.GuestReservation,
        label: 'Nowa rezerwacja',
        path: '/auth/guest-reservation',
      },
      {
        id: MenuItemKey.ReservationsCalendar,
        label: 'Kalendarz rezerwacji',
        path: '/auth/reservations-calendar',
      },
      {
        id: MenuItemKey.UsersAdmin,
        label: 'Zarządzaj użytkownikami',
        path: '/auth/users-admin',
      },
      {
        id: MenuItemKey.PartyList,
        label: 'Zarządzaj Drużynami',
        path: '/auth/party-list',
      },
      {
        id: MenuItemKey.ManageEvents,
        label: 'Zarządzaj wydarzeniami',
        path: '/auth/events',
      },
      {
        id: MenuItemKey.NewEvent,
        label: 'Nowe wydarzenie',
        path: '/auth/events/new',
      },
      ...shared,
      {
        id: MenuItemKey.AvailabilityOverview,
        label: 'Podgląd dostępności',
        path: '/auth/availability-overview',
      },
    );
    if (isOwner) {
      receptionItems.push(
        {
          id: MenuItemKey.WorkLogsOverview,
          label: 'Ewidencja godzin',
          path: '/auth/work-logs-overview',
        },
        {
          id: MenuItemKey.ReceptionRoster,
          label: 'Grafik recepcji',
          path: '/auth/reception-roster',
        }
      );
    }
  }

  if (hasReception && hasGm) {
    const gmFiltered = gmItems.filter(
      (i) =>
        !PREFER_RECEPTION.has(i.id as MenuItemKey) && !SHARED_KEYS.has(i.id)
    );
    if (gmFiltered.length)
      sections.push({ title: 'Mistrz Gry', items: gmFiltered });
    if (receptionItems.length)
      sections.push({ title: 'Recepcja', items: receptionItems });
  } else {
    if (hasGm && gmItems.length)
      sections.push({ title: 'Mistrz Gry', items: gmItems });
    if (hasReception && receptionItems.length)
      sections.push({ title: 'Recepcja', items: receptionItems });
  }

  return sections.filter((s) => s.items.length > 0);
}
