import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EventFull } from '../../core/interfaces/i-events';
import { formatYmdLocal } from '../../core/utils/weekday-options';
import { EventService } from '../../core/services/event/event.service';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.scss',
})
export class EventListComponent {
  events = input<EventFull[]>([]);
  recurring = input<boolean>(false);

  private readonly eventSvc = inject(EventService);
  private readonly todayIso = formatYmdLocal(new Date());

  rows = computed(() =>
    (this.events() ?? [])
      .map(ev => {
        const dateIso = this.recurring()
          ? this.nextOccurrenceIso(ev, this.todayIso)
          : (ev.singleDate ?? null);
        if (!dateIso) return null;

        return {
          key: `${ev.slug}|${dateIso}`,
          dateIso,
          time: (ev.startTime ?? '00:00:00').slice(0, 8),
          ev,
        };
      })
      .filter((x): x is { key: string; dateIso: string; time: string; ev: EventFull } => !!x)
      .sort((a, b) => (a.dateIso === b.dateIso ? a.time.localeCompare(b.time) : a.dateIso.localeCompare(b.dateIso)))
  );

  private nextOccurrenceIso(ev: EventFull, fromIso: string): string | null {
    const until =
      ev.singleDate ??
      ev.recurrence?.endDate ??
      formatYmdLocal(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));

    const dates = this.eventSvc.listOccurrencesFE(ev, fromIso, until);
    return dates.length ? dates[0] : null;
  }

  isAllDay = (time: string) => time === '00:00:00';
}
