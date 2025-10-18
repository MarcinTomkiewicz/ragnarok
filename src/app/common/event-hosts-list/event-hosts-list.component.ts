import { CommonModule } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  DestroyRef,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, fromEvent, of, Subject } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';

import { EventHostsService } from '../../core/services/event-hosts/event-hosts.service';
import { HostCardVM, IEventHost } from '../../core/interfaces/i-event-host';
import { IRPGSystem } from '../../core/interfaces/i-rpg-system';
import { IGmData } from '../../core/interfaces/i-gm-profile';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { GmStyleTagLabels } from '../../core/enums/gm-styles';
import { GmDirectoryService } from '../../auth/core/services/gm/gm-directory/gm-directory.service';

import { GmDetailsModalComponent } from '../gm-details-modal/gm-details-modal.component';
import { EventSessionDetailsModalComponent } from '../event-session-details-modal/event-session-details-modal.component';

import { BackendService } from '../../core/services/backend/backend.service';
import { IContentTrigger } from '../../core/interfaces/i-content-trigger';
import { FilterOperator } from '../../core/enums/filterOperator';
import { AttractionKind, HostSignupScope } from '../../core/enums/events';

import { SessionSignupButtonComponent } from '../session-signup-button/session-signup-button.component';
import { IUser } from '../../core/interfaces/i-user';
import { ParticipantsListComponent } from '../event-participants-list/event-participants-list.component';

import { register } from 'swiper/element/bundle';
import { PlatformService } from '../../core/services/platform/platform.service';
import { EventFull, EventRoomPlan } from '../../core/interfaces/i-events';
import {
  RoomPurpose,
  RoomPurposeLabel,
  RoomScheduleKind,
} from '../../core/enums/event-rooms';
import { TimeUtil } from '../../core/services/event/time.util';
import { roomsOrder } from '../../core/utils/roomsOrder';

const SMALL_BP = 1024;

@Component({
  selector: 'app-event-hosts-list',
  standalone: true,
  imports: [
    CommonModule,
    NgbModalModule,
    SessionSignupButtonComponent,
    ParticipantsListComponent,
  ],
  templateUrl: './event-hosts-list.component.html',
  styleUrls: ['./event-hosts-list.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EventHostsListComponent implements OnDestroy {
  /** Główny input – pełny event */
  event = input.required<EventFull>();
  /** Data wystąpienia */
  dateIso = input.required<string>();
  /** Użytkownik */
  currentUser = input<IUser | null>(null);
  /** Pokaż przyciski zapisów */
  showSignup = input<boolean>(true);
  /** Filtr sali (z chipa) */
  filterRoom = input<string | null>(null);

  // DI
  private readonly hosts = inject(EventHostsService);
  private readonly images = inject(ImageStorageService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly backend = inject(BackendService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platform = inject(PlatformService);
  private readonly timeUtil = inject(TimeUtil);

  // UI
  readonly loadingSig = signal(true);
  readonly errorSig = signal<string | null>(null);
  readonly itemsSig = signal<HostCardVM[]>([]);

  readonly HostRole = HostSignupScope;
  readonly GmStyleTagLabels = GmStyleTagLabels;

  private readonly destroy$ = new Subject<void>();
  readonly isSmallScreen = signal<boolean>(false);

  // refresh keys (dla list uczestników)
  private readonly refreshByHost = signal<Map<string, number>>(new Map());
  getRefreshKey(hostId: string): number {
    return this.refreshByHost().get(hostId) ?? 0;
  }
  private bumpRefresh(hostId: string) {
    const next = new Map(this.refreshByHost());
    next.set(hostId, (next.get(hostId) ?? 0) + 1);
    this.refreshByHost.set(next);
  }
  onSessionSigned(hostId: string) {
    this.bumpRefresh(hostId);
    this.scheduleEqualize();
  }

  // Triggery -> etykiety (do top 3)
  private readonly triggersMap$ = this.backend
    .getAll<IContentTrigger>(
      'content_triggers',
      'label',
      'asc',
      { filters: { is_active: { operator: FilterOperator.EQ, value: true } } } as any,
      undefined,
      undefined,
      false
    )
    .pipe(
      map((rows) => new Map<string, string>((rows ?? []).map((t) => [t.slug, t.label]))),
      catchError(() => of(new Map<string, string>())),
      shareReplay(1)
    );

  // Proste aliasy na dane eventu
  readonly eventId = computed(() => this.event().id);
  readonly eventStart = computed(() => this.event().startTime);
  readonly eventEnd = computed(() => this.event().endTime);
  readonly eventCapacity = computed(() => this.event().wholeCapacity ?? null);
  readonly attractionType = computed(() => this.event().attractionType);

  // Plan dla bieżącej sali (Composite)
  readonly roomPlan = computed<EventRoomPlan | null>(() => {
    const ev = this.event();
    const r = this.filterRoom();
    if (!r) return null;
    return ev.roomPlans?.find((p) => p.roomName === r) ?? null;
  });

  // Helpers czasu
  private toMin(hhmm?: string | null): number {
    const s = this.timeUtil.hhmm(hhmm ?? '');
    if (!s) return Number.POSITIVE_INFINITY;
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  }

  // --- FULLSPAN sekcja (dla templatki)
  readonly isFullSpan = computed<boolean>(
    () => this.roomPlan()?.scheduleKind === RoomScheduleKind.FullSpan
  );

  readonly fullSpanAllowsSignup = computed<boolean>(() => {
    const plan = this.roomPlan();
    return !!plan?.requiresParticipants;
  });

  readonly fullSpanCapacity = computed<number | null>(() => {
    const plan = this.roomPlan();
    if (!plan) return null;
    const raw = plan.sessionCapacity ?? this.eventCapacity();
    return raw == null ? null : Number(raw);
  });

  readonly fullSpanTitle = computed<string>(() => {
    const plan = this.roomPlan();
    if (!plan) return '';
    const custom = plan.customTitle?.trim?.();
    if (custom) return custom;
    return RoomPurposeLabel[plan.purpose] ?? 'Blok';
  });

  readonly fullSpanRequiresHosts = computed<boolean>(() => {
    const plan = this.roomPlan();
    return !!plan?.requiresHosts;
  });

  readonly fullSpanImage = computed<string | null>(() => {
    const first = this.filteredItemsRaw().find((i) => !!i.imageUrl);
    return first?.imageUrl ?? null;
  });

  readonly fullSpanDescription = computed<string | null>(() => {
    const withDesc = this.filteredItemsRaw().find((i) => (i.description ?? '').trim().length > 0);
    return withDesc?.description?.trim() ?? null;
  });

  readonly fullSpanLeads = computed(() =>
    (this.filteredItemsRaw() ?? []).map((h) => ({
      id: h.id,
      clickable: h.role === HostSignupScope.Staff,
      display: h.displayName || (h.role === HostSignupScope.Staff ? 'Prowadzący (staff)' : 'Prowadzący'),
      host: h,
    }))
  );

  // Czy karta jest placeholderem (brak obrazka)
  isPlaceholder(h: HostCardVM) {
    return !h.imageUrl;
  }

  // Typ atrakcji dla karty — tylko z configu (slot → plan → event)
  private getPurpose(h: HostCardVM): RoomPurpose | undefined {
    const plan = this.roomPlan();
    if (plan) {
      if (plan.scheduleKind === RoomScheduleKind.Schedule && h.slotStartTime) {
        const st = this.timeUtil.hhmm(h.slotStartTime);
        const slot = (plan.slots ?? []).find((s) => this.timeUtil.hhmm(s.startTime) === st);
        return slot?.purpose ?? plan.purpose;
      }
      return plan.purpose;
    }
    // non-composite event
    switch (this.attractionType()) {
      case AttractionKind.Session: return RoomPurpose.Session;
      case AttractionKind.Discussion: return RoomPurpose.Discussion;
      case AttractionKind.Entertainment: return RoomPurpose.Entertainment;
      default: return undefined;
    }
  }

  // Templatka: system pokazujemy tylko jeśli rodzaj = Session
  isSessionCard(h: HostCardVM) {
    return this.getPurpose(h) === RoomPurpose.Session;
  }

  isVirtual(h: HostCardVM) {
    return h.isVirtual === true;
  }

  listDisplayName(h: HostCardVM) {
    return (h.displayName ?? 'Czeka na zgłoszenia').trim();
  }

  // Etykieta/kolor rodzaju
  readonly kindLabel = (h: HostCardVM) => {
    const p = this.getPurpose(h);
    return p ? RoomPurposeLabel[p] : '';
  };
  readonly kindClass = (h: HostCardVM) => {
    const p = this.getPurpose(h);
    if (p === RoomPurpose.Session) return 'violet';
    if (p === RoomPurpose.Entertainment) return 'golden';
    if (p === RoomPurpose.Discussion) return 'amber';
    return '';
  };

  requiresHostsFor(h: HostCardVM): boolean {
    const plan = this.roomPlan();
    if (plan?.scheduleKind === RoomScheduleKind.Schedule) {
      const st = h.slotStartTime ? this.timeUtil.hhmm(h.slotStartTime) : null;
      const slot = (plan.slots ?? []).find((s) => s.startTime ? this.timeUtil.hhmm(s.startTime) === st : false);
      const v = slot?.requiresHosts ?? plan.requiresHosts ?? null;
      return v === true;
    }
    if (plan?.scheduleKind === RoomScheduleKind.Interval || plan?.scheduleKind === RoomScheduleKind.FullSpan) {
      return !!plan.requiresHosts;
    }
    // non-composite — domyślnie pokazuj (możesz tu wymusić false, jeśli dla prostych eventów nie ma prowadzących)
    return true;
  }

  // Godziny do etykiety
  timeRangeLabel(h: HostCardVM): string {
    const st = this.timeUtil.hhmm(h.slotStartTime ?? (null as any));
    if (!st) return '—';

    const plan = this.roomPlan();
    const evEnd = this.timeUtil.hhmm(this.eventEnd() ?? '');
    const evStart = this.timeUtil.hhmm(this.eventStart() ?? '');

    if (plan?.scheduleKind === RoomScheduleKind.Schedule) {
      const slot = (plan.slots ?? []).find((s) => this.timeUtil.hhmm(s.startTime) === st);
      if (slot) {
        const end = this.timeUtil.hhmm(slot.endTime);
        return `${st} - ${end || evEnd || '—'}`;
      }
    }

    if (plan?.scheduleKind === RoomScheduleKind.Interval) {
      const ih = Number(plan.intervalHours ?? 0);
      const im = Number((plan as any).intervalMinutes ?? (plan as any).slotDurationMinutes ?? 0);
      const dur = (isFinite(ih) ? ih : 0) * 60 + (isFinite(im) ? im : 0);
      if (dur > 0) {
        const [H, M] = st.split(':').map((x) => Number(x) || 0);
        const endMin = H * 60 + M + dur;
        const endH = Math.floor((endMin % (24 * 60)) / 60);
        const endM = endMin % 60;
        return `${st} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      }
      return `${st} - ${evEnd || '—'}`;
    }

    if (plan?.scheduleKind === RoomScheduleKind.FullSpan) {
      return `${evStart || '00:00'} - ${evEnd || '23:59'}`;
    }

    if (evStart || evEnd) return `${st} - ${evEnd || '—'}`;
    return st;
  }

  // Dane -> listy bazowe (realne), posortowane po salach i czasie
  private readonly filteredItemsRaw = computed<HostCardVM[]>(() => {
    const items = this.itemsSig() ?? [];
    const room = this.filterRoom();

    if (room) {
      const chosen = items.filter((h) => h.roomName === room);
      chosen.sort((a, b) => this.toMin(a.slotStartTime) - this.toMin(b.slotStartTime));
      return chosen;
    }

    const roomsInData = Array.from(new Set(items.map((h) => (h.roomName ?? '').trim()).filter(Boolean))) as string[];
    const ordered = roomsOrder(roomsInData);
    const idxMap = new Map(ordered.map((name, i) => [name.toLowerCase(), i]));

    const rank = (name?: string | null) => {
      const key = (name ?? '').trim().toLowerCase();
      const idx = idxMap.get(key);
      return idx == null ? 999 : idx;
    };

    const chosen = items.slice();
    chosen.sort((a, b) => {
      const ra = rank(a.roomName);
      const rb = rank(b.roomName);
      if (ra !== rb) return ra - rb;

      const ta = this.toMin(a.slotStartTime);
      const tb = this.toMin(b.slotStartTime);
      if (ta !== tb) return ta - tb;

      return (a.title || '').localeCompare(b.title || '');
    });

    return chosen;
  });

  readonly filteredItems = computed<HostCardVM[]>(() => this.filteredItemsRaw());

  // ---------- Wirtualne karty: SCHEDULE ----------
  private makeVirtualForSlot(
    room: string,
    slot: NonNullable<EventRoomPlan['slots']>[number],
    plan: EventRoomPlan
  ): HostCardVM {
    const purpose = slot.purpose ?? plan.purpose;
    const customTitle = slot.customTitle?.trim?.() || plan.customTitle?.trim?.();
    const baseTitle = customTitle || (purpose ? RoomPurposeLabel[purpose] : 'Blok');
    const sessionCapacity = slot.sessionCapacity ?? plan.sessionCapacity ?? null;
    const startHH = this.timeUtil.hhmm(slot.startTime);

    return {
      id: `${this.eventId()}::${this.dateIso()}::${room}::${startHH}`,
      eventId: this.eventId(),
      occurrenceDate: this.dateIso(),
      roomName: room,
      slotStartTime: this.timeUtil.hhmmss(startHH),
      hostUserId: '',
      role: HostSignupScope.Any,
      title: baseTitle,
      systemId: null,
      description: null,
      triggers: [],
      playstyleTags: [],
      imagePath: null,
      sessionCapacity,
      system: null,
      imageUrl: null,
      displayName: null,
      gm: null,
      triggersTop: [],
      triggersExtraCount: 0,
      isVirtual: true,
      purpose,
    } as HostCardVM;
  }

  readonly scheduleSlides = computed<HostCardVM[]>(() => {
    const plan = this.roomPlan();
    const room = this.filterRoom();
    if (!plan || plan.scheduleKind !== RoomScheduleKind.Schedule || !room) return [];

    const slots = (plan.slots ?? [])
      .slice()
      .sort((a, b) => this.toMin(a.startTime) - this.toMin(b.startTime));

    const byStart = new Map<string, HostCardVM>();
    this.filteredItemsRaw().forEach((h) =>
      byStart.set(this.timeUtil.hhmm(h.slotStartTime ?? ''), h)
    );

    return slots.map((s) => {
      const startHH = this.timeUtil.hhmm(s.startTime);
      return byStart.get(startHH) ?? this.makeVirtualForSlot(room, s, plan);
    });
  });

  // ---------- Wirtualne karty: INTERVAL ----------
  private buildIntervalStarts(plan: EventRoomPlan): string[] {
    const startHH = this.timeUtil.hhmm(this.eventStart() || '');
    const endHH = this.timeUtil.hhmm(this.eventEnd() || '');
    if (!startHH || !endHH) return [];

    const stepHours =
      Number(plan.intervalHours ?? 0) +
      Number((plan as any).intervalMinutes ?? (plan as any).slotDurationMinutes ?? 0) / 60;

    if (!(stepHours > 0)) return [];

    const totalHours = this.timeUtil.diffHours(startHH, endHH);
    const count = Math.max(0, Math.floor(totalHours / stepHours));

    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const withSec = this.timeUtil.addHours(startHH, i * stepHours); // 'HH:mm:00'
      out.push(this.timeUtil.hhmm(withSec)); // 'HH:mm'
    }
    return out;
  }

  private makeVirtualForStart(room: string, startHH: string, plan: EventRoomPlan): HostCardVM {
    const purpose = plan.purpose;
    const baseTitle = plan.customTitle?.trim?.() || (purpose ? RoomPurposeLabel[purpose] : 'Blok');
    const sessionCapacity = plan.sessionCapacity ?? null;

    return {
      id: `${this.eventId()}::${this.dateIso()}::${room}::${startHH}`,
      eventId: this.eventId(),
      occurrenceDate: this.dateIso(),
      roomName: room,
      slotStartTime: this.timeUtil.hhmmss(startHH),
      hostUserId: '',
      role: HostSignupScope.Any,
      title: baseTitle,
      systemId: null,
      description: null,
      triggers: [],
      playstyleTags: [],
      imagePath: null,
      sessionCapacity,
      system: null,
      imageUrl: null,
      displayName: null,
      gm: null,
      triggersTop: [],
      triggersExtraCount: 0,
      isVirtual: true,
      purpose,
    } as HostCardVM;
  }

  readonly intervalSlides = computed<HostCardVM[]>(() => {
    const plan = this.roomPlan();
    const room = this.filterRoom();
    if (!plan || plan.scheduleKind !== RoomScheduleKind.Interval || !room) return [];

    const byStart = new Map<string, HostCardVM>();
    this.filteredItems().forEach((h) =>
      byStart.set(this.timeUtil.hhmm(h.slotStartTime ?? ''), h)
    );

    const starts = this.buildIntervalStarts(plan);
    return starts.map((startHH) => byStart.get(startHH) ?? this.makeVirtualForStart(room, startHH, plan));
  });

  // Co renderujemy
  readonly slidesForDisplay = computed<HostCardVM[]>(() => {
    const plan = this.roomPlan();
    if (plan?.scheduleKind === RoomScheduleKind.Schedule) return this.scheduleSlides();
    if (plan?.scheduleKind === RoomScheduleKind.Interval) return this.intervalSlides();
    return this.filteredItems();
  });

  constructor() {
    // Swiper
    if (this.platform.isBrowser) {
      register();
      afterNextRender(() => {
        const swiperEl = document.querySelector('swiper-container');
        swiperEl?.swiper?.updateAutoHeight?.();
      });
      const win = this.platform.getWindow();
      if (win) {
        fromEvent(win, 'resize')
          .pipe(
            startWith(null),
            map(() => win.innerWidth <= SMALL_BP),
            takeUntil(this.destroy$)
          )
          .subscribe((isSm) => {
            this.isSmallScreen.set(isSm);
            if (isSm) this.scheduleEqualize();
          });
      }
    }

    // Ładowanie hostów + wzbogacenie (system, obrazek, GM, triggery)
    combineLatest([toObservable(this.eventId), toObservable(this.dateIso)])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(([id, date]) => !!id && !!date),
        distinctUntilChanged(([aId, aDate], [bId, bDate]) => aId === bId && aDate === bDate),
        tap(() => {
          this.loadingSig.set(true);
          this.errorSig.set(null);
          this.itemsSig.set([]);
        }),
        switchMap(([id, date]) =>
          combineLatest([
            this.hosts.getHostsWithSystems(id, date).pipe(catchError(() => of([]))),
            this.triggersMap$,
          ]).pipe(
            map(([rows, tmap]) => {
              const base: HostCardVM[] = (
                rows as (IEventHost & { systems?: IRPGSystem | null })[]
              ).map((r) => {
                const system: IRPGSystem | null = r.systemId ? (r as any).systems ?? null : null;
                const imageUrl = r.imagePath ? this.images.getOptimizedPublicUrl(r.imagePath, 768, 512) : null;
                const slugs: string[] = (r.triggers ?? []) as string[];
                const topLabels = slugs.slice(0, 3).map((s) => tmap.get(s) ?? s);
                return {
                  ...r,
                  system,
                  imageUrl,
                  displayName: null,
                  gm: null,
                  triggersTop: topLabels,
                  triggersExtraCount: Math.max(0, slugs.length - 3),
                } as HostCardVM;
              });
              const allUserIds = Array.from(new Set(base.map((h) => h.hostUserId).filter(Boolean)));
              return { base, allUserIds };
            }),
            switchMap(({ base, allUserIds }) => {
              const gm$ = allUserIds.length
                ? forkJoin(allUserIds.map((id) => this.gmDirectory.getGmById(id).pipe(catchError(() => of(null)))))
                : of([]);
              const users$ = allUserIds.length
                ? this.backend.getByIds<IUser>('users', allUserIds)
                : of([]);
              return combineLatest([gm$, users$]).pipe(
                map(([gms, users]) => {
                  const gmById = new Map<string, IGmData>(
                    gms.filter((gm): gm is IGmData => !!gm && !!gm.gmProfileId).map((gm) => [gm.userId, gm])
                  );
                  const userById = new Map<string, IUser>(users.map((u) => [u.id, u]));
                  const nameFromUser = (u?: IUser): string => {
                    if (!u) return 'Użytkownik';
                    if (u.useNickname && u.nickname?.trim()) return u.nickname.trim();
                    return u.firstName?.trim() || u.email || 'Użytkownik';
                  };
                  return base.map((h) => {
                    const gm = gmById.get(h.hostUserId) ?? null;
                    const u = userById.get(h.hostUserId);
                    const displayName = gm ? this.gmDirectory.gmDisplayName(gm) : nameFromUser(u);
                    return { ...h, gm, displayName } as HostCardVM;
                  });
                })
              );
            }),
            catchError(() => {
              this.errorSig.set('Nie udało się pobrać listy prowadzących.');
              return of([] as HostCardVM[]);
            }),
            finalize(() => this.loadingSig.set(false))
          )
        )
      )
      .subscribe((items) => {
        this.itemsSig.set(items);
        this.scheduleEqualize();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private scheduleEqualize() {
    if (!this.platform.isBrowser || !this.isSmallScreen()) return;
    setTimeout(() => this.equalizeSwiperCardHeights(), 0);
    setTimeout(() => this.equalizeSwiperCardHeights(), 250);
  }

  private equalizeSwiperCardHeights() {
    if (!this.platform.isBrowser || !this.isSmallScreen()) return;
    const container = document.querySelector<HTMLElement>('.mg-swiper');
    if (!container) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.session-card.is-swiper'));
    if (!cards.length) return;
    container.style.removeProperty('--session-card-height');
    cards.forEach((c) => (c.style.height = ''));
    let max = 0;
    cards.forEach((c) => (max = Math.max(max, c.offsetHeight)));
    if (max > 0) {
      container.style.setProperty('--session-card-height', `${max}px`);
      cards.forEach((c) => (c.style.height = `var(--session-card-height)`));
    }
  }

  /** Limit na kartę: slot → plan → event (bez innych fallbacków). */
  hostCapacity(h: HostCardVM): number | null {
    if (h.sessionCapacity != null) return Number(h.sessionCapacity);

    const plan = this.roomPlan();
    if (plan) {
      if (plan.scheduleKind === RoomScheduleKind.Schedule) {
        const st = this.timeUtil.hhmm(h.slotStartTime ?? ('' as any));
        const slot = (plan.slots ?? []).find((s) => this.timeUtil.hhmm(s.startTime) === st);
        const slotCap = (slot as any)?.sessionCapacity ?? (slot as any)?.session_capacity ?? null;
        if (slotCap != null) return Number(slotCap);

        const planCap = (plan as any)?.sessionCapacity ?? (plan as any)?.session_capacity ?? null;
        if (planCap != null) return Number(planCap);
      }

      if (plan.scheduleKind === RoomScheduleKind.Interval || plan.scheduleKind === RoomScheduleKind.FullSpan) {
        const planCap = (plan as any)?.sessionCapacity ?? (plan as any)?.session_capacity ?? null;
        if (planCap != null) return Number(planCap);
      }
    }

    const fallback = this.eventCapacity();
    return fallback == null ? null : Number(fallback);
  }

  openDetails(host: HostCardVM) {
    if (this.isVirtual(host)) return; // wirtualnych nie klikamy
    const ref = this.modal.open(EventSessionDetailsModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      scrollable: true,
    });
    ref.componentInstance.host = host;
    ref.componentInstance.hostDisplayName = host.displayName ?? 'Prowadzący';
    if (host.role === HostSignupScope.Staff && host.gm) {
      ref.componentInstance.gm = host.gm;
    }
  }

  openGmProfile(host: HostCardVM, event: MouseEvent) {
    event.stopPropagation();
    if (this.isVirtual(host)) return;
    if (host.role !== HostSignupScope.Staff) return;
    if (host.gm) {
      const ref = this.modal.open(GmDetailsModalComponent, {
        size: 'lg',
        centered: true,
        scrollable: true,
      });
      ref.componentInstance.gm = host.gm;
      return;
    }
    this.gmDirectory
      .getGmById(host.hostUserId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((gm) => {
        if (!gm) return;
        const ref = this.modal.open(GmDetailsModalComponent, {
          size: 'lg',
          centered: true,
          scrollable: true,
        });
        ref.componentInstance.gm = gm;
      });
  }

  log(data: any): void {
    console.log(data);
  }
}
