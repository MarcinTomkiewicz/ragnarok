import { CommonModule } from '@angular/common';
import {
  Component,
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
import { Rooms } from '../../../core/enums/rooms';
import { IDayFlags } from '../../../core/interfaces/i-availability-slot';

@Component({
  selector: 'app-universal-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './universal-calendar.component.html',
  styleUrl: './universal-calendar.component.scss',
})
export class UniversalCalendarComponent {
  readonly dailyDataMap = input<Map<string, unknown[]>>(new Map());
  readonly mapDailyToHourlyAvailability = input<Function>();
  readonly selectedDate = input<string | null>(null);
  readonly selectionDisabled = input<boolean>(false);
  readonly room = input<Rooms | null>(null);
  readonly editMode = input<boolean>(false);
  readonly isMemberClubBlocked = input<boolean>(false);
  readonly alwaysClickable = input<boolean>(false);
  readonly mapDailyToDayFlags =
    input<(items: unknown[]) => IDayFlags | null | undefined>();

  readonly dateSelected = output<string | null>();
  readonly dateClicked = output<string>();
  readonly hourClicked = output<{ date: string; hour: number }>();

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
      const visibleDates = this.visibleDays().map(d => format(d, 'yyyy-MM-dd'));
      this.monthChanged.emit(visibleDates);
    });
  }

  readonly dayNames = Array.from({ length: 7 }, (_, i) =>
    format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'ccc', {
      locale: pl,
    })
  );

  readonly visibleDays = computed(() => {
    const start = startOfWeek(startOfMonth(this.currentMonth()), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(this.currentMonth()), { weekStartsOn: 1 });
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

  readonly blockedDatesForThisWeek = computed(() => {
    if (this.isMemberClubBlocked()) {
      const today = new Date();
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      const blockedDates: string[] = [];
      let currentDate = start;
      while (currentDate <= end) {
        blockedDates.push(format(currentDate, 'yyyy-MM-dd'));
        currentDate = addDays(currentDate, 1);
      }
      return blockedDates;
    }
    return [];
  });

  readonly isReserved = (date: Date): boolean => {
    const key = format(date, 'yyyy-MM-dd');
    const hourly = this.hourlyAvailabilityMap().get(key);
    const isBlockedDay = this.blockedDatesForThisWeek().includes(key);
    return isBlockedDay || (hourly?.every(slot => slot) ?? false);
  };

  canShowHours(date: Date): boolean {
    return !this.isPastDay(date) && this.isSameMonth(date, this.currentMonth());
  }

  readonly dayFlagsMap = computed(() => {
    const flags = new Map<string, IDayFlags>();
    const fn = this.mapDailyToDayFlags();
    for (const date of this.visibleDays()) {
      const key = format(date, 'yyyy-MM-dd');
      const items = this.dailyDataMap().get(key) ?? [];
      const f = fn?.(items) ?? null;
      flags.set(key, f ?? {});
    }
    return flags;
  });

  getDayFlags(date: Date): IDayFlags {
    const key = format(date, 'yyyy-MM-dd');
    return this.dayFlagsMap().get(key) ?? {};
  }

  handleClick(date: Date) {
    const formatted = format(date, 'yyyy-MM-dd');
    const isReservedDay = this.isReserved(date);
    const isDisabled =
      this.selectionDisabled() ||
      this.isPastDay(date) ||
      !this.isSameMonth(date, this.currentMonth());

    if (!this.editMode() && (isDisabled || (!this.alwaysClickable() && isReservedDay))) {
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
