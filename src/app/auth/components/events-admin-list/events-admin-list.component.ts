import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { combineLatest, of, switchMap, startWith, map } from 'rxjs';
import { EventFull } from '../../../core/interfaces/i-events';
import { EventService } from '../../../core/services/event/event.service';
import { formatYmdLocal } from '../../../core/utils/weekday-options';
import {
  AttractionKind,
  AttractionKindLabel,
  HostSignupScope,
  HostSignupScopeLabel,
} from '../../../core/enums/events';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

import { AuthService } from '../../../core/services/auth/auth.service';
import { CoworkerRoles } from '../../../core/enums/roles';
import { hasMinimumCoworkerRole } from '../../../core/utils/required-roles';

type ViewMode = 'tabs' | 'accordion';

@Component({
  selector: 'app-events-admin-list',
  standalone: true,
  imports: [CommonModule, NgbAccordionModule],
  templateUrl: './events-admin-list.component.html',
  styleUrls: ['./events-admin-list.component.scss'],
})
export class EventsAdminListComponent {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  AttractionKindLabel = AttractionKindLabel;
  HostSignupScopeLabel = HostSignupScopeLabel;

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

  // surowa lista
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
    // HostSignupScope.Any – wystarczy zalogowany (User)
    return hasMinimumCoworkerRole(u, CoworkerRoles.User);
  };

  readonly visibleEvents = computed<EventFull[]>(() =>
    (this.eventsSig() ?? []).filter(event => event.requiresHosts && this.canSeeEvent(event))
  );

  // wybór w tabsach – na bazie *visibleEvents*
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
    return this.eventService.listOccurrencesFE(ev, thisFrom, thisTo);
  });
  readonly occurrencesNextMonth = computed<string[]>(() => {
    const ev = this.selected();
    if (!ev) return [];
    const { nextFrom, nextTo } = this.occRange();
    return this.eventService.listOccurrencesFE(ev, nextFrom, nextTo);
  });

  // ---- TERMINY (accordion) – sync helper ----
  listOccurrences(ev: EventFull, which: 'this' | 'next'): string[] {
    const { thisFrom, thisTo, nextFrom, nextTo } = this.occRange();
    return which === 'this'
      ? this.eventService.listOccurrencesFE(ev, thisFrom, thisTo)
      : this.eventService.listOccurrencesFE(ev, nextFrom, nextTo);
  }

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
