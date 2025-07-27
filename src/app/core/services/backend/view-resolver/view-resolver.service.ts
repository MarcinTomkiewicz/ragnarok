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
    const handlers: Record<string, () => Observable<T | null>> = {
      club_memberships: () => this.resolveClubMembership<T>(slug),
      offer_pages: () => this.resolveOfferPage<T>(slug),
    };

    const handler = handlers[table];
    return handler ? handler() : this.resolveDefault<T>(table, slug);
  }

  private resolveClubMembership<T>(slug: string): Observable<T | null> {
    return from(
      this.supabase
        .from('club_memberships')
        .select('*, membership_perks(*)')
        .eq('slug', slug)
        .single()
    ).pipe(
      map((res) => {
        if (res.error) throw new Error(res.error.message);
        return res.data ? toCamelCase<T>(res.data) : null;
      })
    );
  }

  private resolveOfferPage<T>(slug: string): Observable<T | null> {
    return from(
      this.supabase.from('offer_pages').select('*').eq('slug', slug).single()
    ).pipe(
      switchMap((res) => {
        if (res.error) throw new Error(res.error.message);
        const data = res.data
          ? this.imageService.processImage(res.data)
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
          map((itemsRes) => {
            if (itemsRes.error) throw new Error(itemsRes.error.message);

            const itemsMap = new Map(
              (itemsRes.data || []).map((item) => [
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

  private resolveDefault<T>(table: string, slug: string): Observable<T | null> {
    return from(
      this.supabase.from(table).select('*').eq('slug', slug).single()
    ).pipe(
      map((res) => {
        if (res.error) throw new Error(res.error.message);
        return res.data
          ? toCamelCase<T>(this.imageService.processImage(res.data))
          : null;
      })
    );
  }
}
