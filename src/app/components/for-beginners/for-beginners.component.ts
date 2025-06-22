import {
  Component,
  signal,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventsService } from '../../core/services/events/events.service';
import { RouterModule } from '@angular/router';
import { EventData } from '../../core/interfaces/i-event';
import { HighlightComponent } from '../../common/highlight/highlight.component';

@Component({
  selector: 'app-for-beginners',
  standalone: true,
  imports: [CommonModule, RouterModule, HighlightComponent],
  templateUrl: './for-beginners.component.html',
  styleUrls: ['./for-beginners.component.scss'],
})
export class ForBeginnersComponent implements OnInit {
  private eventsService = inject(EventsService);

  private allRecurringEvents = signal<EventData[]>([]);

  courseHighlightData = {
    heading: 'Nauka gry w RPG',
    text: 'Chcesz zacząć swoją przygodę z RPG? Nasz kurs "Nauka gry w RPG" to idealna okazja, aby poznać wszystkie aspekty gier fabularnych – od mechaniki, przez tworzenie postaci, aż po rozegranie własnych sesji. Dołącz do nas i wejdź do świata RPG z pomocą doświadczonych Mistrzów Gry!',
    link: '/special/1',
    linkText: 'Zobacz szczegóły',
    icon: 'bi bi-book-half'
  };
  
    studentsHighlightData = {
    heading: 'Między nami studentami',
    text: 'W każdy poniedziałek oferujemy 50% zniżki na wynajem salek – idealna okazja, żeby przetestować nowe systemy lub spróbować RPG po raz pierwszy!',
    link: '/event/4',
    linkText: 'Zobacz szczegóły',
    icon: 'bi bi-star-fill' // Ikona związana ze zniżkami dla studentów
  };

  eventsForBeginners = computed(() =>
    this.allRecurringEvents().filter((e) => e.isForBeginners)
  );

  ngOnInit() {
    this.loadEvents();
  }

  private loadEvents() {
    this.eventsService.getRecurringEvents().subscribe((events) => {
      this.allRecurringEvents.set(events);
    });
  }
}
