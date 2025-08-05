import { inject, Injectable } from '@angular/core';
import {
  PostgrestResponse,
  PostgrestSingleResponse,
  SupabaseClient,
} from '@supabase/supabase-js';
import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { IFilter } from '../../interfaces/i-filters';
import { SupabaseService } from '../supabase/supabase.service';
import { toCamelCase, toSnakeKey } from '../../utils/type-mappers';
import { ImageStorageService } from './image-storage/image-storage.service';
import { applyFilters } from '../../utils/query';
import { FilterOperator } from '../../enums/filterOperator';

export interface IPagination {
  page?: number;
  pageSize?: number;
  filters?: { [key: string]: IFilter };
}

@Injectable({ providedIn: 'root' })
export class BackendService {
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly imageService = inject(ImageStorageService);

  getAll<T extends object>(
    table: string,
    sortBy?: keyof T,
    sortOrder: 'asc' | 'desc' = 'asc',
    pagination?: IPagination,
    imageConfig?: { width?: number; height?: number },
    joins?: string,
    processImages = true
  ): Observable<T[]> {
    let select = '*';
    if (joins) {
      select = `*, ${joins}`;
    }

    let query = this.supabase.from(table).select(select);
    query = applyFilters(query, pagination?.filters);

    if (sortBy) {
      const sortKey = toSnakeKey(sortBy as string);
      query = query.order(sortKey, { ascending: sortOrder === 'asc' });
    }

    if (pagination?.page !== undefined && pagination?.pageSize !== undefined) {
      const fromIndex = (pagination.page - 1) * pagination.pageSize;
      const toIndex = fromIndex + pagination.pageSize - 1;
      query = query.range(fromIndex, toIndex);
    } else {
      query = query.range(0, 999);
    }

    return from(query).pipe(
      map((response: PostgrestResponse<any>) => {
        if (response.error) throw new Error(response.error.message);
        return (response.data || []).map((item) => {
          const camel = toCamelCase<T>(item);
          return processImages
            ? this.imageService.processImage(
                camel,
                imageConfig?.width,
                imageConfig?.height
              )
            : camel;
        });
      })
    );
  }

  getById<T extends object>(
    table: string,
    id: string | number,
    width?: number,
    height?: number,
    processImages = true
  ): Observable<T | null> {
    return from(
      this.supabase.from(table).select('*').eq('id', id).single()
    ).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) throw new Error(response.error.message);
        const camel = response.data ? toCamelCase<T>(response.data) : null;
        return camel && processImages
          ? this.imageService.processImage(camel, width, height)
          : camel;
      })
    );
  }

  getByIds<T extends object>(table: string, ids: string[]): Observable<T[]> {
    if (!ids.length) return of([]);
    return this.getAll<T>(table, undefined, 'asc', {
      filters: {
        id: {
          operator: FilterOperator.IN,
          value: ids,
        },
      },
    });
  }

  getCount<T extends object>(
    table: string,
    filters?: { [key: string]: any }
  ): Observable<number> {
    let query = this.supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    query = applyFilters(query, filters);

    return from(query).pipe(
      map((response: PostgrestResponse<T>) => {
        if (response.error) throw new Error(response.error.message);
        return response.count ?? 0;
      })
    );
  }

  getOneByFields<T extends object>(
    table: string,
    filters: Record<string, any>
  ): Observable<T | null> {
    let query = this.supabase.from(table).select('*');

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(toSnakeKey(key), value);
    }

    return from(query.maybeSingle()).pipe(
      map((response: PostgrestSingleResponse<any>) => {
        if (response.error || !response.data) return null;
        return toCamelCase<T>(response.data);
      })
    );
  }

  create<T>(table: string, data: T): Observable<T> {
    return from(this.supabase.from(table).insert(data).single()).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) throw new Error(response.error.message);
        return response.data;
      })
    );
  }

  createMany<T>(table: string, data: T[]): Observable<T[]> {
    if (!data.length) return of([]);

    return from(this.supabase.from(table).insert(data).select('*')).pipe(
      map((response) => {
        if (response.error) throw new Error(response.error.message);
        return (response.data || []).map((item) => toCamelCase<T>(item));
      })
    );
  }

  update<T>(table: string, id: string | number, data: T): Observable<T> {
    return from(
      this.supabase.from(table).update(data).eq('id', id).single()
    ).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) throw new Error(response.error.message);
        return response.data;
      })
    );
  }

  upsert<T>(
    table: string,
    data: T,
    conflictTarget: string = 'id'
  ): Observable<T> {
    return from(
      this.supabase
        .from(table)
        .upsert(data, { onConflict: conflictTarget })
        .single()
    ).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) throw new Error(response.error.message);
        return response.data;
      })
    );
  }

  upsertMany<T>(
    table: string,
    data: T[],
    conflictTarget: string = 'id'
  ): Observable<T[]> {
    if (!data.length) return of([]);

    return from(
      this.supabase
        .from(table)
        .upsert(data, { onConflict: conflictTarget })
        .select()
    ).pipe(
      map((response: PostgrestResponse<T>) => {
        if (response.error) throw new Error(response.error.message);
        return (response.data || []).map((item) => toCamelCase<T>(item));
      })
    );
  }

  delete(
    table: string,
    filters: string | number | Record<string, any>
  ): Observable<void> {
    let query = this.supabase.from(table).delete();

    if (typeof filters === 'object') {
      query = applyFilters(query, filters);
    } else {
      query = query.eq('id', filters);
    }

    return from(query).pipe(
      map((response) => {
        if (response.error) throw new Error(response.error.message);
      })
    );
  }
}
