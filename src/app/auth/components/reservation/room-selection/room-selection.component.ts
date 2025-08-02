import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns';
import { forkJoin, map, of } from 'rxjs';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { Rooms } from '../../../../core/enums/rooms';
import { SystemRole } from '../../../../core/enums/systemRole';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { rxComputed } from '../../../../core/utils/rx-computed';
import { UniversalCalendarComponent } from '../../../common/universal-calendar/universal-calendar.component';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';
import { TimeSlots } from '../../../../core/enums/hours';

@Component({
  selector: 'app-room-selection',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent],
  templateUrl: './room-selection.component.html',
})
export class RoomSelectionComponent {
  private readonly auth = inject(AuthService);
  readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);

  readonly selectedRoom = this.store.selectedRoom;
  readonly selectedDate = this.store.selectedDate;
  readonly confirmedTeam = this.store.confirmedTeam;
  readonly reservationsMap = signal(new Map<string, IReservation[]>());

  constructor() {
    effect(() => {
      const room = this.selectedRoom();
      if (!room) return;

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

  readonly isMemberClubBlocked = rxComputed(
    [this.selectedRoom, this.auth.userCoworkerRole],
    (room, role) =>
      [Rooms.Asgard, Rooms.Alfheim].includes(room) &&
      role === CoworkerRoles.Member
        ? this.reservationService.checkIfMemberHasReservationThisWeekInClubRooms()
        : of(false)
  );

  readonly isSelectionDisabled = computed(
    () => this.isGoldenBlocked() || this.isMemberClubBlocked()
  );

  readonly requiresClubConfirmation = computed(() =>
    [Rooms.Asgard, Rooms.Alfheim].includes(this.selectedRoom())
  );

  readonly canProceed = computed(
    () =>
      !this.isSelectionDisabled() &&
      !!this.selectedDate() &&
      (!this.requiresClubConfirmation() || this.confirmedTeam())
  );

  readonly rooms = computed(() =>
    Object.values(Rooms).filter((room) =>
      [Rooms.Asgard, Rooms.Alfheim].includes(room)
        ? this.isPrivilegedUser() || this.isMember()
        : true
    )
  );

  selectRoom(room: Rooms) {
    if (this.selectedRoom() === room) return;

    this.store.selectedRoom.set(room);
    this.store.selectedDate.set(null);
    this.store.selectedStartTime.set(null);
    this.store.selectedDuration.set(null);
    this.store.selectedGm.set(null);
    this.store.gmFirstName.set(null);
    this.store.selectedSystemId.set(null);
    this.store.needsGm.set(false);
    this.store.confirmedTeam.set(false);
  }

  selectDate(dateStr: string | null) {
    if (this.isSelectionDisabled()) return;

    const current = this.selectedDate();
    const isSame = current === dateStr;

    this.store.selectedDate.set(isSame ? null : dateStr);

    // Reset zawsze — niezależnie od tego, czy zaznaczasz, czy odznaczasz
    this.store.selectedStartTime.set(null);
    this.store.selectedDuration.set(null);
    this.store.selectedGm.set(null);
    this.store.gmFirstName.set(null);
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

  onClubCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.store.confirmedTeam.set(input.checked);
  }
}
