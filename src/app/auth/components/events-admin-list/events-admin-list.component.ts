import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { EventFull } from '../../../core/interfaces/i-events';
import { EventService } from '../../../core/services/event/event.service';
import { formatYmdLocal } from '../../../core/utils/weekday-options';
import { AttractionKindLabel, HostSignupScopeLabel } from '../../../core/enums/events';

@Component({
  selector: 'app-events-admin-list',
  standalone: true,
  imports: [CommonModule],
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

  selectedSlug = signal<string | null>(null);
  selected = computed<EventFull | null>(() => {
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

  occurrencesThisMonth = computed<string[]>(() => {
    const ev = this.selected();
    if (!ev) return [];
    const { thisFrom, thisTo } = this.rangeFromTo();
    return this.eventService.listOccurrencesFE(ev, thisFrom, thisTo);
  });

  occurrencesNextMonth = computed<string[]>(() => {
    const ev = this.selected();
    if (!ev) return [];
    const { nextFrom, nextTo } = this.rangeFromTo();
    return this.eventService.listOccurrencesFE(ev, nextFrom, nextTo);
  });

  trackBySlug(_i: number, e: EventFull) {
    return e.slug;
  }
  trackByDate(_i: number, d: string) {
    return d;
  }

  pickEvent(slug: string) {
    this.selectedSlug.set(slug);
  }

  goSignup(dateIso: string) {
    const ev = this.selected();
    if (!ev) return;
    this.router.navigate(['/auth/events', ev.slug, 'host-signup', dateIso]);
  }

  goEdit() {
    const ev = this.selected();
    if (!ev) return;
    this.router.navigate(['/auth/events', ev.slug, 'edit']);
  }
}
