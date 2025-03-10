import { Injectable } from '@angular/core';
import { EventData } from '../../interfaces/i-event';

@Injectable({
  providedIn: 'root',
})
export class EventsService {
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
