import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class GmService {
  private readonly supabase: SupabaseClient = inject(SupabaseService).getClient();

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
