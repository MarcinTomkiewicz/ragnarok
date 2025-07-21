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

  private readonly eventsService = inject(EventsService);
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.seo.setTitleAndMeta('Kalendarz Wydarzeń');

    const today = new Date().toISOString().split('T')[0];

    this.eventsService.getRecurringEvents().subscribe({
      next: (recurring) => {
        console.log('Pobrano cykliczne wydarzenia:', recurring);
        
        this.recurringEvents = this.eventsService.processRecurringEvents(recurring, today, 1);
      },
      error: (err) => console.error('Błąd podczas pobierania cyklicznych wydarzeń:', err),
    });

    this.eventsService.getSingleEvents().subscribe({
      next: (single) => {
        this.singleEvents = single.filter(e => e.eventDate >= today);
      },
      error: (err) => console.error('Błąd podczas pobierania jednorazowych wydarzeń:', err),
    });
  }
}
