import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { NgbAccordionModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, map, of, startWith, switchMap } from 'rxjs';

import {
  AttractionKind,
  AttractionKindLabel,
  HostSignupScope,
  HostSignupScopeLabel,
} from '../../../core/enums/events';

import {
  EventFull,
  EventRoomPlan,
} from '../../../core/interfaces/i-events';

import { EventService } from '../../../core/services/event/event.service';
import { formatYmdLocal } from '../../../core/utils/weekday-options';

import { HostSignupLevel, RoomScheduleKind } from '../../../core/enums/event-rooms';
import { CoworkerRoles } from '../../../core/enums/roles';
import { AuthService } from '../../../core/services/auth/auth.service';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';

import { SlotsUtil, SlotDef } from '../../../core/services/event/slots.util';
import { EventHostsService } from '../../../core/services/event-hosts/event-hosts.service';
import { IEventHost } from '../../../core/interfaces/i-event-host';

type ViewMode = 'tabs' | 'accordion';

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
  private readonly eventHosts = inject(EventHostsService);

  AttractionKind = AttractionKind;
  AttractionKindLabel = AttractionKindLabel;
  HostSignupScopeLabel = HostSignupScopeLabel;
  HostSignupLevel = HostSignupLevel;
  RoomScheduleKind = RoomScheduleKind;

  // ---- USER / ADMIN ----
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

  // ---- FILTR WIDOCZNOŚCI ----
  private canSeeEvent = (ev: EventFull): boolean => {
    const u = this.user();
    if (hasMinimumCoworkerRole(u, CoworkerRoles.Reception)) return true;
    if (ev.hostSignup === HostSignupScope.Staff) {
      return hasMinimumCoworkerRole(u, CoworkerRoles.Gm);
    }
    return hasMinimumCoworkerRole(u, CoworkerRoles.User);
  };

  /**
   * Czy event w ogóle wymaga prowadzących (żeby pokazać go na liście)?
   * DLA COMPOSITE: patrzymy na sloty, które faktycznie są slotami do zapisów MG
   * (SlotDef.requiresHosts === true po kaskadzie).
   */
  private eventRequiresHosts(ev: EventFull): boolean {
    if (ev.attractionType === AttractionKind.Composite) {
      const plans = ev.roomPlans ?? [];
      if (!plans.length) return false;

      // Czy w którejkolwiek salce jest choć jeden slot z requiresHosts = true?
      return plans.some((p) => this.slotsForRoom(ev, p).length > 0);
    }

    // dla innych typów – globalny event.requiresHosts
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
  private isFutureDate = (dateIso: string): boolean => dateIso > this.todayYmd();

  // ---- Composite helpers ----
  isComposite(ev: EventFull | null): boolean {
    return !!ev && ev.attractionType === AttractionKind.Composite && !!ev.singleDate;
  }

  /**
   * Sloty w danej sali, które REALNIE są "slotami do zapisów MG".
   * Po poprawionym SlotsUtil interpretujemy to po prostu jako:
   *   SlotDef.requiresHosts === true
   */
  slotsForRoom(ev: EventFull, plan: EventRoomPlan): SlotDef[] {
    const allSlots = this.slots.generateSlotsForRoom(ev, plan);
    return allSlots.filter((s) => s.requiresHosts);
  }

  /**
   * Label "Brak zgłoszeń" / "Na salkę" / "Na slot"
   */
  roomGranularityLabel(ev: EventFull, plan: EventRoomPlan): string {
    const hostSlots = this.slotsForRoom(ev, plan);
    if (!hostSlots.length) return 'Brak zgłoszeń';

    const schedule =
      (plan.scheduleKind ?? RoomScheduleKind.FullSpan) as RoomScheduleKind;

    if (schedule === RoomScheduleKind.FullSpan && hostSlots.length === 1) {
      return 'Na salkę';
    }
    return 'Na slot';
  }

  /**
   * Nazwy sal, które są w ev.rooms, ale nie mają zdefiniowanego EventRoomPlan.
   * (dla info/debug – zgłoszeń i tak tam nie będzie)
   */
  roomsWithoutPlan(ev: EventFull): string[] {
    const plans = ev.roomPlans ?? [];
    const plannedNames = new Set(plans.map((p) => p.roomName));
    return (ev.rooms ?? []).filter((name) => !plannedNames.has(name));
  }

  // ---- Zgłoszenia dla wybranego Composite (room/slot status) ----
  private readonly selectedCompositeSignups = toSignal(
    toObservable(this.selected).pipe(
      switchMap((ev) =>
        ev && this.isComposite(ev)
          ? this.eventHosts.getHostsWithSystems(ev.id, ev.singleDate!)
          : of([] as IEventHost[])
      ),
      startWith([] as IEventHost[])
    ),
    { initialValue: [] as IEventHost[] }
  );

  private signupsForSelectedComposite(): IEventHost[] {
    return this.selectedCompositeSignups() ?? [];
  }

  roomStatus(evId: string, date: string, roomName: string): 'free' | 'mine' | 'taken' {
    const me = this.userId();
    const list = this.signupsForSelectedComposite();
    const found = list.find(
      (s) =>
        s.eventId === evId &&
        s.occurrenceDate === date &&
        s.roomName === roomName &&
        !s.slotStartTime
    );
    if (!found) return 'free';
    return found.hostUserId === me ? 'mine' : 'taken';
  }

  slotStatus(
    evId: string,
    date: string,
    roomName: string,
    startTime: string
  ): 'free' | 'mine' | 'taken' {
    const me = this.userId();
    const hhmm = startTime.slice(0, 5);
    const list = this.signupsForSelectedComposite();
    const found = list.find(
      (s) =>
        s.eventId === evId &&
        s.occurrenceDate === date &&
        s.roomName === roomName &&
        (s.slotStartTime?.slice(0, 5) ?? '') === hhmm
    );
    if (!found) return 'free';
    return found.hostUserId === me ? 'mine' : 'taken';
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

  goSignupRoom(roomName: string, dateIso: string, start?: string, end?: string) {
    const ev = this.selected();
    const slug =
      ev?.slug ?? this.selectedSlug() ?? this.visibleEvents()[0]?.slug;
    if (!slug) return;

    const queryParams: Record<string, string> = { room: roomName };
    if (start && end) {
      queryParams['start'] = start.slice(0, 5);
      queryParams['end'] = end.slice(0, 5);
    }

    this.router.navigate(['/auth/events', slug, 'host-signup', dateIso], {
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
