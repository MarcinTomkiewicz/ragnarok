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
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import { TimeSlots } from '../../../core/enums/hours';
import { DayDirection } from '../../../core/enums/days';
import { GmAvailabilityStoreService } from '../../core/services/gm-availability-store/gm-availability-store.service';
import { forkJoin, of } from 'rxjs';
import { ToastService } from '../../../core/services/toast/toast.service';
import { IAvailabilitySlot } from '../../../core/interfaces/i-availability-slot';
import { GmSchedulingService } from '../../core/services/gm/gm-scheduling/gm-scheduling.service';
import { ReservationService } from '../../core/services/reservation/reservation.service';
import { InfoModalComponent } from '../../../common/info-modal/info-modal.component';

type TimedGm = IAvailabilitySlot & { workType: 'gm'; fromHour: number; toHour: number };

@Component({
  selector: 'app-gm-availability',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent],
  templateUrl: './gm-availability.component.html',
})
export class GmAvailabilityComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly gmScheduling = inject(GmSchedulingService);
  private readonly reservations = inject(ReservationService);
  private readonly toastService = inject(ToastService);
  private readonly modal = inject(NgbModal);
  readonly availabilityStore = inject(GmAvailabilityStoreService);

  private readonly calendar = viewChild(UniversalCalendarComponent);

  readonly userId = this.auth.user()?.id!;
  readonly selectedDate = signal<string | null>(null);
  readonly dayDirection = DayDirection;
  private originalDates = signal<Set<string>>(new Set());
  readonly lastError = signal<any | null>(null);

  readonly availabilitySuccessToast = viewChild<TemplateRef<unknown>>('availabilitySuccessToast');
  readonly availabilityErrorToast = viewChild<TemplateRef<unknown>>('availabilityErrorToast');

  readonly startHours = Array.from(
    { length: TimeSlots.end - TimeSlots.noonStart },
    (_, i) => TimeSlots.noonStart + i
  );

  private readonly calendarBlockCount = TimeSlots.end - TimeSlots.noonStart;

  private isTimed = (slot: IAvailabilitySlot): slot is TimedGm =>
    slot.workType === 'gm' &&
    typeof (slot as any).fromHour === 'number' &&
    typeof (slot as any).toHour === 'number';

  readonly visibleDates = computed(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(new Date(), 1));
    return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
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
    this.gmScheduling.getAvailability(this.userId, this.visibleDates()).subscribe({
      next: (slots) => {
        this.availabilityStore.setBulk(slots);
        this.originalDates.set(new Set(slots.map(s => s.date)));
      },
      error: (err) => console.error('❌ Błąd ładowania dostępności:', err),
    });
  }

  // Helpers

  private fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;

  /** Returns booked session window for the date: [minStart, maxEnd] or null if none. */
  private getBookedWindow(date: string): Promise<{ minStart: number; maxEnd: number } | null> {
    return new Promise((resolve) => {
      this.reservations.getReservationsForGm(this.userId, date).subscribe({
        next: (list) => {
          if (!list?.length) { resolve(null); return; }
          let minStart = Number.POSITIVE_INFINITY;
          let maxEnd = Number.NEGATIVE_INFINITY;
          for (const r of list) {
            const start = parseInt(r.startTime.split(':')[0], 10);
            const end = start + r.durationHours;
            if (start < minStart) minStart = start;
            if (end > maxEnd)     maxEnd   = end;
          }
          resolve({ minStart, maxEnd });
        },
        error: () => resolve(null),
      });
    });
  }

  private showBlockedForWindow(win: { minStart: number; maxEnd: number } | null) {
    const ref = this.modal.open(InfoModalComponent, { backdrop: 'static' });
    ref.componentInstance.header = 'Zmiana zablokowana';
    ref.componentInstance.message = win
      ? `Nie możesz zmienić swojej dyspozycyjności na ten dzień, ponieważ gracze zarezerwowali sesję u Ciebie. Twoja dyspozycyjność musi obejmować godziny co najmniej od ${this.fmt(win.minStart)} do ${this.fmt(win.maxEnd)}.`
      : 'Nie możesz zmienić swojej dyspozycyjności na ten dzień.';
    ref.componentInstance.showCancel = false;
  }

  // Calendar bindings

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

  // Guards vs. reservations

  /** Grid click proposing a 1h window.
   *  With an existing reservation:
   *  - start must be ≤ minStart,
   *  - end is auto-extended to maxEnd.
   */
  async onHourClicked(event: { date: string; hour: number }) {
    this.selectedDate.set(event.date);
    const win = await this.getBookedWindow(event.date);

    if (win) {
      if (event.hour > win.minStart) {
        this.showBlockedForWindow(win);
        return;
      }
      this.availabilityStore.setDay(event.date, {
        userId: this.userId,
        workType: 'gm',
        date: event.date,
        fromHour: event.hour,
        toHour: Math.max(event.hour + 1, win.maxEnd),
      } as TimedGm);
      return;
    }

    this.availabilityStore.setDay(event.date, {
      userId: this.userId,
      workType: 'gm',
      date: event.date,
      fromHour: event.hour,
      toHour: event.hour + 1,
    } as TimedGm);
  }

  /** Start time change. With reservations present, start must be ≤ minStart. */
  async selectStartHour(hour: number | null) {
    const date = this.selectedDate();
    if (!date) return;

    const win = await this.getBookedWindow(date);

    if (hour === null) {
      if (win) { this.showBlockedForWindow(win); return; }
      this.resetDayAvailability();
      return;
    }

    if (win && hour > win.minStart) {
      this.showBlockedForWindow(win);
      return;
    }

    const current = (this.availabilityStore.getDay(date) as TimedGm | undefined) ?? {
      userId: this.userId,
      workType: 'gm' as const,
      date,
      fromHour: hour,
      toHour: hour + 1,
    };

    const next: TimedGm = {
      ...current,
      fromHour: hour,
      toHour: Math.max(hour + 1, current.toHour ?? hour + 1, win ? win.maxEnd : hour + 1),
    };

    this.availabilityStore.setDay(date, next);
  }

  /** End time change. With reservations present, end must be ≥ maxEnd. */
  async selectEndHour(hour: number) {
    const date = this.selectedDate();
    if (!date) return;

    const win = await this.getBookedWindow(date);

    if (win && hour < win.maxEnd) {
      this.showBlockedForWindow(win);
      return;
    }

    const current = (this.availabilityStore.getDay(date) as TimedGm | undefined) ?? {
      userId: this.userId,
      workType: 'gm' as const,
      date,
      fromHour: TimeSlots.noonStart,
      toHour: hour,
    };

    if (win && current.fromHour > win.minStart) {
      this.showBlockedForWindow(win);
      return;
    }

    const next: TimedGm = {
      ...current,
      toHour: hour ?? TimeSlots.end,
      fromHour: Math.min(current.fromHour, hour - 1),
    };

    this.availabilityStore.setDay(date, next);
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
    } as TimedGm);
  }

  async resetDayAvailability() {
    const date = this.selectedDate();
    if (!date) return;

    const win = await this.getBookedWindow(date);
    if (win) { this.showBlockedForWindow(win); return; }

    this.availabilityStore.removeDay(date);
  }

  // UI helpers

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

  // Persistence

  saveAvailability() {
    const currentTimedGm = this.availabilityStore
      .getAll()
      .filter(
        (s): s is TimedGm =>
          s.workType === 'gm' &&
          typeof (s as any).fromHour === 'number' &&
          typeof (s as any).toHour === 'number'
      );

    const currentDates = new Set(currentTimedGm.map((s) => s.date));
    const original = this.originalDates();

    const datesToDelete = Array.from(original).filter((d) => !currentDates.has(d));

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
