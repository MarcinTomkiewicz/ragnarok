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

  // podział na dwie grupy
  readonly partiesGm = signal<IParty[]>([]);
  readonly partiesOther = signal<IParty[]>([]);

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

      if (isReceptionMode) {
        return isExternalClubMember === true;
      }
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
        const gmSet = new Set(gm.map((p) => p.id));
        const otherMap = new Map<string, IParty>();
        [...owned, ...member].forEach((p) => otherMap.set(p.id, p));
        const other = Array.from(otherMap.values()).filter((p) => !gmSet.has(p.id));

        // sortowanie alfabetyczne
        this.partiesGm.set(gm.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
        this.partiesOther.set(other.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
      });
    } else {
      forkJoin({
        owned: this.partyService.getPartiesOwnedBy(userId),
        member: this.partyService.getPartiesWhereMember(userId),
      }).subscribe(({ owned, member }) => {
        const otherMap = new Map<string, IParty>();
        [...owned, ...member].forEach((p) => otherMap.set(p.id, p));
        const other = Array.from(otherMap.values());
        this.partiesGm.set([]); // brak sekcji MG
        this.partiesOther.set(other.slice().sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));
      });
    }
  }

  selectParty(partyId: string) {
    this.store.selectedPartyId.set(partyId);
    this.store.confirmedParty.set(!!partyId);
  }

  getSelectedPartyName(): string | null {
    const pid = this.store.selectedPartyId();
    if (!pid) return null;
    const found =
      this.partiesGm().find((p) => p.id === pid) ??
      this.partiesOther().find((p) => p.id === pid);
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
