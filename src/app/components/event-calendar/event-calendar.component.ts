import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { map, shareReplay } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EventListComponent } from '../../common/event-list/event-list.component';
import { LoaderComponent } from '../../common/loader/loader.component';

import { SeoService } from '../../core/services/seo/seo.service';
import { formatYmdLocal } from '../../core/utils/weekday-options';
import { EventService } from '../../core/services/event/event.service';

@Component({
  selector: 'app-event-calendar',
  standalone: true,
  imports: [CommonModule, EventListComponent, LoaderComponent],
  templateUrl: './event-calendar.component.html',
  styleUrl: './event-calendar.component.scss',
})
export class EventCalendarComponent implements OnInit {
  private readonly eventsService = inject(EventService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly today = formatYmdLocal(new Date());

  /** Local loading gate for the section. */
  readonly loading = signal(true);

  private readonly all$ = this.eventsService.getAllActive().pipe(
    // cache the first successful emission
    shareReplay({ bufferSize: 1, refCount: true })
  );

  recurringEvents$ = this.all$.pipe(
    map(list => list.filter(e => !!e.recurrence))
  );

  singleEvents$ = this.all$.pipe(
    map(list =>
      list
        .filter(e => !!e.singleDate && e.singleDate! >= this.today)
        .sort((a, b) => {
          const da = a.singleDate!, db = b.singleDate!;
          if (da < db) return -1;
          if (da > db) return 1;
          return (a.startTime ?? '').localeCompare(b.startTime ?? '');
        })
    )
  );

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Kalendarz Wydarzeń');

    // Mark loaded on first emission (or error) of all$
    this.all$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      });
  }
}
