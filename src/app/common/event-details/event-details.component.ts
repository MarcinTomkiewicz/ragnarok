import { Component, inject, OnInit } from '@angular/core';
import { EventData } from '../../core/interfaces/i-event';
import { BackendService } from '../../core/services/backend/backend.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.scss'
})
export class EventDetailsComponent implements OnInit{
  eventData?: EventData;
  errorMessage: string | null = null;

  private readonly backendService = inject(BackendService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.backendService.getById<EventData>('events', id).subscribe({
        next: (event) => {
          if (event) {
            this.eventData = event;
          } else {
            this.errorMessage = 'Wydarzenie nie zostało znalezione.';
          }
        },
        error: (err) => {
          console.error('Błąd przy pobieraniu wydarzenia:', err);
          this.errorMessage = 'Wystąpił błąd podczas pobierania danych wydarzenia.';
        },
        complete: () => console.log('Pobieranie wydarzenia zakończone.')
      });
    } else {
      this.errorMessage = 'Brak identyfikatora wydarzenia w adresie URL.';
    }
  }
}
