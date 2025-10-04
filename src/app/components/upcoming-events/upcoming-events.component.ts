import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { addDays, isAfter, isEqual, parseISO } from 'date-fns';
import { fromEvent, Subject } from 'rxjs';
import { map, startWith, takeUntil } from 'rxjs/operators';
import { register } from 'swiper/element/bundle';

import { AttractionKind, AttractionKindLabel } from '../../core/enums/events';
import { EventFull } from '../../core/interfaces/i-events';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { EventService } from '../../core/services/event/event.service';
import { PlatformService } from '../../core/services/platform/platform.service'; // ścieżkę dostosuj do projektu

type UpcomingCard = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  occurrenceDate: string;
  startTime: string;
  endTime: string;
  isForBeginners: boolean;
  attractionKind: AttractionKind;
  coverUrl: string;
};

const SMALL_BP = 767;

@Component({
  selector: 'app-upcoming-events',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './upcoming-events.component.html',
  styleUrls: ['./upcoming-events.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class UpcomingEventsComponent implements OnInit, OnDestroy {
  private readonly events = inject(EventService);
  private readonly images = inject(ImageStorageService);
  private readonly platform = inject(PlatformService);

  private readonly destroy$ = new Subject<void>();

  readonly upcomingEvents = signal<UpcomingCard[]>([]);
  readonly isSmallScreen = signal<boolean>(false);
  readonly swiperLoop = computed(() => this.upcomingEvents().length > 1);

  readonly isBrowser = this.platform.isBrowser;

  ngOnInit(): void {
    if (this.platform.isBrowser) {
      register();
      const win = this.platform.getWindow();
      if (win) {
        this.isSmallScreen.set(win.innerWidth <= SMALL_BP);
        fromEvent(win, 'resize')
          .pipe(
            startWith(null),
            map(() => win.innerWidth <= SMALL_BP),
            takeUntil(this.destroy$)
          )
          .subscribe((isSm) => this.isSmallScreen.set(isSm));
      }
    }

    const todayIso = this.toYmd(new Date());
    const horizonIso = this.toYmd(addDays(new Date(), 60));

    this.events.getAllActive().subscribe({
      next: (rows) => {
        const occurrences = rows.flatMap((ev) =>
          this.nextOccurrencesFor(ev, todayIso, horizonIso).map((d) =>
            this.toCard(ev, d)
          )
        );
        occurrences.sort((a, b) => {
          const aDt = parseISO(`${a.occurrenceDate}T${a.startTime}`);
          const bDt = parseISO(`${b.occurrenceDate}T${b.startTime}`);
          return aDt.getTime() - bDt.getTime();
        });
        this.upcomingEvents.set(occurrences.slice(0, 3));
      },
      error: (err) =>
        console.error('Nie udało się pobrać nadchodzących wydarzeń', err),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private nextOccurrencesFor(
    ev: EventFull,
    fromIso: string,
    toIso: string
  ): string[] {
    const out = this.events.listOccurrencesFE(ev, fromIso, toIso);
    const from = parseISO(fromIso);
    return out.filter((d) => {
      const day = parseISO(d);
      return isAfter(day, from) || isEqual(day, from);
    });
  }

  private toCard(ev: EventFull, dateIso: string): UpcomingCard {
    const coverUrl = ev.coverImagePath
      ? this.images.getOptimizedPublicUrl(ev.coverImagePath, 800, 450)
      : '/images/placeholders/event-800x450.png';
    return {
      id: ev.id,
      slug: ev.slug,
      name: ev.name,
      shortDescription: ev.shortDescription ?? '',
      occurrenceDate: dateIso,
      startTime: ev.startTime?.slice(0, 8) ?? '00:00:00',
      endTime: ev.endTime?.slice(0, 8) ?? '23:59:00',
      isForBeginners: !!ev.isForBeginners,
      attractionKind: ev.attractionType as AttractionKind,
      coverUrl,
    };
  }

  getAttractionLabel(kind: AttractionKind): string {
    return AttractionKindLabel[kind] ?? kind;
  }

  detailsLink(item: UpcomingCard): any[] {
    return ['/events', item.slug];
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  trackBySlugDate = (e: UpcomingCard) => `${e.slug}|${e.occurrenceDate}`;
}
