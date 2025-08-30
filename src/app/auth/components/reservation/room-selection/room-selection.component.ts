import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { of, forkJoin } from 'rxjs';

import { TimeSlots } from '../../../../core/enums/hours';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { Rooms, SortedRooms } from '../../../../core/enums/rooms';
import { SystemRole } from '../../../../core/enums/systemRole';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { IParty } from '../../../../core/interfaces/parties/i-party';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { rxComputed } from '../../../../core/utils/rx-computed';
import { UniversalCalendarComponent } from '../../../common/universal-calendar/universal-calendar.component';
import { PartyService } from '../../../core/services/party/party.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { ReservationsCalendarFacade } from '../../../core/services/reservations-calendar/reservations-calendar.facade';
import { hasMinimumCoworkerRole } from '../../../../core/utils/required-roles';
import { TeamRole } from '../../../../core/enums/team-role';

@Component({
  selector: 'app-room-selection',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent, NgbDropdownModule],
  templateUrl: './room-selection.component.html',
  providers: [ReservationsCalendarFacade],
})
export class RoomSelectionComponent {
  private readonly auth = inject(AuthService);
  private readonly partyService = inject(PartyService);
  private readonly reservationService = inject(ReservationService);
  readonly store = inject(ReservationStoreService);
  readonly calendar = inject(ReservationsCalendarFacade);

  readonly selectedRoom = this.store.selectedRoom;
  readonly selectedDate = this.store.selectedDate;
  readonly confirmedTeam = this.store.confirmedParty;
  readonly selectedPartyId = this.store.selectedPartyId;

  // 3 sekcje
  readonly partiesGm   = signal<IParty[]>([]);
  readonly partiesJoin = signal<IParty[]>([]);
  readonly partiesMine = signal<IParty[]>([]);

  isMemberClubBlocked = false;

  constructor() {
    this.calendar.setRoom(this.selectedRoom());
    this.loadUserParties();
  }

  onMonthChanged(dates: string[]) {
    this.calendar.setVisibleDates(dates);
  }

  readonly requiresClubConfirmation = computed(() =>
    [Rooms.Asgard, Rooms.Alfheim].includes(this.selectedRoom())
  );

  readonly rooms = computed(() => {
    const isReceptionMode = this.store.isReceptionMode();
    const isExternalClubMember = this.store.externalIsClubMember();
    const userRole = this.auth.userCoworkerRole();
    const systemRole = this.auth.userSystemRole();

    return Object.values(SortedRooms).filter((room) => {
      const isClubOnly = [Rooms.Asgard, Rooms.Alfheim].includes(room);
      if (systemRole === SystemRole.Admin) return true;
      if (!isClubOnly) return true;
      if (isReceptionMode) return isExternalClubMember === true;
      return userRole === CoworkerRoles.Member;
    });
  });

  readonly isGoldenBlocked = rxComputed([this.auth.userCoworkerRole], (role) =>
    role === CoworkerRoles.Golden
      ? this.reservationService.checkIfUserHasActiveReservation()
      : of(false)
  );

  readonly isSelectionDisabled = computed(() => {
    const room = this.selectedRoom();
    const isClubRoom = [Rooms.Asgard, Rooms.Alfheim].includes(room);
    const isMember = this.auth.userCoworkerRole() === CoworkerRoles.Member;

    return (
      this.isGoldenBlocked() ||
      (isClubRoom && isMember && !this.selectedPartyId())
    );
  });

  selectRoom(room: Rooms) {
    if (this.selectedRoom() === room) return;

    this.store.selectedRoom.set(room);
    this.store.selectedDate.set(null);
    this.store.selectedStartTime.set(null);
    this.store.selectedDuration.set(null);
    this.store.selectedGm.set(null);
    this.store.selectedSystemId.set(null);
    this.store.selectedPartyId.set(null);
    this.store.needsGm.set(false);
    this.store.confirmedParty.set(false);

    this.calendar.setRoom(room);

    const role = this.auth.userCoworkerRole();
    if ([Rooms.Asgard, Rooms.Alfheim].includes(room) && role === CoworkerRoles.Member) {
      this.reservationService
        .checkIfMemberHasReservationThisWeekInClubRooms()
        .subscribe((result) => (this.isMemberClubBlocked = result));
    } else {
      this.isMemberClubBlocked = false;
    }
  }

  selectDate(dateStr: string | null) {
    if (this.isSelectionDisabled()) return;

    const isSame = this.selectedDate() === dateStr;
    this.store.selectedDate.set(isSame ? null : dateStr);
    this.store.selectedStartTime.set(null);
    this.store.selectedDuration.set(null);
    this.store.selectedGm.set(null);
    this.store.selectedSystemId.set(null);
    this.store.needsGm.set(false);
  }

  mapReservationToHours = () => (reservations: IReservation[]) => {
    const isReceptionMode = this.store.isReceptionMode();
    const startHour = isReceptionMode
      ? TimeSlots.noonStart
      : [Rooms.Asgard, Rooms.Alfheim].includes(this.selectedRoom())
      ? TimeSlots.earlyStart
      : TimeSlots.lateStart;

    const blocks = Array(23 - startHour).fill(false);
    for (const r of reservations) {
      const hStart = parseInt(r.startTime.split(':')[0], 10);
      for (let h = hStart; h < hStart + r.durationHours; h++) {
        if (h >= startHour && h < TimeSlots.end) blocks[h - startHour] = true;
      }
    }
    return blocks;
  };

  private loadUserParties(): void {
    const me = this.auth.user();
    if (!me) return;
    const userId = me.id;
    const canSeeGm = hasMinimumCoworkerRole(me, CoworkerRoles.Gm);

    if (canSeeGm) {
      forkJoin({
        gm: this.partyService.getPartiesWhereGm(userId),
        owned: this.partyService.getPartiesOwnedBy(userId),
        member: this.partyService.getPartiesWhereMember(userId),
      }).subscribe(({ gm, owned, member }) => {
        const mapUnion = new Map<string, IParty>();
        [...gm, ...owned, ...member].forEach(p => mapUnion.set(p.id, p));
        const union = Array.from(mapUnion.values());

        const join = union.filter(p => p.beginnersProgram === true);
        const gmNonJoin = gm.filter(p => p.beginnersProgram === false);

        const gmNonJoinIds = new Set(gmNonJoin.map(p => p.id));
        const mine = [...owned, ...member]
          .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
          .filter(p => p.beginnersProgram === false && !gmNonJoinIds.has(p.id));

        this.partiesJoin.set(join.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
        this.partiesGm.set(gmNonJoin.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
        this.partiesMine.set(mine.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
      });
    } else {
      forkJoin({
        owned: this.partyService.getPartiesOwnedBy(userId),
        member: this.partyService.getPartiesWhereMember(userId),
      }).subscribe(({ owned, member }) => {
        const mapUnion = new Map<string, IParty>();
        [...owned, ...member].forEach(p => mapUnion.set(p.id, p));
        const union = Array.from(mapUnion.values());

        const join = union.filter(p => p.beginnersProgram === true);
        const mine = union.filter(p => p.beginnersProgram === false);

        this.partiesGm.set([]); // brak sekcji GM dla ról < GM
        this.partiesJoin.set(join.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
        this.partiesMine.set(mine.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
      });
    }
  }

  selectParty(partyId: string) {
    this.store.selectedPartyId.set(partyId);
    this.store.confirmedParty.set(!!partyId);
    this.autoConfirmClubIfAllPlayersAreMembers(partyId);
  }

  private autoConfirmClubIfAllPlayersAreMembers(partyId: string) {
    const isClubRoom = [Rooms.Asgard, Rooms.Alfheim].includes(this.selectedRoom());
    const iAmMember = this.auth.userCoworkerRole() === CoworkerRoles.Member;
    if (!isClubRoom || !iAmMember) return;

    this.partyService.getPartyMembers(partyId).subscribe((members) => {
      const playerIds = members
        .filter((m) => !m.leftAt && m.role === TeamRole.Player)
        .map((m) => m.userId);

      if (!playerIds.length) {
        this.store.confirmedParty.set(false);
        return;
      }

      this.partyService.getUsersByIds(playerIds).subscribe((users) => {
        const allPlayersAreClubMembers = users.every(
          (u) => u.coworker === CoworkerRoles.Member
        );
        if (allPlayersAreClubMembers) {
          this.store.confirmedParty.set(true);
        }
      });
    });
  }

  getSelectedPartyName(): string | null {
    const pid = this.store.selectedPartyId();
    if (!pid) return null;
    const found =
      this.partiesJoin().find((p) => p.id === pid) ??
      this.partiesGm().find((p) => p.id === pid) ??
      this.partiesMine().find((p) => p.id === pid);
    return found?.name ?? null;
  }

  removeSelectedParty() {
    this.store.selectedPartyId.set(null);
    this.store.confirmedParty.set(false);
  }

  onClubCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.store.confirmedParty.set(input.checked);
  }
}
