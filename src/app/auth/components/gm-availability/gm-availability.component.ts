import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  TemplateRef,
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
import { TimeSlots } from '../../../core/enums/hours';
import { DayDirection } from '../../../core/enums/days';
import { GmAvailabilityStoreService } from '../../core/services/gm-availability-store/gm-availability-store.service';
import { forkJoin, of } from 'rxjs';
import { ToastService } from '../../../core/services/toast/toast.service';
import { IAvailabilitySlot } from '../../../core/interfaces/i-availability-slot';
import { GmSchedulingService } from '../../core/services/gm/gm-scheduling/gm-scheduling.service';

@Component({
  selector: 'app-gm-availability',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent],
  templateUrl: './gm-availability.component.html',
})
export class GmAvailabilityComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gmScheduling = inject(GmSchedulingService);
  private readonly toastService = inject(ToastService);
  readonly availabilityStore = inject(GmAvailabilityStoreService);

  private readonly calendar = viewChild(UniversalCalendarComponent);

  readonly userId = this.auth.user()?.id!;
  readonly selectedDate = signal<string | null>(null);
  readonly dayDirection = DayDirection;
  private originalDates = signal<Set<string>>(new Set());

  readonly availabilitySuccessToast = viewChild<TemplateRef<unknown>>(
    'availabilitySuccessToast'
  );
  readonly availabilityErrorToast = viewChild<TemplateRef<unknown>>(
    'availabilityErrorToast'
  );

  readonly lastError = signal<any | null>(null);

  readonly startHours = Array.from(
    { length: TimeSlots.end - TimeSlots.noonStart },
    (_, i) => TimeSlots.noonStart + i
  );

  private readonly calendarBlockCount = TimeSlots.end - TimeSlots.noonStart;

  private isTimed = (
    slot: IAvailabilitySlot
  ): slot is IAvailabilitySlot & { fromHour: number; toHour: number } =>
    typeof (slot as any).fromHour === 'number' &&
    typeof (slot as any).toHour === 'number';

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
      if (!map.has(slot.date)) map.set(slot.date, []);
      map.get(slot.date)!.push(slot);
    }
    return map;
  });

  readonly availabilityMap = computed(() => {
    const map = new Map<string, boolean[]>();
    for (const slot of this.availabilityStore.getAll()) {
      if (!this.isTimed(slot)) continue;
      const blocks = Array(this.calendarBlockCount).fill(false);
      for (let h = slot.fromHour; h < slot.toHour; h++) {
        const idx = h - TimeSlots.noonStart;
        if (idx >= 0 && idx < blocks.length) blocks[idx] = true;
      }
      map.set(slot.date, blocks);
    }
    return map;
  });

  ngOnInit(): void {
    this.fetchAvailability();
  }

  fetchAvailability() {
    this.gmScheduling
      .getAvailability(this.userId, this.visibleDates())
      .subscribe({
        next: (slots) => {
          this.availabilityStore.setBulk(slots);
          this.originalDates.set(new Set(slots.map((s) => s.date)));
        },
        error: (err) => console.error('❌ Błąd ładowania dostępności:', err),
      });
  }

  mapToAvailabilityBlocks = () => (slots: IAvailabilitySlot[]) => {
    const blocks = Array(this.calendarBlockCount).fill(false);
    for (const slot of slots) {
      if (!this.isTimed(slot)) continue;
      for (let h = slot.fromHour; h < slot.toHour; h++) {
        const idx = h - TimeSlots.noonStart;
        if (idx >= 0 && idx < blocks.length) blocks[idx] = true;
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
      userId: this.userId,
      workType: 'gm',
      date: event.date,
      fromHour: event.hour,
      toHour: event.hour + 1,
    } as IAvailabilitySlot);
  }

  selectStartHour(hour: number | null) {
    const date = this.selectedDate();
    if (!date) return;

    if (hour === null) {
      this.resetDayAvailability();
      return;
    }

    const current = this.availabilityStore.getDay(date) ?? {
      userId: this.userId,
      workType: 'gm' as const,
      date,
      fromHour: hour,
      toHour: hour + 1,
    };

    this.availabilityStore.setDay(date, {
      ...current,
      userId: this.userId,
      workType: 'gm',
      fromHour: hour,
      toHour: Math.max(hour + 1, (current as any).toHour ?? hour + 1),
    } as IAvailabilitySlot);
  }

  selectEndHour(hour: number) {
    const date = this.selectedDate();
    if (!date) return;

    const current = this.availabilityStore.getDay(date) ?? {
      userId: this.userId,
      workType: 'gm' as const,
      date,
      fromHour: TimeSlots.noonStart,
      toHour: hour,
    };

    this.availabilityStore.setDay(date, {
      ...current,
      userId: this.userId,
      workType: 'gm',
      fromHour: Math.min((current as any).fromHour ?? hour - 1, hour - 1),
      toHour: hour ?? TimeSlots.end,
    } as IAvailabilitySlot);
  }

  selectWholeDay() {
    const date = this.selectedDate();
    if (!date) return;
    this.availabilityStore.setDay(date, {
      userId: this.userId,
      workType: 'gm',
      date,
      fromHour: TimeSlots.noonStart,
      toHour: TimeSlots.end,
    } as IAvailabilitySlot);
  }

  resetDayAvailability() {
    const date = this.selectedDate();
    if (!date) return;
    this.availabilityStore.removeDay(date);
  }

  getStartHour(): number | null {
    const date = this.selectedDate();
    const s = date ? this.availabilityStore.getDay(date) : undefined;
    return s && this.isTimed(s) ? s.fromHour : null;
  }

  getEndHour(): number | null {
    const date = this.selectedDate();
    const s = date ? this.availabilityStore.getDay(date) : undefined;
    return s && this.isTimed(s) ? s.toHour : null;
  }

  getEndHourOptions(): number[] {
    const from = this.getStartHour();
    if (from === null) return [];
    const count = TimeSlots.end - from;
    return Array.from({ length: count }, (_, i) => from + 1 + i);
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

  // ...
  saveAvailability() {
    // bierzemy tylko timed GM – nic z external_event tu nie powinno wejść
    const currentTimedGm = this.availabilityStore
      .getAll()
      .filter(
        (
          s
        ): s is IAvailabilitySlot & {
          workType: 'gm';
          fromHour: number;
          toHour: number;
        } =>
          s.workType === 'gm' &&
          typeof (s as any).fromHour === 'number' &&
          typeof (s as any).toHour === 'number'
      );

    const currentDates = new Set(currentTimedGm.map((s) => s.date));
    const original = this.originalDates();

    const datesToDelete = Array.from(original).filter(
      (d) => !currentDates.has(d)
    );

    const delete$ = datesToDelete.length
      ? this.gmScheduling.deleteAvailability(this.userId, datesToDelete)
      : of(null);

    const upsert$ = this.gmScheduling.upsertMany(
      currentTimedGm.map((s) => ({
        ...s,
        userId: this.userId,
        workType: 'gm' as const,
      }))
    );

    forkJoin([delete$, upsert$]).subscribe({
      next: () => {
        this.availabilityStore.clear();
        this.fetchAvailability();
        const template = this.availabilitySuccessToast();
        if (template) {
          this.toastService.show({
            template,
            classname: 'bg-success text-white',
            header: 'Zaktualizowano!',
          });
        }
      },
      error: (err) => {
        this.lastError.set(err);
        const template = this.availabilityErrorToast();
        if (template) {
          this.toastService.show({
            template,
            classname: 'bg-danger text-white',
            header: 'Błąd aktualizacji!',
          });
        }
      },
    });
  }
}
