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
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { NgbAlert, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import { TimeSlots } from '../../../core/enums/hours';
import { DayDirection } from '../../../core/enums/days';
import { ToastService } from '../../../core/services/toast/toast.service';
import { IAvailabilitySlot, IDayFlags } from '../../../core/interfaces/i-availability-slot';
import { AvailabilityService } from '../../core/services/availability/availability.service';
import { AvailabilityStoreService } from '../../core/services/availability-store/availability-store.service';
import { ExternalEventsService } from '../../core/services/external-events/external-events.service';
import { ReceptionScheduleService } from '../../core/services/reception-schedule/reception-schedule.service';

import { forkJoin, of, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { InfoModalComponent } from '../../../common/info-modal/info-modal.component';

type TimedReception = IAvailabilitySlot & {
  workType: 'reception';
  fromHour: number;
  toHour: number;
};
type ExternalOnly = IAvailabilitySlot & {
  workType: 'external_event';
  externalEventOnly: true;
};

/** Lokalny enum; jak będzie potrzebny gdzie indziej – przenieś do core/enums */
export enum ReceptionChangeIntent {
  SetHours = 'SetHours',
  ClearHours = 'ClearHours',
  SetExternalOnly = 'SetExternalOnly',
  UnsetExternalOnly = 'UnsetExternalOnly',
}

type Assignment = 'none' | 'reception' | 'external';

@Component({
  selector: 'app-reception-availability',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent, NgbAlert],
  templateUrl: './reception-availability.component.html',
})
export class ReceptionAvailabilityComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly availability = inject(AvailabilityService);
  private readonly toast = inject(ToastService);
  private readonly events = inject(ExternalEventsService);
  readonly store = inject(AvailabilityStoreService);

  private readonly roster = inject(ReceptionScheduleService);
  private readonly modal = inject(NgbModal);

  private readonly calendar = viewChild(UniversalCalendarComponent);

  readonly userId = this.auth.user()?.id!;
  readonly dayDirection = DayDirection;

  readonly selectedDate = signal<string | null>(null);
  readonly lastError = signal<any | null>(null);

  /** 'yyyy-MM-dd' -> externalEvent.shortName (jeśli istnieje) */
  readonly eventShortNameByDate = signal<Map<string, string>>(new Map());

  // stałe lokalu
  private readonly MIN_START = 17;
  private readonly MAX_END = 23;

  onExternalOnlyChange(evt: Event) {
    const input = evt.target as HTMLInputElement | null;
    this.toggleExternalOnly(!!input?.checked);
  }

  readonly errorMessage = computed(() => {
    const e = this.lastError();
    if (!e) return '';
    if (typeof e === 'string') return e;
    if (typeof e?.message === 'string') return e.message;
    try { return JSON.stringify(e); } catch { return String(e); }
  });

  private readonly originalReceptionDates = signal<Set<string>>(new Set());
  private readonly originalExternalDates = signal<Set<string>>(new Set());

  readonly startHours = Array.from(
    { length: TimeSlots.end - TimeSlots.noonStart },
    (_, i) => TimeSlots.noonStart + i
  );

  private readonly calendarBlockCount = TimeSlots.end - TimeSlots.noonStart;

  readonly visibleDates = computed(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(new Date(), 1));
    return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
  });

  private isTimedReception = (s: IAvailabilitySlot): s is TimedReception =>
    s.workType === 'reception' &&
    typeof (s as any).fromHour === 'number' &&
    typeof (s as any).toHour === 'number';

  private isExternalOnly = (s: IAvailabilitySlot): s is ExternalOnly =>
    s.workType === 'external_event' && (s as any).externalEventOnly === true;

  /** Dane dla kalendarza: wrzucamy timed reception + external-only */
  readonly availabilityMapRaw = computed(() => {
    const map = new Map<string, IAvailabilitySlot[]>();

    for (const slot of this.store.getAll('reception')) {
      if (!this.isTimedReception(slot)) continue;
      if (!map.has(slot.date)) map.set(slot.date, []);
      map.get(slot.date)!.push(slot);
    }
    for (const slot of this.store.getAll('external_event')) {
      if (!this.isExternalOnly(slot)) continue;
      if (!map.has(slot.date)) map.set(slot.date, []);
      map.get(slot.date)!.push(slot);
    }
    return map;
  });

  /** Godzinówki dla kropek (tylko recepcja) */
  readonly availabilityMap = computed(() => {
    const map = new Map<string, boolean[]>();
    for (const slot of this.store.getAll('reception')) {
      if (!this.isTimedReception(slot)) continue;
      const blocks = Array(this.calendarBlockCount).fill(false);
      for (let h = slot.fromHour; h < slot.toHour; h++) {
        const idx = h - TimeSlots.noonStart;
        if (idx >= 0 && idx < blocks.length) blocks[idx] = true;
      }
      map.set(slot.date, blocks);
    }
    return map;
  });

  /** Czy w wybranym dniu jest external-only */
  readonly selectedExternalOnly = computed(() => {
    const d = this.selectedDate();
    if (!d) return false;
    const slot = this.store.getDay(d, 'external_event');
    return !!slot && this.isExternalOnly(slot);
  });

  ngOnInit(): void { this.fetchAvailability(); }

  onMonthChanged = (visibleDates: string[]) => {
    if (!visibleDates?.length) {
      this.eventShortNameByDate.set(new Map());
      return;
    }
    const weekdays = Array.from(new Set(visibleDates.map(d => new Date(d).getDay())));
    this.events.getActiveForWeekdays(weekdays).subscribe({
      next: (defs) => {
        const byWeekday = new Map<number, string>();
        for (const ev of defs) {
          if (ev?.weekday != null && ev?.shortName) {
            byWeekday.set(ev.weekday, ev.shortName);
          }
        }
        const map = new Map<string, string>();
        for (const d of visibleDates) {
          const wd = new Date(d).getDay();
          const sn = byWeekday.get(wd);
          if (sn) map.set(d, sn);
        }
        this.eventShortNameByDate.set(map);
      },
      error: () => this.eventShortNameByDate.set(new Map()),
    });
  };

  fetchAvailability() {
    combineLatest([
      this.availability.getAvailability(this.userId, this.visibleDates(), 'reception'),
      this.availability.getAvailability(this.userId, this.visibleDates(), 'external_event'),
    ]).subscribe({
      next: ([reception, external]) => {
        this.store.clearByWorkType('reception');
        this.store.clearByWorkType('external_event');
        this.store.setBulk([...reception, ...external]);

        this.originalReceptionDates.set(
          new Set(reception.filter(this.isTimedReception).map(s => s.date))
        );
        this.originalExternalDates.set(
          new Set(external.filter(this.isExternalOnly).map(s => s.date))
        );
      },
      error: (err) =>
        console.error('❌ Błąd ładowania dostępności (recepcja):', err),
    });
  }

  // dla UniversalCalendar: slots -> boolean[]
  mapToAvailabilityBlocks = () => (slots: IAvailabilitySlot[]) => {
    const blocks = Array(this.calendarBlockCount).fill(false);
    for (const slot of slots) {
      if (!this.isTimedReception(slot)) continue;
      for (let h = slot.fromHour; h < slot.toHour; h++) {
        const idx = h - TimeSlots.noonStart;
        if (idx >= 0 && idx < blocks.length) blocks[idx] = true;
      }
    }
    return blocks;
  };

  /** Flags: externalOnly + externalEventName (shortName) jeśli event istnieje */
  readonly mapDailyToDayFlags = () => (items: unknown[]): IDayFlags => {
    const slots = items as IAvailabilitySlot[];

    const hasReceptionTimed = slots.some(s =>
      s.workType === 'reception' &&
      typeof (s as any).fromHour === 'number' &&
      typeof (s as any).toHour === 'number'
    );
    const hasExternalOnly = slots.some(s =>
      s.workType === 'external_event' && (s as any).externalEventOnly === true
    );

    const out: IDayFlags = {};
    if (!hasReceptionTimed && hasExternalOnly) {
      out.externalOnly = true;
      const date = (slots[0] as IAvailabilitySlot | undefined)?.date;
      if (date) {
        const sn = this.eventShortNameByDate().get(date);
        if (sn) out.externalEventName = sn;
      }
    }
    return out;
  };

  onDaySelected(date: string | null) {
    this.selectedDate.set(date);
  }

  // ====== Modal
  private showBlocked(message: string) {
    const ref = this.modal.open(InfoModalComponent, { backdrop: 'static' }); // top
    ref.componentInstance.header = 'Zmiana zablokowana';
    ref.componentInstance.message = message;
    ref.componentInstance.showCancel = false;
  }

  // ====== Przydziały / Guardy

  private getAssignment(date: string): Observable<Assignment> {
    return this.roster.getUserAssignments(this.userId, [date]).pipe(
      map(m => (m.get(date) ?? 'none') as Assignment)
    );
  }

  private canModifyReception(
    date: string,
    intent: ReceptionChangeIntent
  ): Observable<boolean> {
    return this.getAssignment(date).pipe(
      map(assign => {
        switch (assign) {
          case 'none':
            return true;
          case 'reception':
            // przy recepcji: tylko ustawianie godzin
            return intent === ReceptionChangeIntent.SetHours;
          case 'external':
            // przy evencie: godziny i włączenie "tylko event"
            return (
              intent === ReceptionChangeIntent.SetHours ||
              intent === ReceptionChangeIntent.SetExternalOnly
            );
        }
      })
    );
  }

  private reasonMsg(assign: Assignment, extra?: 'start'|'end') {
    if (assign === 'reception') {
      return extra === 'start'
        ? 'Nie możesz ustawić godziny startu po 17:00, ponieważ masz wyznaczoną zmianę na recepcji (wymagane minimum 17:00–23:00).'
        : 'Nie możesz ustawić godziny końca przed 23:00, ponieważ masz wyznaczoną zmianę na recepcji (wymagane minimum 17:00–23:00).';
    }
    if (assign === 'external') {
      return extra === 'start'
        ? 'Nie możesz ustawić godziny startu po 17:00, ponieważ masz wyznaczone prowadzenie wydarzenia zewnętrznego (wymagane minimum 17:00–23:00).'
        : 'Nie możesz ustawić godziny końca przed 23:00, ponieważ masz wyznaczone prowadzenie wydarzenia zewnętrznego (wymagane minimum 17:00–23:00).';
    }
    return 'Operacja zablokowana.';
  }

  private explainWhyBlocked(date: string) {
    this.getAssignment(date).subscribe(a => {
      if (a === 'reception') {
        this.showBlocked('Nie możesz zmienić swojej dyspozycyjności na ten dzień, ponieważ masz wyznaczoną zmianę na recepcji.');
      } else if (a === 'external') {
        this.showBlocked('Nie możesz zmienić swojej dyspozycyjności na ten dzień, ponieważ masz wyznaczone prowadzenie wydarzenia zewnętrznego.');
      } else {
        this.showBlocked('Nie możesz zmienić swojej dyspozycyjności na ten dzień.');
      }
    });
  }

  // ====== Handlery (z guardami i regułą 17–23)

  onHourClicked(event: { date: string; hour: number }) {
    const date = event.date;
    this.canModifyReception(date, ReceptionChangeIntent.SetHours).subscribe(ok => {
      if (!ok) { this.explainWhyBlocked(date); return; }

      this.getAssignment(date).subscribe(assign => {
        // zawsze odznaczamy "tylko event" przy ustawianiu godzin
        const ext = this.store.getDay(date, 'external_event');
        if (ext) this.store.removeDay(date, 'external_event');

        if (assign === 'reception' || assign === 'external') {
          // przy przydziale: start nie może być > 17, koniec wymuszamy na 23
          if (event.hour > this.MIN_START) {
            this.showBlocked(this.reasonMsg(assign, 'start'));
            return;
          }
          this.selectedDate.set(date);
          this.store.setDay({
            userId: this.userId,
            workType: 'reception',
            date,
            fromHour: event.hour,
            toHour: this.MAX_END,
          } as TimedReception);
        } else {
          // bez przydziału – zwykłe zachowanie 1h
          this.selectedDate.set(date);
          this.store.setDay({
            userId: this.userId,
            workType: 'reception',
            date,
            fromHour: event.hour,
            toHour: event.hour + 1,
          } as TimedReception);
        }
      });
    });
  }

  toggleExternalOnly(checked: boolean) {
    const date = this.selectedDate();
    if (!date) return;

    const intent = checked
      ? ReceptionChangeIntent.SetExternalOnly
      : ReceptionChangeIntent.UnsetExternalOnly;

    this.canModifyReception(date, intent).subscribe(ok => {
      if (!ok) { this.explainWhyBlocked(date); return; }

      if (checked) {
        // włączamy external-only → kasujemy godzinówki
        this.store.removeDay(date, 'reception');
        this.store.setDay({
          userId: this.userId,
          workType: 'external_event',
          date,
          externalEventOnly: true,
        } as ExternalOnly);
      } else {
        // odznaczamy external-only (bez auto-godzin)
        this.store.removeDay(date, 'external_event');
      }
    });
  }

  selectStartHour(hour: number | null) {
    const date = this.selectedDate();
    if (!date) return;

    const intent = (hour === null)
      ? ReceptionChangeIntent.ClearHours
      : ReceptionChangeIntent.SetHours;

    this.canModifyReception(date, intent).subscribe(ok => {
      if (!ok) { this.explainWhyBlocked(date); return; }

      if (hour === null) {
        this.store.removeDay(date, 'reception');
        return;
      }

      this.getAssignment(date).subscribe(assign => {
        // przy ustawianiu godzin – odznacz "tylko event"
        const ext = this.store.getDay(date, 'external_event');
        if (ext) this.store.removeDay(date, 'external_event');

        const current = this.store.getDay(date, 'reception') as TimedReception | undefined;

        if (assign === 'reception' || assign === 'external') {
          // start > 17 z przydziałem — blokada
          if (hour > this.MIN_START) {
            this.showBlocked(this.reasonMsg(assign, 'start'));
            return;
          }
          // wymuś co najmniej 23 jako koniec
          const to = Math.max(current?.toHour ?? this.MAX_END, this.MAX_END);
          this.store.setDay({
            userId: this.userId,
            workType: 'reception',
            date,
            fromHour: hour,
            toHour: to,
          } as TimedReception);
        } else {
          const next: TimedReception = {
            userId: this.userId,
            workType: 'reception',
            date,
            fromHour: hour,
            toHour: Math.max(hour + 1, current?.toHour ?? hour + 1),
          };
          this.store.setDay(next);
        }
      });
    });
  }

  selectEndHour(hour: number) {
    const date = this.selectedDate();
    if (!date) return;

    this.canModifyReception(date, ReceptionChangeIntent.SetHours).subscribe(ok => {
      if (!ok) { this.explainWhyBlocked(date); return; }

      this.getAssignment(date).subscribe(assign => {
        // przy ustawianiu godzin – odznacz "tylko event"
        const ext = this.store.getDay(date, 'external_event');
        if (ext) this.store.removeDay(date, 'external_event');

        const current = (this.store.getDay(date, 'reception') as TimedReception) ?? {
          userId: this.userId,
          workType: 'reception' as const,
          date,
          fromHour: TimeSlots.noonStart,
          toHour: hour,
        };

        if (assign === 'reception' || assign === 'external') {
          if (hour < this.MAX_END) {
            this.showBlocked(this.reasonMsg(assign, 'end'));
            return;
          }
          const next: TimedReception = {
            ...current,
            toHour: hour,
            fromHour: Math.min(current.fromHour, hour - 1),
          };
          this.store.setDay(next);
        } else {
          const next: TimedReception = {
            ...current,
            toHour: hour ?? TimeSlots.end,
            fromHour: Math.min(current.fromHour, hour - 1),
          };
          this.store.setDay(next);
        }
      });
    });
  }

  selectWholeDay() {
    const date = this.selectedDate();
    if (!date) return;

    this.canModifyReception(date, ReceptionChangeIntent.SetHours).subscribe(ok => {
      if (!ok) { this.explainWhyBlocked(date); return; }

      // zawsze odznaczamy "tylko event"
      const ext = this.store.getDay(date, 'external_event');
      if (ext) this.store.removeDay(date, 'external_event');

      this.store.setDay({
        userId: this.userId,
        workType: 'reception',
        date,
        fromHour: TimeSlots.noonStart,
        toHour: TimeSlots.end,
      } as TimedReception);
    });
  }

  resetDayAvailability() {
    const date = this.selectedDate();
    if (!date) return;

    this.canModifyReception(date, ReceptionChangeIntent.ClearHours).subscribe(ok => {
      if (!ok) { this.explainWhyBlocked(date); return; }
      this.store.removeDay(date, 'reception');
      // nie dotykamy external-only
    });
  }

  // ====== Zapis bez zmian

  getStartHour(): number | null {
    const date = this.selectedDate();
    const s = date
      ? (this.store.getDay(date, 'reception') as TimedReception | undefined)
      : undefined;
    return s ? s.fromHour : null;
  }

  getEndHour(): number | null {
    const date = this.selectedDate();
    const s = date
      ? (this.store.getDay(date, 'reception') as TimedReception | undefined)
      : undefined;
    return s ? s.toHour : null;
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

  saveAvailability() {
    const timedReception = this.store.getAll('reception').filter(this.isTimedReception);
    const externalOnly = this.store.getAll('external_event').filter(this.isExternalOnly);

    const nowReceptionDates = new Set(timedReception.map(s => s.date));
    const nowExternalDates = new Set(externalOnly.map(s => s.date));
    const delReception = Array.from(this.originalReceptionDates()).filter(d => !nowReceptionDates.has(d));
    const delExternal = Array.from(this.originalExternalDates()).filter(d => !nowExternalDates.has(d));

    const deleteReception$ = delReception.length
      ? this.availability.delete(this.userId, delReception, 'reception')
      : of(null);
    const deleteExternal$ = delExternal.length
      ? this.availability.delete(this.userId, delExternal, 'external_event')
      : of(null);

    const upsert$ = this.availability.upsertMany([
      ...timedReception,
      ...externalOnly,
    ] as IAvailabilitySlot[]);

    forkJoin([deleteReception$, deleteExternal$, upsert$]).subscribe({
      next: () => {
        this.store.clearByWorkType('reception');
        this.store.clearByWorkType('external_event');
        this.fetchAvailability();

        const t = this.successTpl();
        if (t) {
          this.toast.show({
            template: t,
            classname: 'bg-success text-white',
            header: 'Zaktualizowano!',
          });
        }
      },
      error: (err) => {
        this.lastError.set(err);
        const t = this.errorTpl();
        if (t) {
          this.toast.show({
            template: t,
            classname: 'bg-danger text-white',
            header: 'Błąd aktualizacji!',
          });
        }
      },
    });
  }

  readonly successTpl = viewChild<TemplateRef<unknown>>('availabilitySuccessToast');
  readonly errorTpl = viewChild<TemplateRef<unknown>>('availabilityErrorToast');
}
