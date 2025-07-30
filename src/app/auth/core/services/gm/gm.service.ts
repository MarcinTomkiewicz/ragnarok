import { Injectable, inject } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { toSnakeCase } from '../../../../core/utils/type-mappers';
import { IAvailabilitySlot } from '../../../../core/interfaces/i-gm-profile';

@Injectable({ providedIn: 'root' })
export class GmService {
  private readonly backend = inject(BackendService);
  private readonly supabase = inject(SupabaseService).getClient();

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
      'gm_id,date,hour'
    );
  }

  upsertMany(entries: IAvailabilitySlot[]): Observable<IAvailabilitySlot[]> {
    if (!entries.length) return of([]);

    const payload = entries.map((e) => toSnakeCase(e));
    return from(
      this.supabase
        .from('gm_availability')
        .upsert(payload, {
          onConflict: 'gm_id,date,hour',
        })
        .select('*')
    ).pipe(
      map((response) => {
        if (response.error) throw new Error(response.error.message);
        return response.data.map((e: any) => e as IAvailabilitySlot);
      })
    );
  }

  updateSpecialties(gmId: string, systemIds: string[]): Observable<void> {
    const delete$ = this.supabase
      .from('gm_specialties')
      .delete()
      .eq('gm_id', gmId);

    const insertPayload = systemIds.map((systemId) => ({
      gm_id: gmId,
      system_id: systemId,
    }));

    const insert$ = this.supabase.from('gm_specialties').insert(insertPayload);

    return from(delete$).pipe(
      switchMap((res) => {
        if (res.error) throw new Error(res.error.message);
        return from(insert$);
      }),
      map((res) => {
        if (res.error) throw new Error(res.error.message);
      })
    );
  }
}
