import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { IExternalEventDef } from '../../../../core/interfaces/i-external-event-def';
import { FilterOperator } from '../../../../core/enums/filterOperator';


@Injectable({ providedIn: 'root' })
export class ExternalEventsService {
  private readonly backend = inject(BackendService);
  private readonly table = 'external_event_def';

  getActiveForWeekdays(weekdays: number[]): Observable<IExternalEventDef[]> {
    if (!weekdays.length) return of([]);
    return this.backend.getAll<IExternalEventDef>(this.table, undefined, 'asc', {
      filters: {
        active: { operator: FilterOperator.EQ, value: true },
        weekday: { operator: FilterOperator.IN, value: weekdays },
      },
    });
  }

  getAllActive(): Observable<IExternalEventDef[]> {
    return this.backend.getAll<IExternalEventDef>(this.table, 'weekday', 'asc', {
      filters: { active: { operator: FilterOperator.EQ, value: true } },
    });
  }
}
