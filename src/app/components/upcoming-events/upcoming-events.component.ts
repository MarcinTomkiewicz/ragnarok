import { Component, inject } from '@angular/core';
import { EventsService } from '../../core/services/events/events.service';
import { EventData } from '../../core/interfaces/i-event';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-upcoming-events',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './upcoming-events.component.html',
  styleUrl: './upcoming-events.component.scss'
})
export class UpcomingEventsComponent {
  private readonly eventsService = inject(EventsService);

  upcomingEvents: EventData[] = [];

  ngOnInit(): void {
    this.eventsService.getUpcomingEvents(3).subscribe({
      next: (events) => (this.upcomingEvents = events),
      error: (err) => console.error('Nie udało się pobrać nadchodzących wydarzeń', err),
    });
  }
}
