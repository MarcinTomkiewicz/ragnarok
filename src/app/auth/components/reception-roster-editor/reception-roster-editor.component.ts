import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

import { IconClass } from '../../../core/enums/icons';
import { CoworkerRoles } from '../../../core/enums/roles';
import { TimeSlots } from '../../../core/enums/hours';

import type { WorkType } from '../../../core/interfaces/i-availability-slot';
import { WorkTypeConst } from '../../../core/interfaces/i-availability-slot';

import { IExternalEventDef } from '../../../core/interfaces/i-external-event-def';
import { IReceptionSchedule, ReceptionRosterRow } from '../../../core/interfaces/i-reception-schedule';
import { IUser } from '../../../core/interfaces/i-user';

import { AdminAvailabilityService } from '../../core/services/admin-availability/admin-availability.service';
import { CoworkersService } from '../../core/services/coworkers/coworkers.service';
import { ExternalEventsService } from '../../core/services/external-events/external-events.service';
import { ReceptionScheduleService } from '../../core/services/reception-schedule/reception-schedule.service';

type TotalRow = { userId: string; total: number };

@Component({
  selector: 'app-reception-roster-editor',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule],
  templateUrl: './reception-roster-editor.component.html',
  styleUrl: './reception-roster-editor.component.scss',
})
export class ReceptionRosterEditorComponent implements OnInit {
  // --- serwisy (czytelne nazwy) ---
  private readonly adminAvailabilityService = inject(AdminAvailabilityService);
  private readonly externalEventsService = inject(ExternalEventsService);
  private readonly receptionScheduleService = inject(ReceptionScheduleService);
  private readonly coworkersService = inject(CoworkersService);

  readonly IconClass = IconClass;

  // 0 = bieżący, 1 = przyszły miesiąc
  readonly monthOffset = signal<0 | 1>(0);

  // dane do UI
  private readonly usersByIdSig = signal<Map<string, IUser>>(new Map());
  private readonly existingByDateSig = signal<Map<string, IReceptionSchedule>>(new Map());

  // kandydaci (cache na czas generowania wierszy)
  private readonly receptionCandidatesByDate = new Map<string, Set<string>>();
  private readonly externalCandidatesByDate  = new Map<string, Set<string>>();

  // wiersze UI
  readonly rows = signal<ReceptionRosterRow[]>([]);

  // sumy 6h/d (tylko recepcja)
  readonly totalsByUser = computed(() => {
    const totals = new Map<string, number>();
    this.rows().forEach(r => {
      if (r.receptionistId) {
        totals.set(
          r.receptionistId,
          (totals.get(r.receptionistId) ?? 0) + ReceptionScheduleService.RECEPTION_HOURS
        );
      }
    });
    return totals;
  });

  readonly totalsList = computed<TotalRow[]>(() => {
    const list: TotalRow[] = [];
    this.totalsByUser().forEach((total, userId) => list.push({ userId, total }));
    list.sort((a, b) => this.displayNameById(a.userId).localeCompare(this.displayNameById(b.userId)));
    return list;
  });

  // --- lifecycle ---
  ngOnInit(): void { this.load(); }

  switchTo(offset: 0 | 1) {
    if (this.monthOffset() === offset) return;
    this.monthOffset.set(offset);
    this.load();
  }

  // --- helpers (nazwy wprost, zero skrótów) ---
  private computeMonthDays(offset: 0 | 1): string[] {
    const today = new Date();
    const baseMonth = today.getMonth() + offset;
    const year = today.getFullYear() + Math.floor(baseMonth / 12);
    const month = (baseMonth + 12) % 12;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const dd = d.getDate().toString().padStart(2, '0');
      days.push(`${y}-${m}-${dd}`);
    }
    return days;
  }

  private ensureSet(map: Map<string, Set<string>>, key: string): Set<string> {
    let set = map.get(key);
    if (!set) {
      set = new Set<string>();
      map.set(key, set);
    }
    return set;
  }

  private toArray(set: Set<string> | undefined): string[] {
    return set ? [...set] : [];
  }

  displayName(u: IUser | undefined): string {
    if (!u) return 'Użytkownik';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName || u.email || 'Użytkownik';
  }
  displayNameById = (userId: string): string => this.displayName(this.usersByIdSig().get(userId));
  formatDate(ymd: string) { return format(parseISO(ymd), 'dd.MM.yyyy'); }

  // kwalifikacja do slotu 17–23
  private isTimed(entry: any): entry is { fromHour: number; toHour: number } {
    return typeof entry?.fromHour === 'number' && typeof entry?.toHour === 'number';
  }
  private qualifiesForLateReception(entry: any): boolean {
    if (!this.isTimed(entry)) return false;
    return entry.fromHour <= TimeSlots.lateStart && entry.toHour >= TimeSlots.end;
  }

  // --- load ---
  private load() {
    const days = this.computeMonthDays(this.monthOffset());

    this.receptionCandidatesByDate.clear();
    this.externalCandidatesByDate.clear();

    // 1) Zaciągamy availability tylko z potrzebnych typów (konkretne wartości z WorkTypeConst)
    this.adminAvailabilityService
      .getAvailabilityForDates(days, [
        WorkTypeConst.Reception,
        WorkTypeConst.ExternalEvent,
      ] as WorkType[])
      .subscribe({
        next: (slots) => {
          const mentionedUserIds = new Set<string>();

          // 2) Budowa kandydatów (forEach dla czytelności)
          slots.forEach(slot => {
            mentionedUserIds.add(slot.userId);
            const dateKey = slot.date;

            if (slot.workType === WorkTypeConst.Reception) {
              // recepcja z godzinami co najmniej 17–23 ⇒ do obu kolumn
              if (this.qualifiesForLateReception(slot)) {
                this.ensureSet(this.receptionCandidatesByDate, dateKey).add(slot.userId);
                this.ensureSet(this.externalCandidatesByDate,  dateKey).add(slot.userId);
              }
            } else if (slot.workType === WorkTypeConst.ExternalEvent) {
              // external_event_only ⇒ tylko event
              this.ensureSet(this.externalCandidatesByDate, dateKey).add(slot.userId);
            }
          });

          // 3) Użytkownicy (z sensowną rolą)
          this.coworkersService.getWithMinRole(CoworkerRoles.Gm).subscribe({
            next: (usersAll) => {
              const users = usersAll.filter(u => mentionedUserIds.has(u.id));
              const map = new Map<string, IUser>();
              users.forEach(u => map.set(u.id, u));
              this.usersByIdSig.set(map);

              // 4) Aktywne eventy dla dni tygodnia, które występują
              const weekdays = Array.from(new Set(days.map(d => parseISO(d).getDay()))); // 0..6
              this.externalEventsService.getActiveForWeekdays(weekdays).subscribe({
                next: (eventDefs) => {
                  // 5) Istniejący grafik
                  this.receptionScheduleService.getForDates(days).subscribe({
                    next: (scheduleRows) => {
                      const existingByDate = new Map<string, IReceptionSchedule>();
                      scheduleRows.forEach(s => existingByDate.set(s.workDate, s));
                      this.existingByDateSig.set(existingByDate);

                      // 6) Zbuduj wiersze UI (map)
                      const uiRows: ReceptionRosterRow[] = days.map(date => {
                        const dt = parseISO(date);
                        const weekdayIndex = dt.getDay(); // 0..6
                        const weekdayLabel = format(dt, 'EEEE', { locale: pl });
                        const eventForDay = eventDefs.find(e => e.weekday === weekdayIndex) || null;

                        const exists = existingByDate.get(date);
                        return {
                          date,
                          weekday: weekdayLabel,
                          receptionistId: exists?.receptionistId ?? null,
                          externalRunnerId: exists?.externalRunnerId ?? null,
                          externalEventId: eventForDay?.id ?? null,
                          receptionistCandidates: this.toArray(this.receptionCandidatesByDate.get(date)),
                          externalRunnerCandidates: this.toArray(this.externalCandidatesByDate.get(date)),
                        };
                      });

                      this.rows.set(uiRows);
                    },
                    error: (e) => {
                      console.error('Błąd pobierania grafiku:', e);
                      this.rows.set([]);
                    },
                  });
                },
                error: (e) => {
                  console.error('Błąd pobierania eventów:', e);
                },
              });
            },
            error: (e) => {
              console.error('Błąd pobierania użytkowników:', e);
              this.usersByIdSig.set(new Map());
            },
          });
        },
        error: (e) => {
          console.error('Błąd availability:', e);
          this.rows.set([]);
        },
      });
  }

  // --- actions ---
  chooseReceptionist(date: string, userId: string | null) {
    this.rows.set(this.rows().map(r => r.date === date ? { ...r, receptionistId: userId } : r));
  }

  chooseExternalRunner(date: string, userId: string | null) {
    this.rows.set(this.rows().map(r => r.date === date ? { ...r, externalRunnerId: userId } : r));
  }

  clearRow(date: string) {
    const exists = this.existingByDateSig().get(date);
    this.rows.set(this.rows().map(r =>
      r.date === date
        ? {
            ...r,
            receptionistId: exists?.receptionistId ?? null,
            externalRunnerId: exists?.externalRunnerId ?? null,
          }
        : r
    ));
  }

  save() {
    const toUpsert: IReceptionSchedule[] = this.rows().map(r => ({
      workDate: r.date,
      receptionistId: r.receptionistId ?? null,
      externalEventId: r.externalEventId ?? null,
      externalRunnerId: r.externalEventId ? (r.externalRunnerId ?? null) : null,
    }));

    this.receptionScheduleService.upsertMany(toUpsert).subscribe({
      next: () => this.load(),
      error: (e) => console.error('Błąd zapisu grafiku:', e),
    });
  }
}
