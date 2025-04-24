import { Component, inject, OnInit } from '@angular/core';
import { EventData } from '../../core/interfaces/i-event';
import { BackendService } from '../../core/services/backend/backend.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EventsService } from '../../core/services/events/events.service';
import { SeoService } from '../../core/services/seo/seo.service';
import { NgbAlertModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [CommonModule, NgbAlertModule],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.scss',
})
export class EventDetailsComponent implements OnInit {
  eventData?: EventData;
  errorMessage: string | null = null;
  today = new Date().toISOString().split('T')[0]

  private readonly backendService = inject(BackendService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventsService = inject(EventsService);
    private readonly seo = inject(SeoService);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.backendService.getById<EventData>('events', id).subscribe({
        next: (event) => {
          if (event) {
            this.eventData = event.isRecurring ? this.eventsService.processSingleEvent(event, this.today) : event;
            this.seo.setTitleAndMeta(`${this.eventData?.name}`);
          } else {
            this.errorMessage = 'Wydarzenie nie zostało znalezione.';
          }
        },
        error: (err) => {
          console.error('Błąd przy pobieraniu wydarzenia:', err);
          this.errorMessage =
            'Wystąpił błąd podczas pobierania danych wydarzenia.';
        },
        complete: () => console.log('Pobieranie wydarzenia zakończone.'),
      });
    } else {
      this.errorMessage = 'Brak identyfikatora wydarzenia w adresie URL.';
    }
  }

  openFacebook(link: string) {
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  }
}