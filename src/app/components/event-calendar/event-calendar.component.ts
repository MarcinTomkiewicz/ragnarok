import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { EventListComponent } from '../../common/event-list/event-list.component';
import { FilterOperator } from '../../core/enums/filterOperator';
import { EventData } from '../../core/interfaces/i-event';
import { BackendService } from '../../core/services/backend/backend.service';
import { EventsService } from '../../core/services/events/events.service';
import { SeoService } from '../../core/services/seo/seo.service';

@Component({
  selector: 'app-event-calendar',
  standalone: true,
  imports: [CommonModule, EventListComponent],
  templateUrl: './event-calendar.component.html',
  styleUrl: './event-calendar.component.scss',
})
export class EventCalendarComponent implements OnInit {
  recurringEvents: EventData[] = [];
  singleEvents: EventData[] = [];

  private readonly backendService = inject(BackendService);
  private readonly eventsService = inject(EventsService);
  private readonly seo = inject(SeoService);

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];

    const recurringEvents$ = this.backendService.getAll<EventData>(
      'events',
      'eventDate',
      'asc',
      {
        filters: {
          isActive: { value: true, operator: FilterOperator.EQ },
          isRecurring: { value: true, operator: FilterOperator.EQ },
        },
      }
    );

    const singleEvents$ = this.backendService.getAll<EventData>(
      'events',
      'eventDate',
      'asc',
      {
        filters: {
          isActive: { value: true, operator: FilterOperator.EQ },
          isRecurring: { value: false, operator: FilterOperator.EQ },
          eventDate: { value: today, operator: FilterOperator.GTE },
        },
      }
    );

    forkJoin({
      recurringEvents: recurringEvents$,
      singleEvents: singleEvents$,
    }).subscribe({
      next: ({ recurringEvents, singleEvents }) => {
        this.recurringEvents = this.eventsService.processRecurringEvents(recurringEvents, today);
        this.singleEvents = singleEvents;
      },
      error: (err) => console.error('Błąd podczas pobierania wydarzeń:', err),
      complete: () => console.log('Wszystkie wydarzenia zostały pobrane'),
    });
    this.seo.setTitleAndMeta('Kalendarz Wydarzeń');
  }
}
