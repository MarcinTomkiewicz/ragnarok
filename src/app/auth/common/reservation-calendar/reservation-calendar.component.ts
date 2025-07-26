import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import { IReservation } from '../../../core/interfaces/i-reservation';
import { Rooms } from '../../../core/enums/rooms';

@Component({
  selector: 'app-reservation-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-calendar.component.html',
  styleUrl: './reservation-calendar.component.scss',
})
export class ReservationCalendarComponent {
  // === Inputs ===
  readonly reservationsMap = input<Map<string, IReservation[]>>(new Map());
  readonly selectedDate = input<string | null>(null);
  readonly selectionDisabled = input<boolean>(false);
  readonly highlightOnlyGmId = input<string | null>(null);
  readonly isPrivilegedUser = input<boolean>(false);
  readonly room = input<Rooms>();

  // === Outputs ===
  readonly dateSelected = output<string>();
  readonly dateClicked = output<string>();

  // === Calendar Logic ===
  readonly currentMonth = signal(new Date());
  readonly minMonth = startOfMonth(new Date());
  readonly maxMonth = startOfMonth(addMonths(new Date(), 1));
  readonly monthChanged = output<string[]>();

  constructor() {
    effect(() => {
      const visibleDates = this.visibleDays().map((d) =>
        format(d, 'yyyy-MM-dd')
      );
      this.monthChanged.emit(visibleDates);
    });
  }

  readonly dayNames = Array.from({ length: 7 }, (_, i) =>
    format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'ccc', {
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

  readonly formattedCurrentMonth = computed(() => {
    const formatted = format(this.currentMonth(), 'LLLL yyyy', { locale: pl });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  });

  readonly canGoPrev = computed(() => this.currentMonth() > this.maxMonth);
  readonly canGoNext = computed(() => this.currentMonth() < this.maxMonth);

  readonly hourlyAvailabilityMap = computed(() => {
    const availability = new Map<string, boolean[]>();
    const room = this.room();
    if (!room) return availability;
    const startHour = [Rooms.Asgard, Rooms.Alfheim].includes(room) ? 15 : 17;
    const endHour = 23;

    for (const [dateStr, reservations] of this.reservationsMap()) {
      const blocks = Array(endHour - startHour).fill(false);

      for (const res of reservations) {
        if (this.highlightOnlyGmId() && res.gmId !== this.highlightOnlyGmId()) {
          continue;
        }

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
    const key = format(date, 'yyyy-MM-dd');
    return this.hourlyAvailabilityMap().get(key) ?? [];
  }

  format(date: Date, pattern: string): string {
    return format(date, pattern, { locale: pl });
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
    const key = format(date, 'yyyy-MM-dd');
    const hourly = this.hourlyAvailabilityMap().get(key);
    return hourly?.every((slot) => slot) ?? false;
  }

  canShowHours(date: Date): boolean {
    return !this.isPastDay(date) && this.isSameMonth(date, this.currentMonth());
  }

  // === Events ===
  selectDate(date: Date) {
    if (this.selectionDisabled()) return;
    const formatted = format(date, 'yyyy-MM-dd');
    this.dateSelected.emit(formatted);
  }

  clickDate(date: Date) {
    const formatted = format(date, 'yyyy-MM-dd');
    this.dateClicked.emit(formatted);
  }

  prevMonth() {
    const newMonth = addMonths(this.currentMonth(), -1);
    if (startOfMonth(newMonth) >= this.minMonth) {
      this.currentMonth.set(newMonth);
    }
  }

  nextMonth() {
    const newMonth = addMonths(this.currentMonth(), 1);
    if (startOfMonth(newMonth) <= this.maxMonth) {
      this.currentMonth.set(newMonth);
    }
  }

  trackByDate(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }
}
