import { CommonModule } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  DestroyRef,
  OnDestroy,
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
import { HostSignupScope } from '../../core/enums/events';

import { SessionSignupButtonComponent } from '../session-signup-button/session-signup-button.component';
import { IUser } from '../../core/interfaces/i-user';
import { ParticipantsListComponent } from '../event-participants-list/event-participants-list.component';

import { register } from 'swiper/element/bundle';
import { PlatformService } from '../../core/services/platform/platform.service';
import { EventRoomPlan } from '../../core/interfaces/i-events';
import { RoomScheduleKind } from '../../core/enums/event-rooms';

const SMALL_BP = 1024;

type Kind = 'SESSION' | 'DISCUSSION' | 'ENTERTAINMENT';

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
  eventId = input.required<string>();
  dateIso = input.required<string>();
  currentUser = input<IUser | null>(null);
  showSignup = input<boolean>(true);
  eventCapacity = input<number | null>(null);

  filterRoom = input<string | null>(null);
  eventStart = input<string | null>(null);
  eventEnd = input<string | null>(null);
  roomPlan = input<EventRoomPlan | null>(null);

  private readonly hosts = inject(EventHostsService);
  private readonly images = inject(ImageStorageService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly backend = inject(BackendService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platform = inject(PlatformService);

  readonly loadingSig = signal(true);
  readonly errorSig = signal<string | null>(null);
  readonly itemsSig = signal<HostCardVM[]>([]);
  readonly hasItems = computed(() => (this.itemsSig()?.length ?? 0) > 0);

  readonly HostRole = HostSignupScope;
  readonly GmStyleTagLabels = GmStyleTagLabels;

  private readonly destroy$ = new Subject<void>();
  readonly isSmallScreen = signal<boolean>(false);

  private readonly refreshByHost = signal<Map<String, number>>(new Map());
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

  private hhmm = (s?: string | null) => (s ?? '').slice(0, 5);
  private toMin = (hhmm?: string | null) => {
    const s = this.hhmm(hhmm);
    if (!s) return Number.POSITIVE_INFINITY;
    const [h, m] = s.split(':').map((x) => Number(x) || 0);
    return h * 60 + m;
  };

  readonly isFullSpan = computed<boolean>(() => {
    const plan = this.roomPlan();
    if (!plan) return false;
    return plan.scheduleKind === RoomScheduleKind.FullSpan;
  });

  readonly fullSpanTitle = computed<string>(() => {
    const plan = this.roomPlan();
    const raw = ((plan as any)?.customTitle ?? (plan as any)?.custom_title ?? '').trim();
    if (raw) return raw;
    const p = (plan?.purpose ?? 'NONE').toString().toUpperCase();
    if (p === 'SESSION' || p === 'SESJA') return 'Sesje';
    if (p === 'DISCUSSION' || p === 'DYSKUSJA') return 'Dyskusja';
    if (p === 'ENTERTAINMENT' || p === 'ROZRYWKA') return 'Rozrywka';
    return 'Blok';
  });

  readonly fullSpanRequiresHosts = computed<boolean>(() => {
    const plan = this.roomPlan();
    const v = (plan as any)?.requiresHosts ?? (plan as any)?.requires_hosts ?? null;
    return !!v;
  });

  readonly fullSpanImage = computed<string | null>(() => {
    const items = this.filteredItemsRaw();
    const firstWithImg = items.find((i) => !!i.imageUrl);
    return firstWithImg?.imageUrl ?? null;
  });

  readonly fullSpanDescription = computed<string | null>(() => {
    const items = this.filteredItemsRaw();
    const withDesc = items.find((i) => (i.description ?? '').trim().length > 0);
    return withDesc?.description?.trim() ?? null;
  });

  readonly fullSpanLeads = computed(() =>
    (this.filteredItemsRaw() ?? []).map((h) => ({
      id: h.id,
      clickable: h.role === HostSignupScope.Staff,
      display:
        h.displayName ||
        (h.role === HostSignupScope.Staff ? 'Prowadzący (staff)' : 'Prowadzący'),
      host: h,
    }))
  );

  isSessionCard(h: HostCardVM): boolean {
    return !!(h.systemId || h.system?.id);
  }

  private inferKind(h: HostCardVM): Kind {
    const k =
      ((h as any)?.attractionKind ??
        (h as any)?.kind ??
        (h as any)?.purpose ??
        '').toString().toUpperCase();
    if (k === 'SESSION' || k === 'SESJA') return 'SESSION';
    if (k === 'DISCUSSION' || k === 'DYSKUSJA') return 'DISCUSSION';
    if (k === 'ENTERTAINMENT' || k === 'ROZRYWKA') return 'ENTERTAINMENT';
    if (this.isSessionCard(h)) return 'SESSION';
    return 'DISCUSSION';
  }

  readonly kindLabel = (h: HostCardVM): string => {
    const k = this.inferKind(h);
    if (k === 'SESSION') return 'Sesja';
    if (k === 'ENTERTAINMENT') return 'Rozrywka';
    return 'Dyskusja';
  };

  readonly kindClass = (h: HostCardVM): string => {
    const k = this.inferKind(h);
    if (k === 'SESSION') return 'violet';
    if (k === 'ENTERTAINMENT') return 'golden';
    return 'amber';
  };

  isPlaceholder(h: HostCardVM): boolean {
    return !h.imageUrl;
  }

  timeRangeLabel(h: HostCardVM): string {
    const st = this.hhmm(h.slotStartTime ?? null);
    if (!st) return '—';
    const plan = this.roomPlan();
    const evEnd = this.hhmm(this.eventEnd());
    const evStart = this.hhmm(this.eventStart());
    if (plan && plan.scheduleKind === RoomScheduleKind.Schedule) {
      const slot = (plan.slots ?? []).find((s) => this.hhmm(s.startTime) === st);
      if (slot) {
        const end = this.hhmm(slot.endTime);
        return `${st} - ${end || evEnd || '—'}`;
      }
    }
    if (plan && plan.scheduleKind === RoomScheduleKind.Interval) {
      const ih = Number((plan as any).intervalHours ?? (plan as any).slotHours ?? 0);
      const im = Number((plan as any).intervalMinutes ?? (plan as any).slotDurationMinutes ?? 0);
      const durationMin = (isFinite(ih) ? ih : 0) * 60 + (isFinite(im) ? im : 0);
      if (durationMin > 0) {
        const [H, M] = st.split(':').map((n) => Number(n) || 0);
        const startMin = H * 60 + M;
        const endMin = startMin + durationMin;
        const endH = Math.floor((endMin % (24 * 60)) / 60);
        const endM = endMin % 60;
        const endLabel = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        return `${st} - ${endLabel}`;
      }
      return `${st} - ${evEnd || '—'}`;
    }
    if (plan && plan.scheduleKind === RoomScheduleKind.FullSpan) {
      return `${evStart || '00:00'} - ${evEnd || '23:59'}`;
    }
    if (evStart || evEnd) return `${st} - ${evEnd || '—'}`;
    return st;
  }

  private readonly filteredItemsRaw = computed<HostCardVM[]>(() => {
    const items = this.itemsSig() ?? [];
    const room = this.filterRoom();
    const chosen = room ? items.filter((h) => h.roomName === room) : items.slice();
    chosen.sort((a, b) => this.toMin(a.slotStartTime) - this.toMin(b.slotStartTime));
    return chosen;
  });

  readonly filteredItems = computed<HostCardVM[]>(() => this.filteredItemsRaw());

  constructor() {
    if (this.platform.isBrowser) {
      register();
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
    } else {
      this.isSmallScreen.set(false);
    }

    const id$ = toObservable(this.eventId);
    const date$ = toObservable(this.dateIso);

    combineLatest([id$, date$])
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
          combineLatest([this.hosts.getHostsWithSystems(id, date).pipe(catchError(() => of([]))), this.triggersMap$]).pipe(
            map(([rows, tmap]) => {
              const base: HostCardVM[] = (rows as (IEventHost & { systems?: IRPGSystem | null })[]).map((r) => {
                const system: IRPGSystem | null = r.systemId ? ((r as any).systems ?? null) : null;
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
              const users$ = allUserIds.length ? this.backend.getByIds<IUser>('users', allUserIds) : of([]);
              return combineLatest([gm$, users$]).pipe(
                map(([gms, users]) => {
                  const gmById = new Map<string, IGmData>(gms.filter((gm): gm is IGmData => !!gm && !!gm.gmProfileId).map((gm) => [gm.userId, gm]));
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

  hostCapacity(h: HostCardVM): number | null {
    const own = h.sessionCapacity;
    if (own != null && own > 0) return own;
    const fallback = this.eventCapacity();
    return fallback != null && fallback > 0 ? fallback : null;
  }

  openDetails(host: HostCardVM) {
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

  listDisplayName(h: HostCardVM): string {
    return h.displayName || (h.role === HostSignupScope.Staff ? 'Prowadzący (staff)' : 'Prowadzący');
  }
}
