import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { EventListComponent } from '../../common/event-list/event-list.component';
import { FilterOperator } from '../../core/enums/filterOperator';
import { EventData } from '../../core/interfaces/i-event';
import { BackendService } from '../../core/services/backend/backend.service';

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

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0]; 
    const recurringEvents$ = this.backendService.getAll<EventData>(
      'events',
      'eventDate',
      'asc',
      undefined,
      undefined,
      {
        isActive: { value: true, operator: FilterOperator.EQ },
        isRecurring: { value: true, operator: FilterOperator.EQ },
        // eventDate: { value: today, operator: FilterOperator.GTE },
      }
    );

    const singleEvents$ = this.backendService.getAll<EventData>(
      'events',
      'eventDate',
      'asc',
      undefined,
      undefined,
      {
        isActive: { value: true, operator: FilterOperator.EQ },
        isRecurring: { value: false, operator: FilterOperator.EQ },
        eventDate: { value: today, operator: FilterOperator.GTE },
      }
    );

    forkJoin([recurringEvents$, singleEvents$]).subscribe(
      ([recurring, single]) => {
        this.recurringEvents = this.processRecurringEvents(recurring, today);
        this.singleEvents = single;
      }
      
    );    
  }

  private processRecurringEvents(events: EventData[], today: string): EventData[] {
    const recurring = events.map((event) => {
      const nextEventDate = this.calculateNextEventDate(event.eventDate, event.interval, today);
      return { ...event, eventDate: nextEventDate };
    }).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    
    return recurring;
  }

  // Oblicza najbliższą datę wydarzenia na podstawie eventDate oraz interval (liczba dni)
  private calculateNextEventDate(startDate: string, interval: number, today: string): string {
    let nextDate = new Date(startDate);
    
    // Sprawdzamy, czy początkowa data jest już po dzisiejszej, jeśli nie, dodajemy interwał
    while (nextDate < new Date(today)) {
      nextDate.setDate(nextDate.getDate() + interval); // Dodajemy interval dni
    }

    return nextDate.toISOString().split('T')[0]; // Zwracamy datę w formacie YYYY-MM-DD
  }
}
