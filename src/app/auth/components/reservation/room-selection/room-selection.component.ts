import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns';
import { forkJoin, map, of } from 'rxjs';
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

@Component({
  selector: 'app-room-selection',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent, NgbDropdownModule],
  templateUrl: './room-selection.component.html',
})
export class RoomSelectionComponent {
  private readonly auth = inject(AuthService);
  readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);
  private readonly partyService = inject(PartyService);

  readonly selectedRoom = this.store.selectedRoom;
  readonly selectedDate = this.store.selectedDate;
  readonly confirmedTeam = this.store.confirmedParty;
  readonly selectedPartyId = this.store.selectedPartyId;
  readonly reservationsMap = signal(new Map<string, IReservation[]>());
  userParties = signal<IParty[]>([]);

  isMemberClubBlocked = false;

  constructor() {
    this.loadUserParties();
    effect(() => {
      const room = this.selectedRoom();
      if (!room) return;

      const role = this.auth.userCoworkerRole();

      if (
        [Rooms.Asgard, Rooms.Alfheim].includes(room) &&
        role === CoworkerRoles.Member
      ) {
        this.reservationService
          .checkIfMemberHasReservationThisWeekInClubRooms()
          .subscribe((result) => {
            this.isMemberClubBlocked = result;
          });
      } else {
        this.isMemberClubBlocked = false;
      }

      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      const dates = eachDayOfInterval({ start, end }).map((d) =>
        format(d, 'yyyy-MM-dd')
      );

      forkJoin(
        dates.map((date) =>
          this.reservationService
            .getReservationsForRoom(room, date)
            .pipe(map((res) => [date, res] as const))
        )
      ).subscribe((pairs) => {
        this.reservationsMap.set(new Map(pairs));
      });
    });
  }

  onMonthChanged(dates: string[]) {
    const room = this.selectedRoom();
    if (!room) return;

    forkJoin(
      dates.map((date) =>
        this.reservationService
          .getReservationsForRoom(room, date)
          .pipe(map((res) => [date, res] as const))
      )
    ).subscribe((pairs) => {
      this.reservationsMap.set(new Map(pairs));
    });
  }
  readonly isPrivilegedUser = computed(
    () =>
      [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(
        this.auth.userCoworkerRole()!
      ) || this.auth.userSystemRole() === SystemRole.Admin
  );

  readonly isMember = computed(
    () => this.auth.userCoworkerRole() === CoworkerRoles.Member
  );

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

  readonly requiresClubConfirmation = computed(() =>
    [Rooms.Asgard, Rooms.Alfheim].includes(this.selectedRoom())
  );

  readonly canProceed = computed(
    () =>
      !this.isSelectionDisabled() &&
      !!this.selectedDate() &&
      (!this.requiresClubConfirmation() ||
        (this.confirmedTeam() && this.selectedPartyId()))
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

  selectRoom(room: Rooms) {
    if (this.selectedRoom() === room) return;

    this.store.selectedRoom.set(room);
    this.store.selectedDate.set(null);
    this.store.selectedStartTime.set(null);
    this.store.selectedDuration.set(null);
    this.store.selectedGm.set(null);
    this.store.selectedSystemId.set(null);
    this.store.needsGm.set(false);
    this.store.confirmedParty.set(false);
    this.store.confirmedParty.set(false);
    this.store.selectedPartyId.set(null);
  }

  selectDate(dateStr: string | null) {
    if (this.isSelectionDisabled()) return;

    const current = this.selectedDate();
    const isSame = current === dateStr;

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
    const userId = this.auth.user()?.id;
    if (userId) {
      this.partyService.getUserParties(userId).subscribe((parties) => {
        this.userParties.set(parties);
      });
    }
  }

  selectParty(partyId: string) {
    this.store.selectedPartyId.set(partyId);
    this.store.confirmedParty.set(!!partyId);
  }

  getSelectedPartyName(): string | null {
    const selectedPartyId = this.store.selectedPartyId();
    const selectedParty = this.userParties().find(
      (party) => party.id === selectedPartyId
    );
    return selectedParty ? selectedParty.name : null;
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
