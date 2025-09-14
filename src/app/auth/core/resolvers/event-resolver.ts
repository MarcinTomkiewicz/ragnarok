import { Injectable, inject } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { EventFull } from '../../../core/interfaces/i-events';
import { EventService } from '../../../core/services/event/event.service';

@Injectable({ providedIn: 'root' })
export class EventResolver implements Resolve<EventFull | null> {
  private readonly events = inject(EventService);
  resolve(route: ActivatedRouteSnapshot): Observable<EventFull | null> {
    const slug = route.paramMap.get('slug') || '';
    if (!slug) return of(null);
    return this.events.getBySlug(slug);
  }
}
