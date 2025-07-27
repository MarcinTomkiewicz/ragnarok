import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, of, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SupabaseService } from '../../supabase/supabase.service';
import { ImageStorageService } from '../image-storage/image-storage.service';
import { toCamelCase } from '../../../utils/type-mappers';

@Injectable({ providedIn: 'root' })
export class ViewResolverService {
  private readonly supabase: SupabaseClient = inject(SupabaseService).getClient();
  private readonly imageService = inject(ImageStorageService);

  resolveBySlug<T>(table: string, slug: string): Observable<T | null> {
    if (table === 'club_memberships') {
      return from(
        this.supabase
          .from(table)
          .select('*, membership_perks(*)')
          .eq('slug', slug)
          .single()
      ).pipe(
        map((response) => {
          if (response.error) throw new Error(response.error.message);
          return response.data ? toCamelCase<T>(response.data) : null;
        })
      );
    }

    if (table === 'offer_pages') {
      return from(
        this.supabase.from(table).select('*').eq('slug', slug).single()
      ).pipe(
        switchMap((response) => {
          if (response.error) throw new Error(response.error.message);
          const data = response.data
            ? this.imageService.processImage(response.data)
            : null;

          if (!data?.sections?.length) {
            return of(toCamelCase<T>(data));
          }

          const allIds = data.sections.flatMap((s: any) =>
            Array.isArray(s.services) ? s.services : []
          );
          const uniqueIds = [...new Set(allIds)];

          return from(
            this.supabase.from('offer_items').select('*').in('id', uniqueIds)
          ).pipe(
            map((itemsResponse) => {
              if (itemsResponse.error) throw new Error(itemsResponse.error.message);
              const itemsMap = new Map(
                (itemsResponse.data || []).map((item) => [
                  item.id,
                  toCamelCase(item),
                ])
              );

              const resolvedSections = data.sections.map((s: any) => ({
                ...s,
                services: (s.services || [])
                  .map((id: number) => itemsMap.get(id))
                  .filter(Boolean),
              }));

              return toCamelCase<T>({ ...data, sections: resolvedSections });
            })
          );
        })
      );
    }

    // Default fetch
    return from(
      this.supabase.from(table).select('*').eq('slug', slug).single()
    ).pipe(
      map((response) => {
        if (response.error) throw new Error(response.error.message);
        return response.data ? toCamelCase<T>(response.data) : null;
      })
    );
  }
}
