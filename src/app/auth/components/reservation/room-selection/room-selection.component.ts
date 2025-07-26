import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format as formatFn,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { forkJoin, map, of } from 'rxjs';

import { CoworkerRoles } from '../../../../core/enums/roles';
import { Rooms } from '../../../../core/enums/rooms';
import { SystemRole } from '../../../../core/enums/systemRole';
import { IReservation } from '../../../../core/interfaces/i-reservation';

import { AuthService } from '../../../../core/services/auth/auth.service';
import { rxComputed } from '../../../../core/utils/rx-computed';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { ReservationService } from '../../../core/services/reservation/reservation.service';

@Component({
  selector: 'app-room-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room-selection.component.html',
})
export class RoomSelectionComponent {
  // === Store & services ===
  readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthService);

  // === Store signals ===
  readonly selectedRoom = this.store.selectedRoom;
  readonly selectedDate = this.store.selectedDate;
  readonly confirmedTeam = this.store.confirmedTeam;

  // === Calendar ===
  readonly currentMonth = signal(new Date());
  readonly reservationsMap = signal(new Map<string, IReservation[]>());

  readonly minMonth = startOfMonth(new Date());
  readonly maxMonth = startOfMonth(addMonths(new Date(), 1));

  readonly dayNames = Array.from({ length: 7 }, (_, i) =>
    formatFn(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'ccc', {
      locale: pl,
    })
  );

  readonly visibleDays = computed(() => {
    const start = startOfWeek(startOfMonth(this.currentMonth()), {
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(this.currentMonth()), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  });

  readonly formattedCurrentMonth = computed(() =>
    formatFn(this.currentMonth(), 'LLLL yyyy', { locale: pl })
  );

  readonly canGoPrev = computed(() => this.currentMonth() > this.maxMonth);
  readonly canGoNext = computed(() => this.currentMonth() < this.maxMonth);

  // === Roles & access ===
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

  readonly canConfirm = computed(
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
    if (this.store.selectedRoom() !== room) {
      this.store.selectedRoom.set(room);

      // czyścimy całą resztę
      this.store.selectedDate.set(null);
      this.store.selectedStartTime.set(null);
      this.store.selectedDuration.set(null);
      this.store.selectedGm.set(null);
      this.store.selectedSystemId.set(null);
      this.store.gmFirstName.set(null);
      this.store.needsGm.set(false);
      this.store.confirmedTeam.set(false);
    }
  }

  // === Rezerwacje dzienne & godziny ===
  readonly hourlyAvailabilityMap = computed(() => {
    const availability = new Map<string, boolean[]>();

    const room = this.selectedRoom();
    const startHour = [Rooms.Asgard, Rooms.Alfheim].includes(room) ? 15 : 17;
    const endHour = 23;

    for (const [dateStr, reservations] of this.reservationsMap()) {
      const blocks = Array(endHour - startHour).fill(false);

      for (const res of reservations) {
        const start = parseInt(res.startTime.split(':')[0], 10);
        const end = start + res.durationHours;
        for (let h = start; h < end; h++) {
          if (h >= startHour && h < endHour) blocks[h - startHour] = true;
        }
      }

      availability.set(dateStr, blocks);
    }

    return availability;
  });

  getHourlyAvailability(date: Date): boolean[] {
    const key = formatFn(date, 'yyyy-MM-dd');
    return this.hourlyAvailabilityMap().get(key) ?? [];
  }

  format(date: Date, pattern: string): string {
    return formatFn(date, pattern, { locale: pl });
  }

  isPastDay(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isSameMonth(date: Date, base: Date): boolean {
    return isSameMonth(date, base);
  }

  isReserved(date: Date): boolean {
    const key = formatFn(date, 'yyyy-MM-dd');
    const hourly = this.hourlyAvailabilityMap().get(key);
    if (!hourly) return false;

    return hourly.every((slot) => slot === true);
  }
  canShowHours(date: Date): boolean {
    return !this.isPastDay(date) && this.isSameMonth(date, this.currentMonth());
  }

  // === Effects ===
  constructor() {
    effect(() => {
      const room = this.selectedRoom();
      const dates = this.visibleDays().map((d) => formatFn(d, 'yyyy-MM-dd'));
      this.fetchReservationsForRoom(room, dates);
    });
  }

  private fetchReservationsForRoom(room: Rooms, dates: string[]) {
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

  // === Actions ===
  selectDate(date: Date) {
    if (this.isSelectionDisabled()) return;

    const formatted = formatFn(date, 'yyyy-MM-dd');
    if (this.selectedDate() === formatted) return;

    this.store.selectedDate.set(formatted);

    // Reset wszystkiego poza pokojem i datą
    this.store.selectedStartTime.set(null);
    this.store.selectedDuration.set(null);
    this.store.selectedGm.set(null);
    this.store.gmFirstName.set(null);
    this.store.selectedSystemId.set(null);
    this.store.needsGm.set(false);
  }

  prevMonth() {
    const newMonth = addMonths(this.currentMonth(), -1);
    if (startOfMonth(newMonth) >= this.minMonth)
      this.currentMonth.set(newMonth);
  }

  nextMonth() {
    const newMonth = addMonths(this.currentMonth(), 1);
    if (startOfMonth(newMonth) <= this.maxMonth)
      this.currentMonth.set(newMonth);
  }

  onClubCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.confirmedTeam.set(input.checked);
  }

  trackByDate(date: Date): string {
    return formatFn(date, 'yyyy-MM-dd');
  }
}
