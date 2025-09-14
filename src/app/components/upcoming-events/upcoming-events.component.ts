import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { addDays, parseISO, isAfter, isEqual } from 'date-fns';

import { EventService } from '../../core/services/event/event.service';
import { ImageStorageService } from '../../core/services/backend/image-storage/image-storage.service';
import { EventFull } from '../../core/interfaces/i-events';
import { AttractionKind, AttractionKindLabel } from '../../core/enums/events';
import { CardCarouselComponent } from '../../common/card-carousel/card-carousel.component';

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

@Component({
  selector: 'app-upcoming-events',
  standalone: true,
  imports: [RouterLink, CommonModule, CardCarouselComponent],
  templateUrl: './upcoming-events.component.html',
  styleUrl: './upcoming-events.component.scss',
})
export class UpcomingEventsComponent {
  private readonly events = inject(EventService);
  private readonly images = inject(ImageStorageService);

  upcomingEvents: UpcomingCard[] = [];

  ngOnInit(): void {
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
        this.upcomingEvents = occurrences.slice(0, 3);
      },
      error: (err) =>
        console.error('Nie udało się pobrać nadchodzących wydarzeń', err),
    });
  }

  private nextOccurrencesFor(ev: EventFull, fromIso: string, toIso: string): string[] {
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
