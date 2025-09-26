import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgbAlertModule, NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { DatePipe } from '@angular/common';

import { SeoService } from '../../core/services/seo/seo.service';
import { EventService } from '../../core/services/event/event.service';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { PlatformService } from '../../core/services/platform/platform.service';

import { EventFull } from '../../core/interfaces/i-events';
import { EventTag, EventTagLabel, AttractionKind, HostSignupScope } from '../../core/enums/events';
import { formatYmdLocal } from '../../core/utils/weekday-options';

import { of, combineLatest, forkJoin } from 'rxjs';
import { catchError, distinctUntilChanged, filter, finalize, map, switchMap, tap } from 'rxjs/operators';

import { EventHostsListComponent } from '../event-hosts-list/event-hosts-list.component';
import { GmDetailsModalComponent } from '../gm-details-modal/gm-details-modal.component';
import { GmDirectoryService } from '../../auth/core/services/gm/gm-directory/gm-directory.service';
import { EventHostsService } from '../../core/services/event-hosts/event-hosts.service';
import { HostCardVM } from '../../core/interfaces/i-event-host';

import { AuthService } from '../../core/services/auth/auth.service';
import { EventSignupPanelComponent } from '../event-signup-panel/event-signup-panel.component';
import { IEventParticipant } from '../../core/interfaces/i-event-participant';
import { ParticipantsListComponent } from '../event-participants-list/event-participants-list.component';

// --- Tryb zapisów: AUTO (heurystyka) lub jawne tryby
export type SignupScope = 'AUTO' | 'WHOLE' | 'SESSION' | 'BOTH' | 'NONE';

// Tymczasowe override’y po slugach (możesz dopisywać)
const SIGNUP_OVERRIDES_BY_SLUG: Record<string, SignupScope> = {
  'chaotyczny-czwartek': 'WHOLE',
  'dobranocka-w-jotunheimie': 'WHOLE',
  'echa-chaosu': 'SESSION',
  'chaotyczny-czwartek-nieznany-straznik': 'WHOLE',
  'commander-w-ragnaroku': 'NONE',
};

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [NgbAlertModule, DatePipe, EventHostsListComponent, NgbModalModule, EventSignupPanelComponent, ParticipantsListComponent],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.scss',
})
export class EventDetailsComponent {
  // DI
  private readonly route = inject(ActivatedRoute);
  private readonly events = inject(EventService);
  private readonly seo = inject(SeoService);
  private readonly images = inject(ImageStorageService);
  private readonly platform = inject(PlatformService);
  private readonly gmDirectory = inject(GmDirectoryService);
  private readonly hostsSrv = inject(EventHostsService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  HostSignupScope = HostSignupScope; // do szablonu

  // --- Stan
  private readonly loading = signal(true);
  private readonly errorMessage = signal<string | null>(null);
  private readonly today = signal(formatYmdLocal(new Date()));

  // user (computed z AuthService)
  readonly currentUser = this.auth.user;

  // --- Sygnały zamiast toSignal()
  private readonly slugSig = signal<string | null>(null);
  private readonly queryDateSig = signal<string | null>(null);
  private readonly rawEventSig = signal<EventFull | null>(null);
  private readonly nonSessionHostsSig = signal<HostCardVM[]>([]);

  // --- computed
  readonly occurrenceDate = computed<string | null>(() => {
    const ev = this.rawEventSig();
    if (!ev) return null;

    if (ev.singleDate) return ev.singleDate;

    const qd = this.queryDateSig();
    if (qd) {
      const hits = this.events.listOccurrencesFE(ev, qd, qd);
      if (hits.length) return qd;
    }

    const today = this.today();
    const todayHits = this.events.listOccurrencesFE(ev, today, today);
    if (todayHits.length) return today;

    const nexts = this.events.listOccurrencesFE(ev, today, addDaysIso(today, 365));
    return nexts.length ? nexts[0] : null;
  });

  readonly hasOccurrence = computed(() => !!this.occurrenceDate());

  readonly event = computed<EventFull | null>(() => {
    const ev = this.rawEventSig();
    const date = this.occurrenceDate();
    if (!ev || !date || ev.singleDate) return ev;
    return { ...ev, singleDate: date };
  });

  readonly eventId = computed(() => this.event()?.id ?? null);

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
    const srcset = this.coverSizes.map(s => `${this.images.getOptimizedPublicUrl(path, s.w, s.h)} ${s.w}w`).join(', ');
    const sizesAttr = '(max-width: 576px) 480px, (max-width: 992px) 768px, 1200px';
    return { src, srcset, sizesAttr, alt: name };
  });

  readonly timeRangeLabel = computed(() => {
    const ev = this.event();
    if (!ev) return '-';
    const st = (ev.startTime ?? '').slice(0, 5);
    const et = (ev.endTime ?? '').slice(0, 5);
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

  // „Następne spotkanie” (dla niesesyjnych)
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
      display: h.displayName || (h.role === HostSignupScope.Staff ? 'Prowadzący (staff)' : 'Prowadzący'),
      host: h,
    }))
  );

  // --- Rozstrzyganie zakresu zapisów
  readonly signupScope = computed<Exclude<SignupScope, 'AUTO'>>(() => {
    const ev = this.event();
    const slug = this.slugSig();
    return this.resolveSignupScope(ev, slug);
  });

  private resolveSignupScope(ev: EventFull | null, slug: string | null): Exclude<SignupScope, 'AUTO'> {
    if (!ev) return 'WHOLE';
    // 1) backend (jeśli kiedyś doda) — honorujemy, jeśli ≠ AUTO
    const s = (ev as any).signupScope as SignupScope | undefined;
    if (s && s !== 'AUTO') return s as Exclude<SignupScope, 'AUTO'>;

    // 2) override po slug
    const ov = slug ? SIGNUP_OVERRIDES_BY_SLUG[slug] : undefined;
    if (ov && ov !== 'AUTO') return ov as Exclude<SignupScope, 'AUTO'>;

    // 3) heurystyka
    return ev.attractionType === AttractionKind.Session ? 'SESSION' : 'WHOLE';
  }

  // refresh listy uczestników eventu (WHOLE) po zapisie
  readonly participantsRefresh = signal(0);
  onWholeSignupSuccess(_p: IEventParticipant) {
    this.participantsRefresh.set(this.participantsRefresh() + 1);
  }
  onWholeSignupError(_msg: string) {}

  // VM do widoku
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
  }));

  constructor() {
    // --- slug z URL
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((p) => p.get('slug')),
        distinctUntilChanged()
      )
      .subscribe((slug) => this.slugSig.set(slug));

    // --- query date z URL
    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((p) => p.get('date')),
        distinctUntilChanged(),
        map((d) => (isIsoDate(d) ? d : null))
      )
      .subscribe((d) => this.queryDateSig.set(d));

    // --- ładowanie eventu po zmianie slug
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

    // --- dociąg „niesesyjnych” hostów dla najbliższej daty (prosto)
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

    // --- SEO (prosta subskrypcja)
    toObservable(this.event)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        distinctUntilChanged((a, b) => (a?.id ?? '') === (b?.id ?? '') && (a?.singleDate ?? '') === (b?.singleDate ?? '')),
        tap((ev) => {
          if (!ev) return;
          const d = ev.singleDate ? ` – ${ev.singleDate}` : '';
          this.seo.setTitleAndMeta(`${ev.name}${d}`);
        })
      )
      .subscribe();
  }

  openFacebook(link?: string) {
    if (!link || !this.platform.isBrowser) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  openGmProfile(h: HostCardVM, e: MouseEvent) {
    e.stopPropagation();
    if (h.role !== HostSignupScope.Staff) return;
    const ref = this.modal.open(GmDetailsModalComponent, { size: 'lg', centered: true, scrollable: true });
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
}

/** utils */
function isIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function addDaysIso(isoYmd: string, days: number): string {
  const d = new Date(isoYmd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatYmdLocal(d);
}
