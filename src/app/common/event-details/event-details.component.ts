import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgbAlertModule } from '@ng-bootstrap/ng-bootstrap';
import { DatePipe } from '@angular/common';

import { SeoService } from '../../core/services/seo/seo.service';
import { EventService } from '../../core/services/event/event.service';

import { of } from 'rxjs';
import { catchError, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { EventFull } from '../../core/interfaces/i-events';
import { EventTag, EventTagLabel } from '../../core/enums/events';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [NgbAlertModule, DatePipe],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.scss',
})
export class EventDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly events = inject(EventService);
  private readonly seo = inject(SeoService);
  private readonly images = inject(ImageStorageService);

  private readonly loading = signal(true);
  private readonly errorMessage = signal<string | null>(null);
  private readonly today = signal(formatYmdLocal(new Date()));

  private readonly slug$ = this.route.paramMap.pipe(
    map((p) => p.get('slug')),
    distinctUntilChanged()
  );
  private readonly queryDate$ = this.route.queryParamMap.pipe(
    map((p) => p.get('date')),
    distinctUntilChanged(),
    map((d) => (isIsoDate(d) ? d : null))
  );

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
            this.errorMessage.set('Wystąpił błąd podczas pobierania danych wydarzenia.');
            return of(null);
          }),
          finalize(() => this.loading.set(false))
        );
      })
    ),
    { initialValue: null }
  );

  private readonly queryDate = toSignal(this.queryDate$, { initialValue: null as string | null });

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

    const nexts = this.events.listOccurrencesFE(ev, today, addDaysIso(today, 365));
    return nexts.length ? nexts[0] : null;
  });

  readonly event = computed<EventFull | null>(() => {
    const ev = this.rawEvent();
    if (!ev) return null;
    const date = this.occurrenceDate();
    if (!date || ev.singleDate) return ev;
    return { ...ev, singleDate: date };
  });

  private readonly coverSizes = [
    { w: 480,  h: 320 }, 
    { w: 768,  h: 512 },
    { w: 1200, h: 800 },
  ] as const;

  readonly cover = computed(() => {
    const ev = this.event();
    const name = ev?.name ?? '';
    const path = ev?.coverImagePath ?? '';

    // Fallback na placeholder z assets, gdy brak okładki
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
      .map((s) => `${this.images.getOptimizedPublicUrl(path, s.w, s.h)} ${s.w}w`)
      .join(', ');
    const sizesAttr = '(max-width: 576px) 480px, (max-width: 992px) 768px, 1200px';

    return { src, srcset, sizesAttr, alt: name, hasImage: true };
  });

  readonly isArchive = computed(() => {
    const ev = this.event();
    const t = this.today();
    return !!(ev?.singleDate && ev.singleDate < t);
  });

  readonly startTimeHHmm = computed(() =>
    this.event()?.startTime?.slice(0, 5) ?? '—'
  );
  readonly endTimeHHmm = computed(() =>
    this.event()?.endTime?.slice(0, 5) ?? '—'
  );
  readonly costLabel = computed(() => 'Do ustalenia');


  
private readonly tagBadgeClass: Record<EventTag, string> = {
  [EventTag.Beginners]: 'green',
  [EventTag.Session]: 'violet',
  [EventTag.Discussion]: 'muted',
  [EventTag.Entertainment]: 'golden',
};

readonly tagBadges = computed(() => {
  const tags = this.event()?.tags ?? [];
  return tags.map((t) => {
    const key = (t as EventTag);
    return {
      key: t,              
      label: (EventTagLabel as any)[key] ?? String(t),
      cssClass: this.tagBadgeClass[key] ?? 'muted',
    };
  });
});


readonly vm = computed(() => ({
  loading: this.loading(),
  error: this.errorMessage(),
  event: this.event(),
  isArchive: this.isArchive(),
  startTimeHHmm: this.startTimeHHmm(),
  endTimeHHmm: this.endTimeHHmm(),
  costLabel: this.costLabel(),
  cover: this.cover(),
  tagBadges: this.tagBadges(),
}));

  private readonly setSeo = effect(() => {
    const ev = this.event();
    if (ev) {
      const d = ev.singleDate ? ` – ${ev.singleDate}` : '';
      this.seo.setTitleAndMeta(`${ev.name}${d}`);
    }
  });

  openFacebook(link?: string) {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }
}

/** Utility */
function isIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatYmdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDaysIso(isoYmd: string, days: number): string {
  const d = new Date(isoYmd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatYmdLocal(d);
}
