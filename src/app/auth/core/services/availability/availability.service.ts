import { Injectable, inject } from '@angular/core';
import { Observable, of, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { IAvailabilitySlot, WorkType } from '../../../../core/interfaces/i-availability-slot';
import { toSnakeCase } from '../../../../core/utils/type-mappers';

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly backend = inject(BackendService);
  private readonly table = 'user_availability';

  getAvailability(userId: string, dates: string[], workType: WorkType): Observable<IAvailabilitySlot[]> {
    if (!dates.length) return of([]);
    return this.backend.getAll<IAvailabilitySlot>(this.table, undefined, 'asc', {
      filters: {
        userId:   { value: userId,   operator: FilterOperator.EQ },
        date:     { value: dates,    operator: FilterOperator.IN },
        workType: { value: workType, operator: FilterOperator.EQ },
      },
    });
  }

  getOneForDay(userId: string, date: string, workType: WorkType): Observable<IAvailabilitySlot | null> {
    return this.backend.getOneByFields<IAvailabilitySlot>(this.table, { userId, date, workType });
  }

  upsert(entry: IAvailabilitySlot): Observable<IAvailabilitySlot> {
    return this.backend.upsert<IAvailabilitySlot>(this.table, toSnakeCase(entry), 'user_id,date,work_type');
  }

  upsertMany(entries: IAvailabilitySlot[]): Observable<IAvailabilitySlot[]> {
    if (!entries.length) return of([]);
    const withId    = entries.filter(e => !!e.id).map(toSnakeCase);
    const withoutId = entries.filter(e => !e.id).map(({ id, ...rest }) => toSnakeCase(rest));
    const reqs: Observable<IAvailabilitySlot[]>[] = [];
    if (withId.length)    reqs.push(this.backend.upsertMany<IAvailabilitySlot>(this.table, withId as any, 'id'));
    if (withoutId.length) reqs.push(this.backend.upsertMany<IAvailabilitySlot>(this.table, withoutId as any, 'user_id,date,work_type'));
    return (reqs.length === 1 ? reqs[0] : combineLatest(reqs).pipe(map(r => r.flat())));
  }

  delete(userId: string, dates: string[], workType: WorkType): Observable<void> {
    if (!dates.length) return of();
    return this.backend.delete(this.table, {
      user_id:  { value: userId,   operator: FilterOperator.EQ },
      date:     { value: dates,    operator: FilterOperator.IN },
      work_type:{ value: workType, operator: FilterOperator.EQ },
    });
  }
}
