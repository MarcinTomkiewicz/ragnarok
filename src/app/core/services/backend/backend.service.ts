import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  SupabaseClient,
  PostgrestSingleResponse,
  PostgrestResponse,
} from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { FilterOperator } from '../../enums/filterOperator';
import { IFilter } from '../../interfaces/i-filters';

@Injectable({
  providedIn: 'root',
})
export class BackendService {
  private readonly supabase: SupabaseClient;
  private readonly supabaseService = inject(SupabaseService);

  constructor() {
    this.supabase = this.supabaseService.getClient();
  }

  /**
   * Pobiera wszystkie rekordy z wybranej tabeli.
   * @param table - Nazwa tabeli w Supabase
   * @returns Observable z listą rekordów
   */
  getAll<T extends { image?: string; imageURL?: string; }>(table: string, sortBy?: keyof T, sortOrder: 'asc' | 'desc' = 'asc', width?: number, height?: number, filters?: { [key: string]: IFilter }): Observable<T[]> {
    let query = this.supabase.from(table).select('*');
  
    query = this.applyFilters(query, filters);
  
    // Sortowanie
    if (sortBy) {
      query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });
    }
  
    return from(query).pipe(
      map((response: PostgrestResponse<T>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return (response.data || []).map((item) =>
          this.processImage(item, width, height)
        );
      })
    );
  }
  

  /**
   * Pobiera rekord według identyfikatora.
   * @param table - Nazwa tabeli w Supabase
   * @param id - ID rekordu
   * @returns Observable z rekordem
   */
  getById<T extends { image?: string; imageUrl?: string }>(
    table: string,
    id: string | number,
    width?: number,
    height?: number
  ): Observable<T | null> {
    return from(
      this.supabase.from(table).select('*').eq('id', id).single()
    ).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }

        return response.data ? this.processImage(response.data) : null;
      })
    );
  }

  /**
   * Tworzy nowy rekord w wybranej tabeli.
   * @param table - Nazwa tabeli w Supabase
   * @param data - Dane do zapisania
   * @returns Observable z odpowiedzią od Supabase
   */
  create<T>(table: string, data: T): Observable<T> {
    return from(this.supabase.from(table).insert(data).single()).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      })
    );
  }

  /**
   * Aktualizuje rekord w wybranej tabeli.
   * @param table - Nazwa tabeli w Supabase
   * @param id - ID rekordu do zaktualizowania
   * @param data - Dane do aktualizacji
   * @returns Observable z odpowiedzią od Supabase
   */
  update<T>(table: string, id: string | number, data: T): Observable<T> {
    return from(
      this.supabase.from(table).update(data).eq('id', id).single()
    ).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      })
    );
  }

  /**
   * Usuwa rekord z wybranej tabeli.
   * @param table - Nazwa tabeli w Supabase
   * @param id - ID rekordu do usunięcia
   * @returns Observable<void>
   */
  delete(table: string, id: string | number): Observable<void> {
    return from(this.supabase.from(table).delete().eq('id', id)).pipe(
      map((response) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
      })
    );
  }

  /**
   * Metoda pomocnicza do przetwarzania obrazu.
   * Jeśli obiekt zawiera pole `image`, to pobiera publiczny URL z bucketu "images".
   * @param item - Obiekt z polem `image`
   * @returns Przetworzony obiekt z dodanym polem `imageUrl`
   */
  private processImage<T extends { image?: string; imageURL?: string }>(
    item: T,
    width: number = 600,
    height: number = 400
  ): T {
    if (item.image) {
      const { data } = this.supabase.storage
        .from('images')
        .getPublicUrl(item.image);

      item.imageURL =
        this.getOptimizedImageUrl(data.publicUrl, width, height) || '';
    }

    return item;
  }

  /**
   * Optymalizuje URL obrazu, zmieniając jego rozmiar i jakość w locie.
   * @param imageUrl - URL oryginalnego obrazu
   * @param width - Szerokość docelowa
   * @param height - Wysokość docelowa
   * @returns Zoptymalizowany URL obrazu
   */
  private getOptimizedImageUrl(
    imageUrl: string,
    width: number = 600,
    height: number = 400
  ): string {
    if (!imageUrl) return '';
    return `${imageUrl}?width=${width}&height=${height}`;
  }

  private applyFilters<T>(query: any, filters?: { [key: string]: IFilter }): any {
    if (filters) {
      for (const [key, filter] of Object.entries(filters)) {
        if (filter.value !== undefined) {
          const operator = filter.operator || FilterOperator.EQ; // Używamy domyślnego 'eq' jeśli operator nie jest podany
          switch (operator) {
            case FilterOperator.EQ:
              query = query.eq(key, filter.value);
              break;
            case FilterOperator.GTE:
              query = query.gte(key, filter.value);
              break;
            case FilterOperator.LTE:
              query = query.lte(key, filter.value);
              break;
            case FilterOperator.GT:
              query = query.gt(key, filter.value);
              break;
            case FilterOperator.LT:
              query = query.lt(key, filter.value);
              break;
            case FilterOperator.LIKE:
              query = query.like(key, filter.value);
              break;
            default:
              throw new Error(`Unsupported filter operator: ${operator}`);
          }
        }
      }
    }
    return query;
  }
  

}
