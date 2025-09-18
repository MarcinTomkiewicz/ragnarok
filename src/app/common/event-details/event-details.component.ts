import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import {
  toSignal,
  toObservable,
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  NgbAlertModule,
  NgbModal,
  NgbModalModule,
} from '@ng-bootstrap/ng-bootstrap';
import { DatePipe } from '@angular/common';

import { SeoService } from '../../core/services/seo/seo.service';
import { EventService } from '../../core/services/event/event.service';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { PlatformService } from '../../core/services/platform/platform.service';

import { EventFull } from '../../core/interfaces/i-events';
import {
  EventTag,
  EventTagLabel,
  AttractionKind,
  HostSignupScope,
} from '../../core/enums/events';
import { formatYmdLocal } from '../../core/utils/weekday-options';

import { of, combineLatest, forkJoin } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
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

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [NgbAlertModule, DatePipe, EventHostsListComponent, NgbModalModule],
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

  HostSignupScope = HostSignupScope; // do szablonu

  // stan prosty
  private readonly loading = signal(true);
  private readonly errorMessage = signal<string | null>(null);
  private readonly today = signal(formatYmdLocal(new Date()));

  // routing
  private readonly slug$ = this.route.paramMap.pipe(
    map((p) => p.get('slug')),
    distinctUntilChanged()
  );
  private readonly slugSig = toSignal(this.slug$, {
    initialValue: null as string | null,
  });

  private readonly queryDate$ = this.route.queryParamMap.pipe(
    map((p) => p.get('date')),
    distinctUntilChanged(),
    map((d) => (isIsoDate(d) ? d : null))
  );
  private readonly queryDate = toSignal(this.queryDate$, {
    initialValue: null as string | null,
  });

  // pobranie eventu
  readonly rawEvent = toSignal<EventFull | null>(
    this.slug$.pipe(
      switchMap((slug) => {
        if (!slug) {
          this.errorMessage.set('Brak sluga w adresie URL.');
          this.loading.set(false);
          return of(null);
        }
        this.errorMessage.set(null);
        this.loading.set(true);
        return this.events.getBySlug(slug).pipe(
          catchError((err) => {
            console.error('Błąd przy pobieraniu wydarzenia:', err);
            this.errorMessage.set(
              'Wystąpił błąd podczas pobierania danych wydarzenia.'
            );
            return of(null);
          }),
          finalize(() => {
            if (this.slugSig() === slug) this.loading.set(false);
          })
        );
      })
    ),
    { initialValue: null }
  );

  // wyliczenie najbliższej daty
  readonly occurrenceDate = computed<string | null>(() => {
    const ev = this.rawEvent();
    if (!ev) return null;

    if (ev.singleDate) return ev.singleDate;

    const qd = this.queryDate();
    if (qd) {
      const hits = this.events.listOccurrencesFE(ev, qd, qd);
      if (hits.length) return qd;
    }

    const today = this.today();
    const todayHits = this.events.listOccurrencesFE(ev, today, today);
    if (todayHits.length) return today;

    const nexts = this.events.listOccurrencesFE(
      ev,
      today,
      addDaysIso(today, 365)
    );
    return nexts.length ? nexts[0] : null;
  });

  readonly hasOccurrence = computed(() => !!this.occurrenceDate());
  readonly event = computed<EventFull | null>(() => {
    const ev = this.rawEvent();
    const date = this.occurrenceDate();
    if (!ev || !date || ev.singleDate) return ev;
    return { ...ev, singleDate: date };
  });
  readonly eventId = computed(() => this.event()?.id ?? null);

  // okładka — brak placeholdera
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
      .map(
        (s) => `${this.images.getOptimizedPublicUrl(path, s.w, s.h)} ${s.w}w`
      )
      .join(', ');
    const sizesAttr =
      '(max-width: 576px) 480px, (max-width: 992px) 768px, 1200px';
    return { src, srcset, sizesAttr, alt: name };
  });

  // etykieta godzin
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

  // tagi -> badge
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

  // --- Niesesyjny: pobierz hostów na najbliższą datę (prosto)
  private static readonly EMPTY_HOSTS: HostCardVM[] = [];
  readonly nonSessionHosts = toSignal<HostCardVM[]>(
    combineLatest([
      toObservable(this.eventId),
      toObservable(this.occurrenceDate),
      toObservable(this.event).pipe(map((ev) => ev?.attractionType)),
    ]).pipe(
      switchMap(([id, date, kind]) => {
        if (!id || !date || kind === AttractionKind.Session)
          return of(EventDetailsComponent.EMPTY_HOSTS);
        return this.hostsSrv.getHostsWithSystems(id, date);
      }),
      switchMap((rows: any[]) => {
        if (!rows?.length) return of(EventDetailsComponent.EMPTY_HOSTS);
        const uniqueIds = Array.from(new Set(rows.map((r) => r.hostUserId)));
        return forkJoin(
          uniqueIds.map((uid) => this.gmDirectory.getGmById(uid))
        ).pipe(
          map((gms) => {
            const byId = new Map(
              gms.filter(Boolean).map((gm) => [gm!.userId, gm!])
            );
            return rows.map((r) => {
              const gm =
                r.role === HostSignupScope.Staff
                  ? byId.get(r.hostUserId) ?? null
                  : null;
              const imageUrl = r.imagePath
                ? this.images.getOptimizedPublicUrl(r.imagePath, 768, 512)
                : null;
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
      catchError(() => of(EventDetailsComponent.EMPTY_HOSTS))
    )
  );

  // proste dane do tabelki „Następne spotkanie” (żadnych .find w HTML)
  readonly nextTitle = computed(() => {
    const h = this.nonSessionHosts()?.find((x) => !!x.title?.trim());
    return h?.title?.trim() || '—';
  });
  readonly nextDescription = computed(() => {
    const h = this.nonSessionHosts()?.find((x) => !!x.description?.trim());
    return h?.description?.trim() || null;
  });
  readonly leads = computed(() =>
    this.nonSessionHosts()?.map((h) => ({
      id: h.id,
      clickable: h.role === HostSignupScope.Staff,
      display:
        h.displayName ||
        (h.role === HostSignupScope.Staff
          ? 'Prowadzący (staff)'
          : 'Prowadzący'),
      host: h,
    }))
  );

  // prosty VM do widoku
  readonly vm = computed(() => ({
    loading: this.loading(),
    error: this.errorMessage(),
    event: this.event(),
    isArchive: !!(
      this.event()?.singleDate && this.event()!.singleDate! < this.today()
    ),
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

  // SEO — bez effect(), zwykła subskrypcja
  constructor() {
    toObservable(this.event)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        distinctUntilChanged(
          (a, b) =>
            (a?.id ?? '') === (b?.id ?? '') &&
            (a?.singleDate ?? '') === (b?.singleDate ?? '')
        ),
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
