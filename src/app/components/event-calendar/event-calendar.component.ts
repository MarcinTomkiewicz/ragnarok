import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { EventListComponent } from '../../common/event-list/event-list.component';
import { FilterOperator } from '../../core/enums/filterOperator';
import { EventData } from '../../core/interfaces/i-event';
import { BackendService } from '../../core/services/backend/backend.service';
import { EventsService } from '../../core/services/events/events.service';

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
  private readonly eventsService = inject(EventsService)

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
        this.recurringEvents = this.eventsService.processRecurringEvents(recurring, today);
        this.singleEvents = single;
      }
      
    );    
  }
}
