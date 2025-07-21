import { Injectable } from '@angular/core';
import { EventData } from '../../interfaces/i-event';
import { inject } from '@angular/core';
import { BackendService } from '../backend/backend.service';
import { Observable, forkJoin, map } from 'rxjs';
import { FilterOperator } from '../../enums/filterOperator';

@Injectable({
  providedIn: 'root',
})
export class EventsService {
  private backendService = inject(BackendService);

  getRecurringEvents(): Observable<EventData[]> {
    return this.backendService.getAll<EventData>('events', 'eventDate', 'asc', {
      filters: {
        isActive: { value: true, operator: FilterOperator.EQ },
        isRecurring: { value: true, operator: FilterOperator.EQ },
      },
    });
  }

  getSingleEvents(): Observable<EventData[]> {
    return this.backendService.getAll<EventData>('events', 'eventDate', 'asc', {
      filters: {
        isActive: { value: true, operator: FilterOperator.EQ },
        isRecurring: { value: false, operator: FilterOperator.EQ },
      },
    });
  }

  getUpcomingEvents(limit = 3): Observable<EventData[]> {
    const today = new Date().toISOString().split('T')[0];

    const recurring$ = this.getRecurringEvents();
    const single$ = this.backendService.getAll<EventData>('events', 'eventDate', 'asc', {
      filters: {
        isActive: { value: true, operator: FilterOperator.EQ },
        isRecurring: { value: false, operator: FilterOperator.EQ },
        eventDate: { value: today, operator: FilterOperator.GTE },
      },
    });

    return forkJoin([recurring$, single$]).pipe(
      map(([recurring, single]) => {
        const processedRecurring = this.processRecurringEvents(recurring, today);
        const all = [...single, ...processedRecurring];
        return all
          .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
          .slice(0, limit);
      })
    );
  }

  processRecurringEvents(events: EventData[], today: string): EventData[] {
    const recurring = events
      .map((event) => {
        const nextEventDate = this.calculateNextEventDate(
          event.eventDate,
          event.interval,
          today
        );
        return { ...event, eventDate: nextEventDate };
      })
      .sort(
        (a, b) =>
          new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      );

    return recurring;
  }

  processSingleEvent(event: EventData, today: string): EventData {
    const nextEventDate = this.calculateNextEventDate(event.eventDate, event.interval, today);
    return { ...event, eventDate: nextEventDate };
  }

  calculateNextEventDate(
    startDate: string,
    interval: number,
    today: string
  ): string {
    let nextDate = new Date(startDate);

    while (nextDate < new Date(today)) {
      nextDate.setDate(nextDate.getDate() + interval);
    }

    return nextDate.toISOString().split('T')[0];
  }
}
