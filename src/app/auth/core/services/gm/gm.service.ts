import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { toSnakeCase } from '../../../../core/utils/type-mappers';
import { IAvailabilitySlot } from '../../../../core/interfaces/i-gm-profile';

@Injectable({ providedIn: 'root' })
export class GmService {
  private readonly backend = inject(BackendService);

  getAvailability(
    gmId: string,
    dates: string[]
  ): Observable<IAvailabilitySlot[]> {
    if (!dates.length) return of([]);

    return this.backend.getAll<IAvailabilitySlot>(
      'gm_availability',
      undefined,
      'asc',
      {
        filters: {
          gmId: { value: gmId, operator: FilterOperator.EQ },
          date: { value: dates, operator: FilterOperator.IN },
        },
      }
    );
  }

  upsertAvailability(entry: IAvailabilitySlot): Observable<IAvailabilitySlot> {
    return this.backend.upsert<IAvailabilitySlot>(
      'gm_availability',
      toSnakeCase(entry),
      'gm_id,date'
    );
  }

  upsertMany(entries: IAvailabilitySlot[]): Observable<IAvailabilitySlot[]> {
    if (!entries.length) return of([]);

    const withId = entries.filter((e) => !!e.id);
    const withoutId = entries.filter((e) => !e.id);

    const requests: Observable<IAvailabilitySlot[]>[] = [];

    // Rekordy z ID – upsert po ID
    if (withId.length) {
      const withIdPayload = withId.map((e) => toSnakeCase(e));
      requests.push(
        this.backend.upsertMany<IAvailabilitySlot>(
          'gm_availability',
          toSnakeCase(withIdPayload),
          'id'
        )
      );
    }

    // Rekordy bez ID – usuń ID i upsert po gm_id,date
    if (withoutId.length) {
      const withoutIdPayload = withoutId.map((entry) => {
        const { id, ...rest } = entry;
        return toSnakeCase(rest);
      });

      requests.push(
        this.backend.upsertMany<IAvailabilitySlot>(
          'gm_availability',
          toSnakeCase(withoutIdPayload),
          'gm_id,date'
        )
      );
    }

    return requests.length === 1
      ? requests[0]
      : forkJoin(requests).pipe(map((results) => results.flat()));
  }

  deleteAvailability(gmId: string, dates: string[]): Observable<void> {
    if (!dates.length) return of();

    return this.backend.delete('gm_availability', {
      gm_id: { value: gmId, operator: FilterOperator.EQ },
      date: { value: dates, operator: FilterOperator.IN },
    });
  }

  updateSpecialties(gmId: string, systemIds: string[]): Observable<void> {
    const table = 'gm_specialties';

    const delete$ = this.backend.delete(table, { gm_id: gmId });

    const insertPayload = systemIds.map((systemId) =>
      toSnakeCase({ gmId, systemId })
    );

    const insert$ = systemIds.length
      ? this.backend.createMany(table, insertPayload)
      : of([]);

    return delete$.pipe(
      switchMap(() => insert$),
      map(() => {})
    );
  }
}
