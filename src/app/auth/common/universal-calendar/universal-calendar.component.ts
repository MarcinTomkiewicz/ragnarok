import { CommonModule } from '@angular/common';
import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
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
import { Rooms } from '../../../core/enums/rooms';

@Component({
  selector: 'app-universal-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './universal-calendar.component.html',
  styleUrl: './universal-calendar.component.scss',
})
export class UniversalCalendarComponent {
  // === Inputs ===
  readonly dailyDataMap = input<Map<string, unknown[]>>(new Map());
  readonly mapDailyToHourlyAvailability = input<Function>();
  readonly selectedDate = input<string | null>(null);
  readonly selectionDisabled = input<boolean>(false);
  readonly room = input<Rooms | null>(null);
  readonly editMode = input<boolean>(false);

  // === Outputs ===
  readonly dateSelected = output<string | null>();
  readonly dateClicked = output<string>();
  readonly hourClicked = output<{ date: string; hour: number }>();

  // === Calendar Logic ===
  readonly currentMonth = signal(new Date());
  readonly minMonth = startOfMonth(new Date());
  readonly maxMonth = startOfMonth(addMonths(new Date(), 1));
  readonly monthChanged = output<string[]>();

  readonly modeClass = computed(() => {
    if (this.editMode()) return 'calendar-mode-availability';
    if (this.room()) return 'calendar-mode-reservation';
    return 'calendar-mode-readonly';
  });

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
  const mapFn = this.mapDailyToHourlyAvailability();

  for (const date of this.visibleDays()) {
    const key = format(date, 'yyyy-MM-dd');
    const items = this.dailyDataMap().get(key) ?? [];
    const blocks = mapFn?.(items) ?? [];
    availability.set(key, blocks);
  }

  return availability;
});

  getHourlyAvailability(date: Date): boolean[] {
    const key = format(date, 'yyyy-MM-dd');
    return this.hourlyAvailabilityMap().get(key) ?? [];
  }

  setMonthView(date: Date) {
    const newMonth = startOfMonth(date);
    if (newMonth >= this.minMonth && newMonth <= this.maxMonth) {
      this.currentMonth.set(newMonth);
    }
  }

  onHourClick(day: Date, hourIndex: number) {
    if (!this.editMode()) return;

    const dateStr = format(day, 'yyyy-MM-dd');
    const baseHour = 12;
    const hour = baseHour + hourIndex;

    this.hourClicked.emit({ date: dateStr, hour });
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

  canEditDay(date: Date): boolean {
    if (!this.editMode()) return false;
    return !this.isPastDay(date) && this.isSameMonth(date, this.currentMonth());
  }

  handleClick(date: Date) {
    const formatted = format(date, 'yyyy-MM-dd');
    const isReservedDay = this.isReserved(date);

    const canEdit = this.editMode();
    const isDisabled =
      this.selectionDisabled() ||
      this.isPastDay(date) ||
      !this.isSameMonth(date, this.currentMonth());

    if (!canEdit && (isDisabled || isReservedDay)) {
      return;
    }

    const isSameDate = this.selectedDate() === formatted;
    this.dateSelected.emit(isSameDate ? null : formatted);
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
