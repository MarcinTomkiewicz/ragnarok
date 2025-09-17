import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgbAlertModule } from '@ng-bootstrap/ng-bootstrap';
import { DatePipe } from '@angular/common';

import { SeoService } from '../../core/services/seo/seo.service';
import { EventService } from '../../core/services/event/event.service';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { PlatformService } from '../../core/services/platform/platform.service';

import { EventFull } from '../../core/interfaces/i-events';
import { EventTag, EventTagLabel } from '../../core/enums/events';
import { formatYmdLocal } from '../../core/utils/weekday-options';

import { of } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  finalize,
  map,
  switchMap,
} from 'rxjs/operators';
import { EventHostsListComponent } from '../event-hosts-list/event-hosts-list.component';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [NgbAlertModule, DatePipe, EventHostsListComponent],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.scss',
})
export class EventDetailsComponent {
  // deps
  private readonly route = inject(ActivatedRoute);
  private readonly events = inject(EventService);
  private readonly seo = inject(SeoService);
  private readonly images = inject(ImageStorageService);
  private readonly platform = inject(PlatformService);

  // state
  private readonly loading = signal(true);
  private readonly errorMessage = signal<string | null>(null);
  private readonly today = signal(formatYmdLocal(new Date()));

  readonly hasOccurrence = computed(() => !!this.occurrenceDate());
  readonly eventId = computed(() => this.event()?.id ?? null);

  // routing inputs
  private readonly slug$ = this.route.paramMap.pipe(
    map((p) => p.get('slug')),
    distinctUntilChanged()
  );
  private readonly slugSig = toSignal(this.slug$, { initialValue: null });

  private readonly queryDate$ = this.route.queryParamMap.pipe(
    map((p) => p.get('date')),
    distinctUntilChanged(),
    map((d) => (isIsoDate(d) ? d : null))
  );
  private readonly queryDate = toSignal(this.queryDate$, {
    initialValue: null as string | null,
  });

  // fetch -> signal
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

  // occurrence resolution
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

  // view event (jeśli cykliczne — wstrzykujemy resolved singleDate)
  readonly event = computed<EventFull | null>(() => {
    const ev = this.rawEvent();
    if (!ev) return null;
    const date = this.occurrenceDate();
    if (!date || ev.singleDate) return ev;
    return { ...ev, singleDate: date };
  });

  // Okładka + srcset
  private readonly coverSizes = [
    { w: 480, h: 320 },
    { w: 768, h: 512 },
    { w: 1200, h: 800 },
  ] as const;

  readonly cover = computed(() => {
    const ev = this.event();
    const name = ev?.name ?? '';
    const path = ev?.coverImagePath ?? '';

    const placeholder = {
      src: '/assets/placeholders/event-cover.avif',
      srcset: null as string | null,
      sizesAttr: null as string | null,
      alt: name,
      hasImage: false,
    };

    if (!path) return placeholder;

    const mid = this.coverSizes[1];
    const src = this.images.getOptimizedPublicUrl(path, mid.w, mid.h);
    const srcset = this.coverSizes
      .map(
        (s) => `${this.images.getOptimizedPublicUrl(path, s.w, s.h)} ${s.w}w`
      )
      .join(', ');
    const sizesAttr =
      '(max-width: 576px) 480px, (max-width: 992px) 768px, 1200px';

    return { src, srcset, sizesAttr, alt: name, hasImage: true };
  });

  // godziny — jeden label
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

  readonly tagBadges = computed(() => {
    const tags = this.event()?.tags ?? [];
    return tags.map((t) => {
      const key = t as EventTag;
      return {
        key: t,
        label: (EventTagLabel as any)[key] ?? String(t),
        cssClass: this.tagBadgeClass[key] ?? 'muted',
      };
    });
  });

  readonly chips = computed(() => [...this.tagBadges()]);

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
  }));

  private readonly setSeo = effect(() => {
    const ev = this.event();
    if (ev) {
      const d = ev.singleDate ? ` – ${ev.singleDate}` : '';
      this.seo.setTitleAndMeta(`${ev.name}${d}`);
    }
  });

  openFacebook(link?: string) {
    if (!link || !this.platform.isBrowser) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  setEventFee(fee: number): string {
    return fee && fee > 0 ? `${fee} zł` : 'Bezpłatne';
  }
}

/** Utilities */
function isIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysIso(isoYmd: string, days: number): string {
  const d = new Date(isoYmd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatYmdLocal(d);
}
