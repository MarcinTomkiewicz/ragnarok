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

const SMALL_BP = 767;

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
  // inputs
  eventId = input.required<string>();
  dateIso = input.required<string>();
  currentUser = input<IUser | null>(null);
  showSignup = input<boolean>(true);
  eventCapacity = input<number | null>(null);

  // DI
  private readonly hosts = inject(EventHostsService);
  private readonly images = inject(ImageStorageService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly backend = inject(BackendService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platform = inject(PlatformService);

  // state
  readonly loadingSig = signal(true);
  readonly errorSig = signal<string | null>(null);
  readonly itemsSig = signal<HostCardVM[]>([]);
  readonly hasItems = computed(() => (this.itemsSig()?.length ?? 0) > 0);

  // do szablonu
  readonly HostRole = HostSignupScope;
  readonly GmStyleTagLabels = GmStyleTagLabels;

  // responsive / swiper
  private readonly destroy$ = new Subject<void>();
  readonly isSmallScreen = signal<boolean>(false);

  // refresh per host (po udanym zapisie do tej sesji)
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
    this.scheduleEqualize(); // po zmianie przycisku lista uczestników mogła zmienić wysokość
  }

  // słownik triggerów: slug -> label (PL)
  private readonly triggersMap$ = this.backend
    .getAll<IContentTrigger>(
      'content_triggers',
      'label',
      'asc',
      {
        filters: { is_active: { operator: FilterOperator.EQ, value: true } },
      } as any,
      undefined,
      undefined,
      false
    )
    .pipe(
      map(
        (rows) =>
          new Map<string, string>((rows ?? []).map((t) => [t.slug, t.label]))
      ),
      catchError(() => of(new Map<string, string>())),
      shareReplay(1)
    );

  constructor() {
    // SSR-safe
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
        distinctUntilChanged(
          ([aId, aDate], [bId, bDate]) => aId === bId && aDate === bDate
        ),
        tap(() => {
          this.loadingSig.set(true);
          this.errorSig.set(null);
          this.itemsSig.set([]);
        }),
        switchMap(([id, date]) =>
          combineLatest([
            this.hosts
              .getHostsWithSystems(id, date)
              .pipe(catchError(() => of([]))),
            this.triggersMap$,
          ]).pipe(
            map(([rows, tmap]) => {
              const base: HostCardVM[] = (
                rows as (IEventHost & { systems?: IRPGSystem | null })[]
              ).map((r) => {
                const system: IRPGSystem | null = r.systemId
                  ? (r as any).systems ?? null
                  : null;
                const imageUrl = r.imagePath
                  ? this.images.getOptimizedPublicUrl(r.imagePath, 768, 512)
                  : null;
                const slugs: string[] = (r.triggers ?? []) as string[];
                const topLabels = slugs
                  .slice(0, 3)
                  .map((s) => tmap.get(s) ?? s);

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

              const allUserIds = Array.from(
                new Set(base.map((h) => h.hostUserId).filter(Boolean))
              );
              return { base, allUserIds };
            }),
            switchMap(({ base, allUserIds }) => {
              const gm$ = allUserIds.length
                ? forkJoin(
                    allUserIds.map((id) =>
                      this.gmDirectory.getGmById(id).pipe(
                        // eslint-disable-next-line no-console
                        tap((g) => console.log('Hello: ' + g?.gmProfileId)),
                        catchError(() => of(null))
                      )
                    )
                  )
                : of([]);

              const users$ = allUserIds.length
                ? this.backend.getByIds<IUser>('users', allUserIds)
                : of([]);

              return combineLatest([gm$, users$]).pipe(
                map(([gms, users]) => {
                  const gmById = new Map<string, IGmData>(
                    gms
                      .filter((gm): gm is IGmData => !!gm && !!gm.gmProfileId)
                      .map((gm) => [gm.userId, gm])
                  );
                  const userById = new Map<string, IUser>(
                    users.map((u) => [u.id, u])
                  );

                  const nameFromUser = (u?: IUser): string => {
                    if (!u) return 'Użytkownik';
                    if (u.useNickname && u.nickname?.trim())
                      return u.nickname.trim();
                    return u.firstName?.trim() || u.email || 'Użytkownik';
                  };

                  return base.map((h) => {
                    const gm = gmById.get(h.hostUserId) ?? null;
                    const u = userById.get(h.hostUserId);
                    const displayName = gm
                      ? this.gmDirectory.gmDisplayName(gm)
                      : nameFromUser(u);
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

  // === Równa wysokość kart w swipie (mobile) ===
  private scheduleEqualize() {
    if (!this.platform.isBrowser || !this.isSmallScreen()) return;
    // po renderze + po załadowaniu obrazków (drugi tick)
    setTimeout(() => this.equalizeSwiperCardHeights(), 0);
    setTimeout(() => this.equalizeSwiperCardHeights(), 250);
  }

  private equalizeSwiperCardHeights() {
    if (!this.platform.isBrowser || !this.isSmallScreen()) return;
    const container = document.querySelector<HTMLElement>('.mg-swiper');
    if (!container) return;

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>('.session-card.is-swiper')
    );

    if (!cards.length) return;

    // Reset przed pomiarem
    container.style.removeProperty('--session-card-height');
    cards.forEach((c) => (c.style.height = ''));

    // Pomiar naturalnej wysokości
    let max = 0;
    cards.forEach((c) => (max = Math.max(max, c.offsetHeight)));

    if (max > 0) {
      container.style.setProperty('--session-card-height', `${max}px`);
      // jeśli CSS var nie zadziała z jakiegoś powodu, ustawiamy bezpośrednio
      cards.forEach((c) => (c.style.height = `var(--session-card-height)`));
    }
  }

  // === helpers ===
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

  listDisplayName(h: HostCardVM): string {
    return (
      h.displayName ||
      (h.role === HostSignupScope.Staff ? 'Prowadzący (staff)' : 'Prowadzący')
    );
  }
}
