import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

import { CoworkerRoles } from '../../../core/enums/roles';
import { IconClass } from '../../../core/enums/icons';
import { IUser } from '../../../core/interfaces/i-user';
import { IReceptionSchedule, ReceptionRosterRow } from '../../../core/interfaces/i-reception-schedule';
import { IExternalEventDef } from '../../../core/interfaces/i-external-event-def';
import type { WorkType } from '../../../core/interfaces/i-availability-slot';

import { AdminAvailabilityService } from '../../core/services/admin-availability/admin-availability.service';
import { ExternalEventsService } from '../../core/services/external-events/external-events.service';
import { ReceptionScheduleService } from '../../core/services/reception-schedule/reception-schedule.service';
import { CoworkersService } from '../../core/services/coworkers/coworkers.service';

type TotalRow = { userId: string; total: number };

@Component({
  selector: 'app-reception-roster-editor',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './reception-roster-editor.component.html',
  styleUrl: './reception-roster-editor.component.scss',
})
export class ReceptionRosterEditorComponent implements OnInit {
  private readonly avail = inject(AdminAvailabilityService);
  private readonly events = inject(ExternalEventsService);
  private readonly schedule = inject(ReceptionScheduleService);
  private readonly coworkers = inject(CoworkersService);

  readonly IconClass = IconClass;

  // UWAGA: teraz 0 (bieżący) lub 1 (przyszły) miesiąc
  readonly monthOffset = signal<0 | 1>(0);

  // dane
  private readonly usersMapSig = signal<Map<string, IUser>>(new Map());
  private readonly eventDefs = signal<IExternalEventDef[]>([]);
  private readonly existing = signal<Map<string, IReceptionSchedule>>(new Map());

  // kandydaci
  private readonly byDateReception = new Map<string, Set<string>>();
  private readonly byDateExternal  = new Map<string, Set<string>>();

  // wiersze UI
  readonly rows = signal<ReceptionRosterRow[]>([]);

  // sumy 6h/d (tylko recepcja)
  readonly totalsByUser = computed(() => {
    const map = new Map<string, number>();
    for (const r of this.rows()) {
      if (r.receptionistId) {
        map.set(
          r.receptionistId,
          (map.get(r.receptionistId) ?? 0) + ReceptionScheduleService.RECEPTION_HOURS
        );
      }
    }
    return map;
  });

  readonly totalsList = computed<TotalRow[]>(() => {
    const out: TotalRow[] = [];
    for (const [userId, total] of this.totalsByUser().entries()) out.push({ userId, total });
    out.sort((a, b) => this.displayNameById(a.userId).localeCompare(this.displayNameById(b.userId)));
    return out;
  });

  ngOnInit() { this.load(); }

  switchTo(offset: 0 | 1) {
    if (this.monthOffset() === offset) return;
    this.monthOffset.set(offset);
    this.load();
  }

  // ---------- helpers ----------
  private getMonthDays(offset: 0 | 1): string[] {
    const today = new Date();
    const baseMonth = today.getMonth() + offset;
    const baseYear = today.getFullYear() + Math.floor(baseMonth / 12);
    const month = (baseMonth + 12) % 12;
    const start = new Date(baseYear, month, 1);
    const end = new Date(baseYear, month + 1, 0); // ostatni dzień

    const out: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      out.push(`${y}-${m}-${day}`);
    }
    return out;
  }

  private getSet(map: Map<string, Set<string>>, key: string): Set<string> {
    const existing = map.get(key);
    if (existing) return existing;
    const created = new Set<string>();
    map.set(key, created);
    return created;
  }
  private setToArray(s: Set<string> | undefined): string[] { return s ? [...s] : []; }

  displayName(u: IUser | undefined): string {
    if (!u) return 'Użytkownik';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName || u.email || 'Użytkownik';
  }
  displayNameById = (userId: string): string => this.displayName(this.usersMapSig().get(userId));
  formatDate(ymd: string) { return format(parseISO(ymd), 'dd.MM.yyyy'); }

  // ---------- load ----------
  private load() {
    const days = this.getMonthDays(this.monthOffset());

    this.byDateReception.clear();
    this.byDateExternal.clear();

    // availability dla ['reception','external_event'] — WorkType to typ, używamy stringów
    this.avail.getAvailabilityForDates(
      days,
      ['reception', 'external_event'] as WorkType[]
    ).subscribe({
      next: (slots) => {
        const userIds = new Set<string>();

        for (const s of slots) {
          userIds.add(s.userId);
          if (s.workType === 'reception') this.getSet(this.byDateReception, s.date).add(s.userId);
          else if (s.workType === 'external_event') this.getSet(this.byDateExternal, s.date).add(s.userId);
        }

        // użytkownicy
        this.coworkers.getWithMinRole(CoworkerRoles.Gm).subscribe({
          next: (usersAll) => {
            const users = usersAll.filter(u => userIds.has(u.id));
            const uMap = new Map<string, IUser>();
            for (const u of users) uMap.set(u.id, u);
            this.usersMapSig.set(uMap);

            // aktywne eventy dla dni tygodnia
            const weekdays = Array.from(new Set(days.map(d => parseISO(d).getDay()))); // 0..6
            this.events.getActiveForWeekdays(weekdays).subscribe({
              next: (evs) => {
                this.eventDefs.set(evs);

                // istniejący grafik
                this.schedule.getForDates(days).subscribe({
                  next: (sched) => {
                    const byDate = new Map<string, IReceptionSchedule>();
                    for (const s of sched) byDate.set(s.workDate, s);
                    this.existing.set(byDate);

                    // wiersze UI
                    const rows: ReceptionRosterRow[] = days.map(d => {
                      const dt = parseISO(d);
                      const weekdayJS = dt.getDay(); // 0..6
                      const weekdayLabel = format(dt, 'EEEE', { locale: pl });
                      const evForDay = evs.find(e => e.weekday === weekdayJS) || null;

                      const recCands = this.setToArray(this.byDateReception.get(d));
                      const extCands = this.setToArray(this.byDateExternal.get(d));
                      const exists = byDate.get(d);

                      return {
                        date: d,
                        weekday: weekdayLabel,
                        receptionistId: exists?.receptionistId ?? null,
                        externalRunnerId: exists?.externalRunnerId ?? null,
                        externalEventId: evForDay?.id ?? null,
                        receptionistCandidates: recCands,
                        externalRunnerCandidates: extCands,
                      };
                    });

                    this.rows.set(rows);
                  },
                  error: (e) => { console.error('Błąd pobierania grafiku:', e); this.rows.set([]); }
                });
              },
              error: (e) => { console.error('Błąd pobierania eventów:', e); this.eventDefs.set([]); }
            });
          },
          error: (e) => { console.error('Błąd pobierania użytkowników:', e); this.usersMapSig.set(new Map()); }
        });
      },
      error: (e) => { console.error('Błąd availability:', e); this.rows.set([]); }
    });
  }

  // ---------- actions ----------
  chooseReceptionist(date: string, userId: string | null) {
    this.rows.set(this.rows().map(r => r.date === date ? { ...r, receptionistId: userId } : r));
  }
  chooseExternalRunner(date: string, userId: string | null) {
    this.rows.set(this.rows().map(r => r.date === date ? { ...r, externalRunnerId: userId } : r));
  }
  clearRow(date: string) {
    const exists = this.existing().get(date);
    this.rows.set(this.rows().map(r => r.date === date ? {
      ...r,
      receptionistId: exists?.receptionistId ?? null,
      externalRunnerId: exists?.externalRunnerId ?? null,
    } : r));
  }

  save() {
    const toUpsert: IReceptionSchedule[] = this.rows().map(r => ({
      workDate: r.date,
      receptionistId: r.receptionistId ?? null,
      externalEventId: r.externalEventId ?? null,
      externalRunnerId: r.externalEventId ? (r.externalRunnerId ?? null) : null,
    }));

    this.schedule.upsertMany(toUpsert).subscribe({
      next: () => this.load(),
      error: (e) => console.error('Błąd zapisu grafiku:', e),
    });
  }
}
