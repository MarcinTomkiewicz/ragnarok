import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { EventFull } from '../../../core/interfaces/i-events';
import { EventService } from '../../../core/services/event/event.service';
import { formatYmdLocal } from '../../../core/utils/weekday-options';
import {
  AttractionKindLabel,
  HostSignupScopeLabel,
} from '../../../core/enums/events';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

type ViewMode = 'tabs' | 'accordion';

@Component({
  selector: 'app-events-admin-list',
  standalone: true,
  imports: [CommonModule, NgbAccordionModule],
  templateUrl: './events-admin-list.component.html',
  styleUrls: ['./events-admin-list.component.scss'],
})
export class EventsAdminListComponent {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);

  AttractionKindLabel = AttractionKindLabel;
  HostSignupScopeLabel = HostSignupScopeLabel;

  readonly eventsSig = toSignal(
    this.eventService
      .getAllActive()
      .pipe(map((list) => list.sort((a, b) => a.name.localeCompare(b.name)))),
    { initialValue: [] as EventFull[] }
  );

  // tryb widoku
  readonly viewMode = signal<ViewMode>('tabs');
  setViewMode(m: ViewMode) {
    if (this.viewMode() !== m) this.viewMode.set(m);
  }

  // wybór eventu (dla trybu "tabs")
  private readonly selectedSlug = signal<string | null>(null);
  readonly selected = computed<EventFull | null>(() => {
    const list = this.eventsSig();
    if (!list.length) return null;
    const slug = this.selectedSlug() ?? list[0]?.slug ?? null;
    return list.find((e) => e.slug === slug) ?? null;
  });

  private rangeFromTo() {
    const now = new Date();
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastThis = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const firstNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastNext = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return {
      thisFrom: formatYmdLocal(firstThis),
      thisTo: formatYmdLocal(lastThis),
      nextFrom: formatYmdLocal(firstNext),
      nextTo: formatYmdLocal(lastNext),
    };
  }

  // occurrences dla aktualnie wybranego (tabs)
  readonly occurrencesThisMonth = computed<string[]>(() => {
    const ev = this.selected();
    if (!ev) return [];
    const { thisFrom, thisTo } = this.rangeFromTo();
    return this.eventService.listOccurrencesFE(ev, thisFrom, thisTo);
  });

  readonly occurrencesNextMonth = computed<string[]>(() => {
    const ev = this.selected();
    if (!ev) return [];
    const { nextFrom, nextTo } = this.rangeFromTo();
    return this.eventService.listOccurrencesFE(ev, nextFrom, nextTo);
  });

  // occurrences dla konkretnego eventu (accordion) – bez zapisywania w signals
  listOccurrences(ev: EventFull, which: 'this' | 'next'): string[] {
    const { thisFrom, thisTo, nextFrom, nextTo } = this.rangeFromTo();
    return which === 'this'
      ? this.eventService.listOccurrencesFE(ev, thisFrom, thisTo)
      : this.eventService.listOccurrencesFE(ev, nextFrom, nextTo);
  }

  pickEvent(slug: string) {
    this.selectedSlug.set(slug);
  }

  goSignup(dateIso: string) {
    const ev = this.viewMode() === 'tabs' ? this.selected() : null;
    const slug = ev?.slug ?? this.selectedSlug() ?? null;
    const resolvedSlug = slug ?? this.eventsSig()[0]?.slug;
    if (!resolvedSlug) return;
    this.router.navigate([
      '/auth/events',
      resolvedSlug,
      'host-signup',
      dateIso,
    ]);
  }

  goSignupFor(slug: string, dateIso: string) {
    if (!slug) return;
    this.router.navigate(['/auth/events', slug, 'host-signup', dateIso]);
  }

  goEdit() {
    const ev = this.viewMode() === 'tabs' ? this.selected() : null;
    const slug = ev?.slug ?? this.selectedSlug() ?? this.eventsSig()[0]?.slug;
    if (!slug) return;
    this.router.navigate(['/auth/events', slug, 'edit']);
  }
}
