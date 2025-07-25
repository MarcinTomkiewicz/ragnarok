import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed, effect } from '@angular/core';
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
import { CoworkerRoles } from '../../../../core/enums/roles';
import { Rooms } from '../../../../core/enums/rooms';
import { SystemRole } from '../../../../core/enums/systemRole';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ReservationService } from '../../../../core/services/reservation/reservation.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { of } from 'rxjs';
import { rxComputed } from '../../../../core/utils/rx-computed';

@Component({
  selector: 'app-room-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room-selection.component.html',
})
export class RoomSelectionComponent {
  private readonly store = inject(ReservationStoreService);
  private readonly reservationService = inject(ReservationService);
  private readonly auth = inject(AuthService);

  readonly selectedRoom = this.store.selectedRoom;
  readonly selectedDate = this.store.selectedDate;
  readonly clubConfirmationAccepted = this.store.clubConfirmationAccepted;

  readonly currentMonth = signal(new Date());
  readonly reservationsMap = signal(new Map<string, IReservation[]>());

  readonly isPrivilegedUser = computed(() =>
    [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(this.auth.userCoworkerRole()!) ||
    this.auth.userSystemRole() === SystemRole.Admin
  );

  readonly isMember = computed(() => this.auth.userCoworkerRole() === CoworkerRoles.Member);

  readonly isGoldenBlocked = rxComputed(
    [this.auth.userCoworkerRole],
    (role) =>
      role === CoworkerRoles.Golden
        ? this.reservationService.checkIfUserHasActiveReservation()
        : of(false)
  );

  readonly isMemberClubBlocked = rxComputed(
    [this.selectedRoom, this.auth.userCoworkerRole],
    (room, role) =>
      [Rooms.Asgard, Rooms.Alfheim].includes(room) && role === CoworkerRoles.Member
        ? this.reservationService.checkIfMemberHasReservationThisWeekInClubRooms()
        : of(false)
  );

  readonly isSelectionDisabled = computed(
    () => this.isGoldenBlocked() || this.isMemberClubBlocked()
  );

  readonly rooms = computed(() =>
    Object.values(Rooms).filter(room =>
      [Rooms.Asgard, Rooms.Alfheim].includes(room)
        ? this.isPrivilegedUser() || this.isMember()
        : true
    )
  );

  readonly requiresClubConfirmation = computed(() =>
    [Rooms.Asgard, Rooms.Alfheim].includes(this.selectedRoom())
  );

  readonly dayNames = Array.from({ length: 7 }, (_, i) =>
    formatFn(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'ccc', { locale: pl })
  );

  readonly minMonth = startOfMonth(new Date());
  readonly maxMonth = startOfMonth(addMonths(new Date(), 1));

  readonly canGoPrev = computed(() => this.currentMonth() > this.minMonth);
  readonly canGoNext = computed(() => this.currentMonth() < this.maxMonth);

  readonly visibleDays = computed(() => {
    const start = startOfWeek(startOfMonth(this.currentMonth()), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(this.currentMonth()), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  });

  readonly formattedCurrentMonth = computed(() =>
    this.format(this.currentMonth(), 'LLLL yyyy')
  );

  constructor() {
    effect(() => {
      const room = this.selectedRoom();
      const dates = this.visibleDays().map(d => formatFn(d, 'yyyy-MM-dd'));
      this.fetchReservationsForRoom(room, dates);
    });
  }

  private fetchReservationsForRoom(room: Rooms, dates: string[]) {
    const map = new Map<string, IReservation[]>();
    dates.forEach(date =>
      this.reservationService.getReservationsForRoom(room, date).subscribe(res => {
        map.set(date, res);
        this.reservationsMap.set(new Map(map));
      })
    );
  }

  isReserved(date: Date): boolean {
    const dateStr = formatFn(date, 'yyyy-MM-dd');
    return !!this.reservationsMap().get(dateStr)?.length;
  }

  selectDate(date: Date) {
    if (this.isSelectionDisabled()) return;
    this.selectedDate.set(formatFn(date, 'yyyy-MM-dd'));
  }

  prevMonth() {
    const newMonth = addMonths(this.currentMonth(), -1);
    if (startOfMonth(newMonth) >= this.minMonth) this.currentMonth.set(newMonth);
  }

  nextMonth() {
    const newMonth = addMonths(this.currentMonth(), 1);
    if (startOfMonth(newMonth) <= this.maxMonth) this.currentMonth.set(newMonth);
  }

  format(date: Date, pattern: string) {
    return formatFn(date, pattern, { locale: pl });
  }

  isPastDay(date: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isSameMonth(date: Date, base: Date) {
    return isSameMonth(date, base);
  }

  canShowHours = (day: Date) =>
    !this.isPastDay(day) && this.isSameMonth(day, this.currentMonth());

  getHourlyAvailability(date: Date): boolean[] {
    const startHour = 17;
    const endHour = 23;
    const blocks = Array(endHour - startHour).fill(false);

    const dateStr = formatFn(date, 'yyyy-MM-dd');
    const reservations = this.reservationsMap().get(dateStr) || [];

    for (const res of reservations) {
      const start = parseInt(res.startTime.split(':')[0], 10);
      const end = start + res.durationHours;
      for (let h = start; h < end; h++) {
        if (h >= startHour && h < endHour) blocks[h - startHour] = true;
      }
    }

    return blocks;
  }

  onClubCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.clubConfirmationAccepted.set(input.checked);
  }

  confirmSelection() {
    if (
      this.isSelectionDisabled() ||
      !this.selectedDate() ||
      (this.requiresClubConfirmation() && !this.clubConfirmationAccepted())
    )
      return;

    this.store.step.set(2);
  }
}
