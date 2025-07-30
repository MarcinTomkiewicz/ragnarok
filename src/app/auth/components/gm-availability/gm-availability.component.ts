import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  format,
  startOfMonth,
  addMonths,
  eachDayOfInterval,
  parseISO,
  addDays,
  isSameMonth,
} from 'date-fns';
import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import { GmService } from '../../core/services/gm/gm.service';
import { IAvailabilitySlot } from '../../../core/interfaces/i-gm-profile';
import { TimeSlots } from '../../../core/enums/hours';
import { DayDirection } from '../../../core/enums/days';

@Component({
  selector: 'app-gm-availability',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent],
  templateUrl: './gm-availability.component.html',
})
export class GmAvailabilityComponent {
  private readonly auth = inject(AuthService);
  private readonly gmService = inject(GmService);
  private readonly calendar = viewChild(UniversalCalendarComponent);

  readonly gmId = this.auth.user()?.id!;
  readonly selectedDate = signal<string | null>(null);
  readonly startHour = signal<number | null>(null);
  readonly endHour = signal<number | null>(null);
  readonly dayDirection = DayDirection;

  readonly availabilityMap = signal(new Map<string, IAvailabilitySlot[]>());

  readonly allHours = Array.from(
    { length: TimeSlots.end - TimeSlots.noonStart + 1 },
    (_, i) => TimeSlots.noonStart + i
  );

  readonly endHourOptions = computed(() => {
    const from = this.startHour();
    if (from === null) return [];
    return this.allHours.filter((h) => h > from && h <= TimeSlots.end);
  });

  readonly visibleDates = computed(() => {
    const start = startOfMonth(new Date());
    const end = startOfMonth(addMonths(new Date(), 1));
    return eachDayOfInterval({ start, end }).map((d) =>
      format(d, 'yyyy-MM-dd')
    );
  });

  constructor() {
    effect(() => {
      this.fetchAvailability();
    });
  }

  fetchAvailability() {
    this.gmService.getAvailability(this.gmId, this.visibleDates()).subscribe({
      next: (data) => {
        const map = new Map<string, IAvailabilitySlot[]>();
        for (const slot of data) {
          const list = map.get(slot.date) ?? [];
          list.push(slot);
          map.set(slot.date, list);
        }
        this.availabilityMap.set(map);
      },
      error: (err) => {
        console.error('Błąd ładowania dostępności GM:', err);
      },
    });
  }

  mapToAvailabilityBlocks = () => (slots: IAvailabilitySlot[]) => {
    const blocks = Array(this.allHours.length).fill(false);
    for (const s of slots) {
      if (
        s.available &&
        s.hour >= TimeSlots.noonStart &&
        s.hour <= TimeSlots.end
      ) {
        blocks[s.hour - TimeSlots.noonStart] = true;
      }
    }
    return blocks;
  };

  onDaySelected(date: string | null) {
    this.applyAvailability();
    this.selectedDate.set(date);

    if (!date) {
      this.startHour.set(null);
      this.endHour.set(null);
      return;
    }

    const slots = this.availabilityMap().get(date) ?? [];
    const availableHours = slots
      .filter((s) => s.available)
      .map((s) => s.hour)
      .sort((a, b) => a - b);

    if (availableHours.length > 0) {
      this.startHour.set(availableHours[0]);
      this.endHour.set(availableHours[availableHours.length - 1]);
    } else {
      this.startHour.set(null);
      this.endHour.set(null);
    }
  }
  onHourClicked(event: { date: string; hour: number }) {
    this.applyAvailability();
    this.selectedDate.set(event.date);
    this.startHour.set(event.hour);
    this.endHour.set(null);
  }

  selectStartHour(hour: number) {
    this.startHour.set(hour);
    this.endHour.set(null);
  }

  selectEndHour(hour: number) {
    this.endHour.set(hour);
  }

  selectWholeDay() {
    this.startHour.set(TimeSlots.noonStart);
    this.endHour.set(TimeSlots.end);
  }

  applyAvailability() {
    const date = this.selectedDate();
    const from = this.startHour();
    const to = this.endHour();

    if (!date || from === null || to === null) return;

    const slots: IAvailabilitySlot[] = this.allHours.map((hour) => ({
      gmId: this.gmId,
      date,
      hour,
      available: hour >= from && hour <= to, // UWAGA: <= zamiast <
    }));

    const map = new Map(this.availabilityMap());
    map.set(date, slots);
    this.availabilityMap.set(map);
  }

  changeDay(direction: DayDirection) {
    this.applyAvailability();

    const current = this.selectedDate();
    if (!current) return;

    const prevDate = parseISO(current);
    const next = addDays(prevDate, direction);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // reset do północy

    const max = startOfMonth(addMonths(today, 2)); // jeden miesiąc naprzód
    const maxDate = addDays(max, -1); // ostatni dzień kolejnego miesiąca

    if (next < today || next > maxDate) return;

    const nextStr = format(next, 'yyyy-MM-dd');

    this.selectedDate.set(nextStr);
    this.startHour.set(null);
    this.endHour.set(null);

    if (!this.visibleDates().includes(nextStr)) {
      this.fetchAvailability();
    }

    if (!isSameMonth(prevDate, next)) {
      this.calendar()?.setMonthView(next);
    }
  }

  saveAvailability() {
    const all: IAvailabilitySlot[] = [];
    for (const [, slots] of this.availabilityMap()) {
      all.push(...slots);
    }

    this.gmService.upsertMany(all).subscribe({
      next: () => {
        console.log('✅ Dostępność zapisana!');
      },
      error: (err) => {
        console.error('❌ Błąd zapisu dostępności:', err);
      },
    });
  }
}
