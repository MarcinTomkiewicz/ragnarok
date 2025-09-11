import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
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
import { UniversalCalendarComponent } from '../../common/universal-calendar/universal-calendar.component';
import { AdminAvailabilityService } from '../../core/services/admin-availability/admin-availability.service';
import {
  IAvailabilitySlot,
  WorkType,
} from '../../../core/interfaces/i-availability-slot';
import { TimeSlots } from '../../../core/enums/hours';
import { DayDirection } from '../../../core/enums/days';
import { IUser } from '../../../core/interfaces/i-user';

type TimedSlot = IAvailabilitySlot & { fromHour: number; toHour: number };

@Component({
  selector: 'app-availability-overview',
  standalone: true,
  imports: [CommonModule, UniversalCalendarComponent],
  templateUrl: './availability-overview.component.html',
  styleUrls: ['./availability-overview.component.scss'],
})
export class AvailabilityOverviewComponent implements OnInit {
  private readonly svc = inject(AdminAvailabilityService);

  readonly dayDirection = DayDirection;
  private readonly calendar = viewChild(UniversalCalendarComponent);

  // Filtry
  readonly showGm = signal(true);
  readonly showReception = signal(true);

  // Wybrany dzień
  readonly selectedDate = signal<string | null>(null);

  // Dane źródłowe
  private readonly slotsAll = signal<IAvailabilitySlot[]>([]);
  private readonly usersMap = signal<Map<string, IUser>>(new Map());

  // Siatka (12..22 -> 11 bloków)
  private readonly blockCount = TimeSlots.end - TimeSlots.noonStart;

  // Zakres (bieżący + następny miesiąc)
  readonly visibleDates = computed(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(addMonths(new Date(), 1));
    return eachDayOfInterval({ start, end }).map((d) =>
      format(d, 'yyyy-MM-dd')
    );
  });

  // Type guards
  private isTimed = (s: IAvailabilitySlot): s is TimedSlot =>
    typeof (s as any).fromHour === 'number' &&
    typeof (s as any).toHour === 'number';

  // Sloty do kalendarza po filtrach:
  // - jeśli oba włączone => bierzemy gm OR reception (external_event pomijamy, bo bez godzin)
  // - jeśli włączony tylko jeden => bierzemy tylko ten workType
  private readonly filteredTimedSlots = computed(() => {
    const inc: WorkType[] = [];
    if (this.showGm()) inc.push('gm');
    if (this.showReception()) inc.push('reception');
    // zabezpieczenie gdyby ktoś wymusił oba false (UI nie pozwoli, ale niech logika też wytrzyma)
    if (inc.length === 0) inc.push('gm');

    return this.slotsAll().filter(
      (s) => this.isTimed(s) && inc.includes(s.workType)
    );
  });

  readonly dailyDataMap = computed(() => {
    const map = new Map<string, IAvailabilitySlot[]>();

    // 1) timed po filtrach (GM/Recepcja)
    for (const s of this.filteredTimedSlots()) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }

    // 2) external-only dokładamy zawsze (do znaczka dnia)
    for (const s of this.slotsAll()) {
      if (
        s.workType === 'external_event' &&
        (s as any).externalEventOnly === true
      ) {
        if (!map.has(s.date)) map.set(s.date, []);
        map.get(s.date)!.push(s);
      }
    }
    return map;
  });

  // Maper godzin – OR po wszystkich osobach w danym dniu zgodnie z aktywnym filtrem
  readonly mapDailyToHourlyAvailability =
    () => (slots: IAvailabilitySlot[]) => {
      const blocks = Array(this.blockCount).fill(false);
      for (const s of slots) {
        if (!this.isTimed(s)) continue;
        for (let h = s.fromHour; h < s.toHour; h++) {
          const idx = h - TimeSlots.noonStart;
          if (idx >= 0 && idx < blocks.length) blocks[idx] = true;
        }
      }
      return blocks; // true => jest przynajmniej jedna osoba; false => nikt
    };

  readonly mapDailyToDayFlags = () => (items: unknown[]) => {
    if (!Array.isArray(items)) return {};

    const hasExternalOnly = items.some((it: unknown) => {
      const s = it as Partial<IAvailabilitySlot> & {
        externalEventOnly?: boolean;
      };
      return s?.workType === 'external_event' && s?.externalEventOnly === true;
    });

    return hasExternalOnly ? { externalOnly: true } : {};
  };

  // Szczegóły dnia
  private readonly slotsForSelectedDay = computed(() =>
    this.selectedDate()
      ? this.slotsAll().filter((s) => s.date === this.selectedDate())
      : []
  );

  readonly gmSlotsForDay = computed(
    () =>
      this.slotsForSelectedDay().filter(
        (s) => s.workType === 'gm' && this.isTimed(s)
      ) as TimedSlot[]
  );
  readonly receptionSlotsForDay = computed(
    () =>
      this.slotsForSelectedDay().filter(
        (s) => s.workType === 'reception' && this.isTimed(s)
      ) as TimedSlot[]
  );
  readonly externalOnlyForDay = computed(() =>
    this.slotsForSelectedDay().filter(
      (s) =>
        s.workType === 'external_event' && (s as any).externalEventOnly === true
    )
  );

  ngOnInit(): void {
    this.fetch(); // start
    // Dalsze dociąganie robimy na (monthChanged) z kalendarza – to unika NG0203.
  }

  fetch() {
    const dates = this.visibleDates();
    this.svc
      .getAvailabilityForDates(dates, ['gm', 'reception', 'external_event'])
      .subscribe({
        next: (slots) => {
          this.slotsAll.set(slots);
          const ids = Array.from(new Set(slots.map((s) => s.userId)));
          this.svc.getUsersByIds(ids).subscribe((users) => {
            const map = new Map<string, IUser>();
            for (const u of users) map.set(u.id, u);
            this.usersMap.set(map);
          });
        },
        error: (e) => {
          this.slotsAll.set([]);
          this.usersMap.set(new Map());
          console.error('Błąd pobierania dostępności (overview):', e);
        },
      });
  }

  // Obsługa kalendarza
  onMonthChanged() {
    this.fetch();
  }

  onDateSelected(date: string | null) {
    this.selectedDate.set(date);
  }

  changeDay(direction: DayDirection) {
    const current = this.selectedDate();
    if (!current) return;

    const prev = parseISO(current);
    const next = addDays(prev, direction);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = endOfMonth(addMonths(today, 1));

    if (next < today || next > maxDate) return;

    const nextStr = format(next, 'yyyy-MM-dd');
    this.selectedDate.set(nextStr);

    if (!this.visibleDates().includes(nextStr)) this.fetch();
    if (!isSameMonth(prev, next)) this.calendar()?.setMonthView(next);
  }

  // UI helpers
  displayName(u: IUser | undefined): string {
    if (!u) return 'Użytkownik';
    if (u.useNickname && u.nickname) return u.nickname;
    return u.firstName || u.email || 'Użytkownik';
  }

  userById(id: string): IUser | undefined {
    return this.usersMap().get(id);
  }

  formatRange(s: TimedSlot): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(s.fromHour)}:00 – ${pad(s.toHour)}:00`;
  }

  onToggleShowGm(evt: Event) {
    const input = evt.target as HTMLInputElement | null;
    const checked = !!input?.checked;
    if (!checked && !this.showReception()) this.showReception.set(true);
    this.showGm.set(checked);
  }

  onToggleShowReception(evt: Event) {
    const input = evt.target as HTMLInputElement | null;
    const checked = !!input?.checked;
    if (!checked && !this.showGm()) this.showGm.set(true);
    this.showReception.set(checked);
  }
}
