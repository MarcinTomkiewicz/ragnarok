import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  LOCALE_ID,
} from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NgbAlertModule,
  NgbModal,
  NgbModalModule,
  NgbDropdownModule,
} from '@ng-bootstrap/ng-bootstrap';
import { DatePipe } from '@angular/common';

import { SeoService } from '../../core/services/seo/seo.service';
import { EventService } from '../../core/services/event/event.service';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { PlatformService } from '../../core/services/platform/platform.service';

import { EventFull, EventRoomPlan } from '../../core/interfaces/i-events';
import {
  EventTag,
  EventTagLabel,
  AttractionKind,
  HostSignupScope,
  ParticipantSignupScope,
} from '../../core/enums/events';
import { RoomScheduleKind, RoomPurpose } from '../../core/enums/event-rooms';
import { formatYmdLocal } from '../../core/utils/weekday-options';

import { of, combineLatest, forkJoin } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';

import { EventHostsListComponent } from '../event-hosts-list/event-hosts-list.component';
import { GmDetailsModalComponent } from '../gm-details-modal/gm-details-modal.component';
import { GmDirectoryService } from '../../auth/core/services/gm/gm-directory/gm-directory.service';
import { EventHostsService } from '../../core/services/event-hosts/event-hosts.service';
import { HostCardVM } from '../../core/interfaces/i-event-host';

import { AuthService } from '../../core/services/auth/auth.service';
import { EventSignupPanelComponent } from '../event-signup-panel/event-signup-panel.component';
import { IEventParticipant } from '../../core/interfaces/i-event-participant';
import { ParticipantsListComponent } from '../event-participants-list/event-participants-list.component';
import { LinkifyPipe } from '../../core/pipes/linkify.pipe';
import { roomsOrder } from '../../core/utils/roomsOrder';
import { TimeUtil } from '../../core/services/event/time.util';
import { isIsoDate, addDaysIso, endOfNextMonthIso } from '../../core/utils/date.util';

type SlotVM = {
  start: string;
  end: string;
  kind: RoomPurpose;
};

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [
    NgbAlertModule,
    NgbDropdownModule,
    DatePipe,
    EventHostsListComponent,
    NgbModalModule,
    EventSignupPanelComponent,
    ParticipantsListComponent,
    LinkifyPipe,
  ],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.scss',
  providers: [{ provide: LOCALE_ID, useValue: 'pl' }],
})
export class EventDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly events = inject(EventService);
  private readonly time = inject(TimeUtil);
  private readonly seo = inject(SeoService);
  private readonly images = inject(ImageStorageService);
  private readonly platform = inject(PlatformService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly hostsSrv = inject(EventHostsService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  HostSignupScope = HostSignupScope;

  private readonly loading = signal(true);
  private readonly errorMessage = signal<string | null>(null);
  private readonly today = signal(formatYmdLocal(new Date()));

  readonly currentUser = this.auth.user;

  private readonly slugSig = signal<string | null>(null);
  private readonly queryDateSig = signal<string | null>(null);
  private readonly rawEventSig = signal<EventFull | null>(null);
  private readonly nonSessionHostsSig = signal<HostCardVM[]>([]);

  private readonly baselineDateSig = signal<string | null>(null);

  readonly occurrenceDate = computed<string | null>(() => {
    const ev = this.rawEventSig();
    if (!ev) return null;
    if (ev.singleDate) return ev.singleDate;

    const qd = this.queryDateSig();
    if (qd && this.events.listOccurrencesFE(ev, qd, qd).length) return qd;

    const t = this.today();
    if (this.events.listOccurrencesFE(ev, t, t).length) return t;

    const nexts = this.events.listOccurrencesFE(ev, t, addDaysIso(t, 365));
    return nexts[0] ?? null;
  });

  readonly occurrenceDateObj = computed<Date | null>(() => {
    const s = this.occurrenceDate();
    return s ? new Date(s + 'T00:00:00') : null;
  });

  readonly hasOccurrence = computed(() => !!this.occurrenceDate());

  readonly event = computed<EventFull | null>(() => {
    const ev = this.rawEventSig();
    const date = this.occurrenceDate();
    if (!ev || !date || ev.singleDate) return ev;
    return { ...ev, singleDate: date };
  });

  readonly eventId = computed(() => this.event()?.id ?? null);

  private readonly navWindowEnd = computed<string | null>(() => {
    const base = this.baselineDateSig() ?? this.occurrenceDate();
    return base ? endOfNextMonthIso(base) : null;
  });

  readonly occurrenceOptions = computed<string[]>(() => {
    const ev = this.rawEventSig();
    const base = this.baselineDateSig() ?? this.occurrenceDate();
    const end = this.navWindowEnd();
    if (!ev || !base || !end) return [];
    return this.events.listOccurrencesFE(ev, base, end);
  });

  readonly occurrenceOptionsVm = computed(() =>
    this.occurrenceOptions().map((iso) => ({
      iso,
      date: new Date(iso + 'T00:00:00'),
    }))
  );

  readonly currentIndex = computed<number>(() => {
    const opts = this.occurrenceOptions();
    const cur = this.occurrenceDate();
    return cur ? Math.max(0, opts.indexOf(cur)) : 0;
  });

  readonly canPrev = computed(() => this.currentIndex() > 0);
  readonly canNext = computed(() => {
    const opts = this.occurrenceOptions();
    return this.currentIndex() < (opts.length ? opts.length - 1 : 0);
  });

  readonly isComposite = computed(
    () => this.event()?.attractionType === AttractionKind.Composite
  );
  readonly rooms = computed<string[]>(() => roomsOrder(this.event()?.rooms ?? []));

  readonly selectedRoom = signal<string | null>(null);

  readonly roomPlanForSelected = computed<EventRoomPlan | null>(() => {
    const ev = this.event();
    const r = this.selectedRoom();
    if (!ev || !r) return null;
    return (ev.roomPlans ?? []).find((p) => p.roomName === r) ?? null;
  });

  readonly slotsForSelectedRoom = computed<SlotVM[]>(() => {
    const ev = this.event();
    const plan = this.roomPlanForSelected();
    if (!ev || !plan) return [];

    if (plan.scheduleKind === RoomScheduleKind.FullSpan) {
      const st = this.time.hhmm(ev.startTime ?? '00:00');
      const en = this.time.hhmm(ev.endTime ?? '23:59');
      const kind = (plan.purpose as RoomPurpose) ?? RoomPurpose.Session;
      return [{ start: st, end: en, kind }];
    }

    if (plan.scheduleKind === RoomScheduleKind.Interval) {
      const st = this.time.hhmm(ev.startTime ?? '00:00');
      const en = this.time.hhmm(ev.endTime ?? '23:59');
      const kind = (plan.purpose as RoomPurpose) ?? RoomPurpose.Session;
      return [{ start: st, end: en, kind }];
    }

    const slots = (plan.slots ?? []).map((s: any) => {
      const purpose: RoomPurpose = (s.purpose as RoomPurpose) ?? RoomPurpose.Session;
      return {
        start: this.time.hhmm(s.startTime),
        end: this.time.hhmm(s.endTime),
        kind: purpose,
      };
    });
    return slots.sort((a, b) => a.start.localeCompare(b.start));
  });

  readonly wholeCapacity = computed<number | null>(() => {
    const raw = this.event()?.wholeCapacity ?? null;
    return raw === 0 ? null : raw;
  });
  readonly wholeCapacityNormalized = computed<number | null>(() => {
    const cap = this.event()?.wholeCapacity ?? null;
    return cap != null && cap <= 0 ? null : cap;
  });

  readonly participantSignup = computed<ParticipantSignupScope>(() => {
    const ev = this.event();
    if (!ev) return ParticipantSignupScope.Whole;
    return (
      ev.participantSignup ??
      (ev.attractionType === AttractionKind.Session
        ? ParticipantSignupScope.Session
        : ParticipantSignupScope.Whole)
    );
  });
  readonly showSessionSignup = computed(() => {
    const s = this.participantSignup();
    return s === ParticipantSignupScope.Session || s === ParticipantSignupScope.Both;
  });
  readonly showWholeSignup = computed(() => {
    const s = this.participantSignup();
    return s === ParticipantSignupScope.Whole || s === ParticipantSignupScope.Both;
  });

  private readonly coverSizes = [
    { w: 480, h: 320 },
    { w: 768, h: 512 },
    { w: 1200, h: 800 },
  ] as const;

  readonly cover = computed(() => {
    const path = this.event()?.coverImagePath ?? '';
    if (!path) return null;
    const name = this.event()?.name ?? '';
    const mid = this.coverSizes[1];
    const src = this.images.getOptimizedPublicUrl(path, mid.w, mid.h);
    const srcset = this.coverSizes
      .map((s) => `${this.images.getOptimizedPublicUrl(path, s.w, s.h)} ${s.w}w`)
      .join(', ');
    const sizesAttr = '(max-width: 576px) 480px, (max-width: 992px) 768px, 1200px';
    return { src, srcset, sizesAttr, alt: name };
  });

  readonly timeRangeLabel = computed(() => {
    const ev = this.event();
    if (!ev) return '-';
    const st = this.time.hhmm(ev.startTime ?? '');
    const et = this.time.hhmm(ev.endTime ?? '');
    if (!st && !et) return ' - ';
    if (st === '00:00' && (!et || et === '23:59')) return 'Cały dzień';
    if (st && et) return `${st} - ${et}`;
    return st || et || '-';
  });

  private readonly tagBadgeClass: Record<EventTag, string> = {
    [EventTag.Beginners]: 'green',
    [EventTag.Session]: 'violet',
    [EventTag.Discussion]: 'muted',
    [EventTag.Entertainment]: 'golden',
  };
  readonly chips = computed(() => {
    const tags = this.event()?.tags ?? [];
    return tags.map((t) => ({
      key: t,
      label: (EventTagLabel as any)[t] ?? String(t),
      cssClass: this.tagBadgeClass[t] ?? 'muted',
    }));
  });

  readonly nextTitle = computed(() => {
    const h = this.nonSessionHostsSig()?.find((x) => !!x.title?.trim());
    return h?.title?.trim() || '—';
  });
  readonly nextDescription = computed(() => {
    const h = this.nonSessionHostsSig()?.find((x) => !!x.description?.trim());
    return h?.description?.trim() || null;
  });
  readonly leads = computed(() =>
    this.nonSessionHostsSig()?.map((h) => ({
      id: h.id,
      clickable: h.role === HostSignupScope.Staff,
      display:
        h.displayName ||
        (h.role === HostSignupScope.Staff ? 'Prowadzący (staff)' : 'Prowadzący'),
      host: h,
    }))
  );

  readonly participantsRefresh = signal(0);
  onWholeSignupSuccess(_p: IEventParticipant) {
    this.participantsRefresh.set(this.participantsRefresh() + 1);
  }
  onWholeSignupError(_msg: string) {}

  readonly vm = computed(() => ({
    loading: this.loading(),
    error: this.errorMessage(),
    event: this.event(),
    isArchive: !!(this.event()?.singleDate && this.event()!.singleDate! < this.today()),
    cover: this.cover(),
    timeRangeLabel: this.timeRangeLabel(),
    feeLabel: this.setEventFee(this.event()?.entryFeePln ?? 0),
    chips: this.chips(),
    nonSession: {
      title: this.nextTitle(),
      description: this.nextDescription(),
      leads: this.leads(),
    },
    occurrenceDateObj: this.occurrenceDateObj(),
    occurrenceOptionsVm: this.occurrenceOptionsVm(),
    canPrev: this.canPrev(),
    canNext: this.canNext(),
  }));

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((p) => p.get('slug')),
        distinctUntilChanged()
      )
      .subscribe((slug) => {
        this.slugSig.set(slug);
        this.baselineDateSig.set(null);
      });

    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((p) => p.get('date')),
        distinctUntilChanged(),
        map((d) => (isIsoDate(d) ? d : null))
      )
      .subscribe((d) => this.queryDateSig.set(d));

    toObservable(this.slugSig)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((slug) => {
          if (!slug) {
            this.errorMessage.set('Brak sluga w adresie URL.');
            this.rawEventSig.set(null);
            this.loading.set(false);
          } else {
            this.errorMessage.set(null);
            this.loading.set(true);
          }
        }),
        filter((slug): slug is string => !!slug),
        switchMap((slug) =>
          this.events.getBySlug(slug).pipe(
            catchError((err) => {
              console.error('Błąd przy pobieraniu wydarzenia:', err);
              this.errorMessage.set('Wystąpił błąd podczas pobierania danych wydarzenia.');
              return of(null);
            }),
            finalize(() => {
              if (this.slugSig() === slug) this.loading.set(false);
            })
          )
        )
      )
      .subscribe((ev) => this.rawEventSig.set(ev));

    toObservable(this.occurrenceDate)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter((d): d is string => !!d),
        tap((d) => {
          if (!this.baselineDateSig()) this.baselineDateSig.set(d);
        })
      )
      .subscribe();

    const eventId$ = toObservable(this.eventId);
    const date$ = toObservable(this.occurrenceDate);
    const kind$ = toObservable(this.event).pipe(map((ev) => ev?.attractionType));

    combineLatest([eventId$, date$, kind$])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(([id, date, kind]) => {
          if (!id || !date || kind === AttractionKind.Session) return of([] as HostCardVM[]);
          return this.hostsSrv.getHostsWithSystems(id, date).pipe(catchError(() => of([] as HostCardVM[])));
        }),
        switchMap((rows: any[]) => {
          if (!rows?.length) return of([] as HostCardVM[]);
          const uniqueIds = Array.from(new Set(rows.map((r) => r.hostUserId)));
          return forkJoin(uniqueIds.map((uid) => this.gmDirectory.getGmById(uid))).pipe(
            map((gms) => {
              const byId = new Map(gms.filter(Boolean).map((gm) => [gm!.userId, gm!]));
              return rows.map((r) => {
                const gm = r.role === HostSignupScope.Staff ? byId.get(r.hostUserId) ?? null : null;
                const imageUrl = r.imagePath ? this.images.getOptimizedPublicUrl(r.imagePath, 768, 512) : null;
                return {
                  ...r,
                  gm,
                  imageUrl,
                  displayName: this.gmDirectory.gmDisplayName(gm),
                  triggersTop: [],
                  triggersExtraCount: 0,
                } as HostCardVM;
              });
            })
          );
        }),
        catchError(() => of([] as HostCardVM[]))
      )
      .subscribe((items) => this.nonSessionHostsSig.set(items));

    toObservable(this.event)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        distinctUntilChanged(
          (a, b) => (a?.id ?? '') === (b?.id ?? '') && (a?.singleDate ?? '') === (b?.singleDate ?? '')
        ),
        tap((ev) => {
          if (!ev) return;
          const d = ev.singleDate ? ` – ${ev.singleDate}` : '';
          this.seo.setTitleAndMeta(`${ev.name}${d}`);
        })
      )
      .subscribe();

    toObservable(this.event)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => {
        if (!ev || !this.isComposite()) return;
        const qp = this.route.snapshot.queryParamMap;
        const r = qp.get('room');
        const first = (ev.rooms ?? [])[0] ?? null;
        this.selectedRoom.set(r ?? first);
      });
  }

  goPrev() {
    if (!this.canPrev()) return;
    const opts = this.occurrenceOptions();
    this.updateDateQuery(opts[this.currentIndex() - 1]);
  }
  goNext() {
    if (!this.canNext()) return;
    const opts = this.occurrenceOptions();
    this.updateDateQuery(opts[this.currentIndex() + 1]);
  }

  // Bierzemy event z templatki, rozstrzygamy ISO z data-date
  chooseDateFromDropdown(evt: Event) {
    const target = evt.currentTarget as HTMLElement | null;
    const el = target ?? (evt.target as HTMLElement | null);
    const btn = el?.closest('[data-date]') as HTMLElement | null;
    const iso = btn?.getAttribute('data-date') ?? '';
    if (!isIsoDate(iso)) return;
    const opts = this.occurrenceOptions();
    if (!opts.includes(iso)) return;
    this.updateDateQuery(iso);
  }

  private updateDateQuery(dateIso: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: dateIso },
      queryParamsHandling: 'merge',
    });
  }

  openFacebook(link?: string) {
    if (!link || !this.platform.isBrowser) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  }
  openGmProfile(h: HostCardVM, e: MouseEvent) {
    e.stopPropagation();
    if (h.role !== HostSignupScope.Staff) return;
    const ref = this.modal.open(GmDetailsModalComponent, {
      size: 'lg',
      centered: true,
      scrollable: true,
    });
    if (h.gm) {
      ref.componentInstance.gm = h.gm;
      return;
    }
    this.gmDirectory.getGmById(h.hostUserId).subscribe((gm) => {
      if (gm) ref.componentInstance.gm = gm;
    });
  }

  setEventFee(fee: number): string {
    return fee && fee > 0 ? `${fee} zł` : 'Bezpłatne';
  }
  longDescParagraphs(): string[] {
    const v = this.vm?.();
    const raw = v?.event?.longDescription ?? '';
    return raw.split(/\n/);
  }
}
