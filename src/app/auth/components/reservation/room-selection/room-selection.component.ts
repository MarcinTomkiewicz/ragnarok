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
import { Rooms } from '../../../../core/enums/rooms';
import { IReservation } from '../../../../core/interfaces/i-reservation';
import { ReservationService } from '../../../../core/services/reservation/reservation.service';
import { ReservationStoreService } from '../../../core/services/reservation-store/reservation-store.service';
import { AuthService } from '../../../../core/services/auth/auth.service'; // zakładam, że masz taki serwis
import { CoworkerRoles } from '../../../../core/enums/roles';
import { SystemRole } from '../../../../core/enums/systemRole';

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

  readonly minMonth = startOfMonth(new Date());
  readonly maxMonth = startOfMonth(addMonths(new Date(), 1));

  readonly userCoworkerRole = this.auth.userCoworkerRole();
  readonly userSystemRole = this.auth.userSystemRole();

  readonly isPrivilegedUser = computed(
    () =>
      [CoworkerRoles.Owner, CoworkerRoles.Reception].includes(
        this.auth.userCoworkerRole() as CoworkerRoles
      ) || this.auth.userSystemRole() === SystemRole.Admin
  );

  readonly isMember = computed(
    () => this.auth.userCoworkerRole() === CoworkerRoles.Member
  );

  readonly rooms = computed(() => {
    return Object.values(Rooms).filter((room) => {
      if ([Rooms.Asgard, Rooms.Alfheim].includes(room)) {
        return this.isPrivilegedUser() || this.isMember();
      }
      return true;
    });
  });

readonly requiresClubConfirmation = computed(() => {
  return [Rooms.Asgard, Rooms.Alfheim].includes(this.selectedRoom());
});

  readonly canGoPrev = computed(
    () => this.currentMonth().getTime() > this.maxMonth.getTime()
  );
  readonly canGoNext = computed(
    () => this.currentMonth().getTime() < this.maxMonth.getTime()
  );

  readonly dayNames = Array.from({ length: 7 }, (_, i) =>
    formatFn(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'ccc', {
      locale: pl,
    })
  );

  readonly visibleDays = computed(() => {
    const start = startOfWeek(startOfMonth(this.currentMonth()), {
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(this.currentMonth()), {
      weekStartsOn: 1,
    });
    return eachDayOfInterval({ start, end });
  });

  readonly formattedCurrentMonth = computed(() =>
    this.format(this.currentMonth(), 'LLLL yyyy')
  );

  readonly reservationsMap = signal<Map<string, IReservation[]>>(new Map());

  constructor() {
    effect(() => {
      const room = this.selectedRoom();
      const dates = this.visibleDays().map((d) => formatFn(d, 'yyyy-MM-dd'));
      this.fetchReservationsForRoom(room, dates);
    });
  }

  private fetchReservationsForRoom(room: Rooms, dates: string[]) {
    const updatedMap = new Map<string, IReservation[]>();
    dates.forEach((dateStr) => {
      this.reservationService
        .getReservationsForRoom(room, dateStr)
        .subscribe((res) => {
          updatedMap.set(dateStr, res);
          this.reservationsMap.set(new Map(updatedMap));
        });
    });
  }

  isReserved(date: Date): boolean {
    const dateStr = formatFn(date, 'yyyy-MM-dd');
    const reservations = this.reservationsMap().get(dateStr);
    return !!reservations?.length;
  }

  selectDate(date: Date) {
    this.selectedDate.set(formatFn(date, 'yyyy-MM-dd'));
  }

  format(date: Date, pattern: string) {
    return formatFn(date, pattern, { locale: pl });
  }

  prevMonth() {
    const newDate = addMonths(this.currentMonth(), -1);
    if (startOfMonth(newDate) >= this.minMonth) {
      this.currentMonth.set(newDate);
    }
  }

  nextMonth() {
    const newDate = addMonths(this.currentMonth(), 1);
    if (startOfMonth(newDate) <= this.maxMonth) {
      this.currentMonth.set(newDate);
    }
  }

  isPastDay(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isSameMonth(date: Date, base: Date): boolean {
    return isSameMonth(date, base);
  }

  getHourlyAvailability(date: Date): boolean[] {
    const startHour = 17;
    const endHour = 23;
    const slots = Array(endHour - startHour).fill(false);

    const dateStr = formatFn(date, 'yyyy-MM-dd');
    const reservations = this.reservationsMap().get(dateStr) || [];

    for (const res of reservations) {
      const resStart = parseInt(res.startTime.split(':')[0], 10);
      const resEnd = resStart + res.durationHours;

      for (let h = resStart; h < resEnd; h++) {
        if (h >= startHour && h < endHour) {
          slots[h - startHour] = true;
        }
      }
    }

    return slots;
  }

  canShowHours = (day: Date) =>
    !this.isPastDay(day) && this.isSameMonth(day, this.currentMonth());

  onClubCheckboxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.clubConfirmationAccepted.set(input.checked);
  }

  confirmSelection() {
    if (!this.selectedDate()) return;
    if (this.requiresClubConfirmation() && !this.clubConfirmationAccepted())
      return;

    this.store.step.set(2);
  }
}
