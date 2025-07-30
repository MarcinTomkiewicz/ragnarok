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
  endOfMonth,
} from 'date-fns';
import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import { GmService } from '../../core/services/gm/gm.service';
import { IAvailabilitySlot } from '../../../core/interfaces/i-gm-profile';
import { TimeSlots } from '../../../core/enums/hours';
import { DayDirection } from '../../../core/enums/days';
import { GmAvailabilityStoreService } from '../../core/services/gm-availability-store/gm-availability-store.service';

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
  readonly availabilityStore = inject(GmAvailabilityStoreService);

  readonly gmId = this.auth.user()?.id!;
  readonly selectedDate = signal<string | null>(null);
  readonly dayDirection = DayDirection;

  readonly allHours = Array.from(
    { length: TimeSlots.end - TimeSlots.noonStart + 1 },
    (_, i) => TimeSlots.noonStart + i
  );

  readonly visibleDates = computed(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(new Date(), 1));
    return eachDayOfInterval({ start, end }).map((d) =>
      format(d, 'yyyy-MM-dd')
    );
  });

  readonly availabilityMapRaw = computed(() => {
    const map = new Map<string, IAvailabilitySlot[]>();

    for (const slot of this.availabilityStore.getAll()) {
      if (!map.has(slot.date)) {
        map.set(slot.date, []);
      }
      map.get(slot.date)!.push(slot);
    }

    return map;
  });

  readonly availabilityMap = computed(() => {
    const map = new Map<string, boolean[]>();

    for (const slot of this.availabilityStore.getAll()) {
      const blocks = Array(this.allHours.length).fill(false);

      // 💡 Pętla półotwarta – toHour nie jest wliczany
      for (let h = slot.fromHour; h < slot.toHour; h++) {
        const idx = h - TimeSlots.noonStart;
        if (idx >= 0 && idx < blocks.length) {
          blocks[idx] = true;
        }
      }
      console.log(map.set(slot.date, blocks));

      map.set(slot.date, blocks);
    }

    return map;
  });

  constructor() {
    effect(() => this.fetchAvailability());
  }

  fetchAvailability() {
    this.gmService.getAvailability(this.gmId, this.visibleDates()).subscribe({
      next: (slots) => this.availabilityStore.setBulk(slots),
      error: (err) => console.error('❌ Błąd ładowania dostępności:', err),
    });
  }

  mapToAvailabilityBlocks = () => (slots: IAvailabilitySlot[]) => {
    const blocks = Array(this.allHours.length).fill(false);

    for (const slot of slots) {
      for (let h = slot.fromHour; h <= slot.toHour; h++) {
        const idx = h - TimeSlots.noonStart;
        if (idx >= 0 && idx < blocks.length) {
          blocks[idx] = true;
        }
      }
    }

    return blocks;
  };

  onDaySelected(date: string | null) {
    this.selectedDate.set(date);
  }

  onHourClicked(event: { date: string; hour: number }) {
    this.selectedDate.set(event.date);
    this.availabilityStore.setDay(event.date, {
      gmId: this.gmId,
      date: event.date,
      fromHour: event.hour,
      toHour: event.hour + 1,
    });
  }

  selectStartHour(hour: number) {
    const date = this.selectedDate();
    if (!date) return;

    const current = this.availabilityStore.getDay(date) ?? {
      gmId: this.gmId,
      date,
      fromHour: hour,
      toHour: hour + 1,
    };

    this.availabilityStore.setDay(date, {
      ...current,
      fromHour: hour,
      toHour: Math.max(hour + 1, current.toHour ?? hour + 1),
    });
  }

  selectEndHour(hour: number) {
    const date = this.selectedDate();
    if (!date) return;

    const current = this.availabilityStore.getDay(date) ?? {
      gmId: this.gmId,
      date,
      fromHour: TimeSlots.noonStart,
      toHour: hour,
    };

    this.availabilityStore.setDay(date, {
      ...current,
      fromHour: Math.min(current.fromHour, hour - 1),
      toHour: hour,
    });
  }

  selectWholeDay() {
    const date = this.selectedDate();
    if (!date) return;
    this.availabilityStore.setDay(date, {
      gmId: this.gmId,
      date,
      fromHour: TimeSlots.noonStart,
      toHour: TimeSlots.end,
    });
  }

  getStartHour(): number | null {
    const date = this.selectedDate();
    return date ? this.availabilityStore.getDay(date)?.fromHour ?? null : null;
  }

  getEndHour(): number | null {
    const date = this.selectedDate();
    return date ? this.availabilityStore.getDay(date)?.toHour ?? null : null;
  }

  getEndHourOptions(): number[] {
    const from = this.getStartHour();
    return from === null
      ? []
      : this.allHours.filter((h) => h > from && h <= TimeSlots.end);
  }

  changeDay(direction: DayDirection) {
    const current = this.selectedDate();
    if (!current) return;

    const prevDate = parseISO(current);
    const next = addDays(prevDate, direction);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = addDays(startOfMonth(addMonths(today, 2)), -1);

    if (next < today || next > maxDate) return;

    const nextStr = format(next, 'yyyy-MM-dd');
    this.selectedDate.set(nextStr);
    this.onDaySelected(nextStr);

    if (!this.visibleDates().includes(nextStr)) {
      this.fetchAvailability();
    }

    if (!isSameMonth(prevDate, next)) {
      this.calendar()?.setMonthView(next);
    }
  }

  saveAvailability() {
    const all = this.availabilityStore.getAll();
    this.gmService.upsertMany(all).subscribe({
      next: () => console.log('✅ Zapisano!'),
      error: (err) => console.error('❌ Błąd zapisu:', err),
    });
  }
}
