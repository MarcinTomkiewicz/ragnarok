import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseClient, PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

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
  getAll<T extends { image?: string; imageUrl?: string }>(
    table: string, 
    sortBy?: keyof T, 
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Observable<T[]> {
    let query = this.supabase.from(table).select('*');
  
    if (sortBy) {
      query = query.order(sortBy as string, { ascending: sortOrder === 'asc' });
    }
  
    return from(query).pipe(
      map((response: PostgrestResponse<T>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return (response.data || []).map(item => this.processImage(item));
      })
    );
  }
  
  
  /**
   * Pobiera rekord według identyfikatora.
   * @param table - Nazwa tabeli w Supabase
   * @param id - ID rekordu
   * @returns Observable z rekordem
   */
  getById<T extends { image?: string; imageUrl?: string }>(table: string, id: string | number): Observable<T | null> {
    return from(this.supabase.from(table).select('*').eq('id', id).single()).pipe(
      map((response: PostgrestSingleResponse<T>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        // Dodajemy URL do obrazu, jeśli jest
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
    return from(this.supabase.from(table).update(data).eq('id', id).single()).pipe(
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
  private processImage<T extends { image?: string; imageURL?: string }>(item: T): T {
    if (item.image) { 
      const { data } = this.supabase
        .storage
        .from('images')
        .getPublicUrl(item.image);
  
        item.imageURL = data?.publicUrl || '';
      }
    // }
  
    return item;
  }
  
}
