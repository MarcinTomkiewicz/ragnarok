import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  NgbAccordionModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, map, of, startWith, switchMap } from 'rxjs';

import {
  AttractionKind,
  AttractionKindLabel,
  HostSignupScope,
  HostSignupScopeLabel,
} from '../../../core/enums/events';
import { EventFull, EventRoomPlan } from '../../../core/interfaces/i-events';
import { EventService } from '../../../core/services/event/event.service';
import { formatYmdLocal } from '../../../core/utils/weekday-options';

import { HostSignupLevel, RoomScheduleKind } from '../../../core/enums/event-rooms';
import { CoworkerRoles } from '../../../core/enums/roles';
import { AuthService } from '../../../core/services/auth/auth.service';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';

// NEW: wykorzystamy SlotsUtil, który już liczy requiresHosts/hostScope kaskadowo
import { SlotsUtil, SlotDef } from '../../../core/services/event/slots.util';

type ViewMode = 'tabs' | 'accordion';

type RoomUi =
  | { mode: 'none'; roomName: string } // brak wymogu prowadzących
  | { mode: 'full'; roomName: string; slot: SlotDef } // cały przedział => jeden przycisk
  | { mode: 'slots'; roomName: string; slots: SlotDef[] }; // wiele slotów do wyboru

@Component({
  selector: 'app-events-admin-list',
  standalone: true,
  imports: [CommonModule, NgbAccordionModule, NgbTooltipModule],
  templateUrl: './events-admin-list.component.html',
  styleUrls: ['./events-admin-list.component.scss'],
})
export class EventsAdminListComponent {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly slots = inject(SlotsUtil);

  AttractionKind = AttractionKind;
  AttractionKindLabel = AttractionKindLabel;
  HostSignupScopeLabel = HostSignupScopeLabel;
  HostSignupLevel = HostSignupLevel;
  RoomScheduleKind = RoomScheduleKind;

  // ---- USER / ADMIN (sygnały z AuthService) ----

  readonly user = computed(() => this.auth.user());
  readonly userId = computed(() => this.user()?.id ?? '');
  readonly isAdmin = computed(() =>
    hasMinimumCoworkerRole(this.user(), CoworkerRoles.Reception)
  );

  readonly viewMode = signal<ViewMode>('tabs');
  setViewMode(m: ViewMode) {
    if (this.viewMode() !== m) this.viewMode.set(m);
  }

  readonly eventsSig = toSignal(
    this.eventService
      .getAllActive()
      .pipe(map((list) => list.sort((a, b) => a.name.localeCompare(b.name)))),
    { initialValue: [] as EventFull[] }
  );

  // >>> FILTR WIDOCZNOŚCI <<<

  private canSeeEvent = (ev: EventFull): boolean => {
    const u = this.user();
    if (hasMinimumCoworkerRole(u, CoworkerRoles.Reception)) return true;
    if (ev.hostSignup === HostSignupScope.Staff) {
      return hasMinimumCoworkerRole(u, CoworkerRoles.Gm);
    }
    return hasMinimumCoworkerRole(u, CoworkerRoles.User);
  };

  /** Czy to wydarzenie „efektywnie” wymaga hostów? */
  private eventRequiresHosts(ev: EventFull): boolean {
    if (ev.attractionType === AttractionKind.Composite) {
      const plans = ev.roomPlans ?? [];
      if (!plans.length) return false;

      // Jeżeli którakolwiek salka/slot wymaga hostów, to event pokazujemy
      for (const p of plans) {
        const slots = this.slots.generateSlotsForRoom(ev, p);
        if (slots.some((s) => s.requiresHosts)) return true;
      }
      return false;
    }
    return !!ev.requiresHosts;
  }

  private eventHasFutureOccurrence(ev: EventFull): boolean {
    if (ev.singleDate) return this.isFutureDate(ev.singleDate);

    const { thisFrom, nextTo } = this.occRange();
    const occ = this.eventService.listOccurrencesFE(ev, thisFrom, nextTo);
    return occ.some((d) => this.isFutureDate(d));
  }

  readonly visibleEvents = computed<EventFull[]>(() =>
    (this.eventsSig() ?? [])
      .filter((ev) => this.eventHasFutureOccurrence(ev))
      .filter((ev) => this.eventRequiresHosts(ev) && this.canSeeEvent(ev))
  );

  private readonly selectedSlug = signal<string | null>(null);
  readonly selected = computed<EventFull | null>(() => {
    const list = this.visibleEvents();
    if (!list.length) return null;
    const slug = this.selectedSlug() ?? list[0]?.slug ?? null;
    return list.find((e) => e.slug === slug) ?? null;
  });

  pickEvent(slug: string) {
    this.selectedSlug.set(slug);
  }

  // ---- ZAKRES DAT ----
  private rangeFromTo() {
    const now = new Date();
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastThis = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const firstNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastNext = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return {
      thisFrom: formatYmdLocal(firstThis),
      thisTo: formatYmdLocal(lastThis),
      nextFrom: formatYmdLocal(firstNext),
      nextTo: formatYmdLocal(lastNext),
    };
  }
  readonly occRange = computed(() => this.rangeFromTo());

  // ---- TERMINY (tabs) ----
  readonly occurrencesThisMonth = computed<string[]>(() => {
    const ev = this.selected();
    if (!ev) return [];
    const { thisFrom, thisTo } = this.occRange();
    return this.eventService
      .listOccurrencesFE(ev, thisFrom, thisTo)
      .filter((d) => this.isFutureDate(d));
  });

  readonly occurrencesNextMonth = computed<string[]>(() => {
    const ev = this.selected();
    if (!ev) return [];
    const { nextFrom, nextTo } = this.occRange();
    return this.eventService
      .listOccurrencesFE(ev, nextFrom, nextTo)
      .filter((d) => this.isFutureDate(d));
  });

  // ---- PEŁNOŚĆ: eventId -> date -> {count, capacity, isFull} ----
  readonly fullnessAll = toSignal(
    combineLatest([
      toObservable(this.visibleEvents),
      toObservable(this.occRange),
    ]).pipe(
      switchMap(([events, r]) =>
        events.length
          ? this.eventService.getHostFullnessForMany(
              events,
              r.thisFrom,
              r.nextTo
            )
          : of(
              {} as Record<
                string,
                Record<
                  string,
                  { count: number; capacity: number; isFull: boolean }
                >
              >
            )
      ),
      startWith(
        {} as Record<
          string,
          Record<string, { count: number; capacity: number; isFull: boolean }>
        >
      )
    ),
    {
      initialValue: {} as Record<
        string,
        Record<string, { count: number; capacity: number; isFull: boolean }>
      >,
    }
  );

  readonly myHostDatesAll = toSignal(
    combineLatest([
      toObservable(this.userId),
      toObservable(this.visibleEvents),
      toObservable(this.occRange),
    ]).pipe(
      switchMap(([uid, events, r]) =>
        uid && events.length
          ? this.eventService.getHostDataForMany(
              uid,
              events.map((e) => e.id),
              r.thisFrom,
              r.nextTo
            )
          : of({} as Record<string, Record<string, true>>)
      ),
      startWith({} as Record<string, Record<string, true>>)
    ),
    { initialValue: {} as Record<string, Record<string, true>> }
  );

  // ---- LOGIKA BLOKADY ----
  public isFull(evId: string, dateIso: string): boolean {
    return !!this.fullnessAll()[evId]?.[dateIso]?.isFull;
  }
  private isMine(evId: string, dateIso: string): boolean {
    return !!this.myHostDatesAll()[evId]?.[dateIso];
  }
  canClick(ev: EventFull, dateIso: string): boolean {
    if (this.isAdmin()) return true;
    if (this.isMine(ev.id, dateIso)) return true;
    return !this.isFull(ev.id, dateIso);
  }
  private readonly todayYmd = computed(() => formatYmdLocal(new Date()));

  private isFutureDate = (dateIso: string): boolean => {
    return dateIso > this.todayYmd();
  };

  // ---- POMOCNICZE: Composite ----
  isComposite(ev: EventFull | null): boolean {
    return (
      !!ev && ev.attractionType === AttractionKind.Composite && !!ev.singleDate
    );
  }

  /** roomName -> plan (z tablicy roomPlans) */
  private roomPlanMap(ev: EventFull): Record<string, EventRoomPlan> {
    const out: Record<string, EventRoomPlan> = {};
    (ev.roomPlans ?? []).forEach((p) => (out[p.roomName] = p));
    return out;
  }

  /** Wylicz model UI dla salki (none/full/slots) na podstawie wygenerowanych slotów */
 private buildRoomUi(ev: EventFull, roomName: string): RoomUi {
  const plan = this.roomPlanMap(ev)[roomName];
  if (!plan) return { mode: 'none', roomName };

  // ⬇⬇ KLUCZOWY GUARD: FullSpan/Interval bez wymogu = brak przycisku
  if (
    (plan.scheduleKind === this.RoomScheduleKind.FullSpan ||
     plan.scheduleKind === this.RoomScheduleKind.Interval) &&
    (plan as any).requiresHosts !== true
  ) {
    return { mode: 'none', roomName };
  }

  const allSlots = this.slots.generateSlotsForRoom(ev, plan);
  const req = allSlots.filter((s: any) => s.requiresHosts === true);

  if (req.length === 0) return { mode: 'none', roomName };

  const isFullSpan =
    req.length === 1 &&
    req[0].startTime.slice(0, 5) === ev.startTime.slice(0, 5) &&
    req[0].endTime.slice(0, 5) === ev.endTime.slice(0, 5);

  if (isFullSpan) return { mode: 'full', roomName, slot: req[0] };
  return { mode: 'slots', roomName, slots: req };
}

  /** Etykieta granularności dla kafelka salki */
  roomGranularityLabel(ev: EventFull, roomName: string): string {
    const ui = this.buildRoomUi(ev, roomName);
    if (ui.mode === 'none') return 'Brak zgłoszeń';
    if (ui.mode === 'full') return 'Na salkę';
    return 'Na slot';
  }

  /** Zwraca model UI wszystkich salek bieżącego eventu */
  roomUiList(ev: EventFull): RoomUi[] {
    const rooms = ev.rooms ?? [];
    return rooms.map((r) => this.buildRoomUi(ev, r));
  }

  // ---- NAWIGACJA ----

  goSignup(dateIso: string) {
    const ev = this.viewMode() === 'tabs' ? this.selected() : null;
    const slug =
      ev?.slug ?? this.selectedSlug() ?? this.visibleEvents()[0]?.slug;
    if (!slug) return;
    this.router.navigate(['/auth/events', slug, 'host-signup', dateIso]);
  }

  goSignupFor(slug: string, dateIso: string) {
    if (!slug) return;
    this.router.navigate(['/auth/events', slug, 'host-signup', dateIso]);
  }

  /** Dla Composite: zgłoszenie z wybraną salką (opcjonalnie ze slotem start-end jako query) */
  goSignupRoom(roomName: string, start?: string, end?: string) {
    const ev = this.selected();
    const slug =
      ev?.slug ?? this.selectedSlug() ?? this.visibleEvents()[0]?.slug;
    if (!slug) return;

    const queryParams: Record<string, string> = { room: roomName };
    if (start && end) {
      queryParams['start'] = start.slice(0, 5); // 'HH:mm'
      queryParams['end'] = end.slice(0, 5);
    }

    this.router.navigate(['/auth/events', slug, 'host-signup'], {
      queryParams,
    });
  }

  goEdit() {
    const ev = this.viewMode() === 'tabs' ? this.selected() : null;
    const slug = ev?.slug ?? this.selectedSlug() ?? this.eventsSig()[0]?.slug;
    if (!slug) return;
    this.router.navigate(['/auth/events', slug, 'edit']);
  }

  getAttractionLabel(kind: AttractionKind): string {
    return AttractionKindLabel[kind] ?? kind;
  }
}
