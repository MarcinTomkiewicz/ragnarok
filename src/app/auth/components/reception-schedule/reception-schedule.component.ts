import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { addMonths, format, startOfMonth } from 'date-fns';

import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { ReceptionScheduleService } from '../../core/services/reception-schedule/reception-schedule.service';
import { BackendService } from '../../../core/services/backend/backend.service';
import { ExternalEventsService } from '../../core/services/external-events/external-events.service';
import { IUser } from '../../../core/interfaces/i-user';
import { IReceptionSchedule } from '../../../core/interfaces/i-reception-schedule';

type DayView = {
  recName?: string | null;
  extLabel?: string | null;     // prefer short event name; fallback to runner's name
  combined?: string | null;     // two-line label: "Rec\nEvent: Runner" (albo "Brak grafiku")
};

@Component({
  selector: 'app-reception-schedule-preview',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent],
  templateUrl: './reception-schedule.component.html',
  styleUrls: ['./reception-schedule.component.scss'],
})
export class ReceptionScheduleComponent {
  private readonly schedule = inject(ReceptionScheduleService);
  private readonly backend = inject(BackendService);
  private readonly events = inject(ExternalEventsService);

  private readonly calendar = viewChild(UniversalCalendarComponent);

  /** 0 = bieżący miesiąc, 1 = przyszły miesiąc */
  readonly monthOffset = signal<0 | 1>(0);

  /** Map<yyyy-MM-dd, DayView[]> consumed by UniversalCalendar */
  readonly dailyMap = signal<Map<string, unknown[]>>(new Map());

  /** Optional: dzisiejsza data (np. do własnych nagłówków) */
  readonly todayIso = computed(() => format(new Date(), 'yyyy-MM-dd'));

  switchTo(offset: 0 | 1) {
    if (this.monthOffset() === offset) return;
    this.monthOffset.set(offset);
    const base = startOfMonth(new Date());
    const target = addMonths(base, offset);
    this.calendar()?.setMonthView(target);
    // UniversalCalendar wyemituje (monthChanged), więc dane same się przeładują
  }

  /** Kalendarz emituje listę widocznych dat — dogrywamy do niej dane. */
  onMonthChanged = (visibleDates: string[]) => {
    if (!visibleDates?.length) {
      this.dailyMap.set(new Map());
      return;
    }

    const weekdays = Array.from(new Set(visibleDates.map(d => new Date(d).getDay())));

    // 1) Grafik dla dat
    this.schedule.getForDates(visibleDates).subscribe(rows => {
      const byDate = new Map<string, IReceptionSchedule>();
      for (const r of rows) byDate.set(r.workDate, r);

      const userIds = Array.from(
        new Set(
          rows.flatMap(r => [r.receptionistId, r.externalRunnerId].filter(Boolean) as string[])
        )
      );

      // 2) Użytkownicy do etykiet
      this.backend.getByIds<IUser>('users', userIds).subscribe(users => {
        const userById = new Map(users.map(u => [u.id, u]));

        // 3) Aktywne eventy (krótka nazwa) wg dni tygodnia
        this.events.getActiveForWeekdays(weekdays).subscribe(defs => {
          const shortByWeekday = new Map<number, string>();
          for (const def of defs) {
            if (def?.weekday != null && def?.shortName) shortByWeekday.set(def.weekday, def.shortName);
          }

          // 4) Składamy DayView – w tym „Brak grafiku” gdy nic nie ma
          const out = new Map<string, unknown[]>();

          for (const d of visibleDates) {
            const row = byDate.get(d);

            if (!row) {
              // w ogóle brak wpisu grafiku na ten dzień
              out.set(d, [{ combined: 'Brak grafiku' } as DayView]);
              continue;
            }

            const recUser = row.receptionistId ? userById.get(row.receptionistId) ?? null : null;
            const extUser = row.externalRunnerId ? userById.get(row.externalRunnerId) ?? null : null;

            const recName = this.displayUser(recUser);
            const weekday = new Date(d).getDay();
            const shortName = shortByWeekday.get(weekday) ?? null;

            // preferujemy "ShortName: Runner", a jeśli brak shortName — sam Runner
            const runner = this.displayUser(extUser);
            
            const extLabel = shortName ? (runner ? `${shortName}: ${runner}` : `${shortName}: Brak`) : runner ?? null;

            let combined = [recName, extLabel].filter(Boolean).join('\n');
            if (!combined) combined = 'Brak grafiku'; // jest wiersz, ale pusto

            out.set(d, [{ recName, extLabel, combined } as DayView]);
          }

          this.dailyMap.set(out);
        });
      });
    });
  };

  /** Renderujemy `combined` w wierszu „external-event” (white-space: pre-line). */
  readonly mapDailyToDayFlags = () => (items: unknown[]) => {
    const it = (items?.[0] as DayView) || undefined;
    if (!it?.combined) return null;
    return { externalEventName: it.combined };
  };

  /** Podgląd grafiku – bez kropek godzinowych. */
  readonly mapToEmptyBlocks = () => (_items: unknown[]) => [];

  /** nickname > firstName > email */
  private displayUser(u: IUser | null | undefined): string | null {
    if (!u) return null;
    if (u.useNickname && u.nickname) return u.nickname;
    if (u.firstName) return u.firstName;
    return u.email ?? null;
  }
}
