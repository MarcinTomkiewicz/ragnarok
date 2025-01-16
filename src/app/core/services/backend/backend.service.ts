import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { supabase } from '../../../../../supabase.client';
import { SupabaseClient, PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class BackendService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Pobiera wszystkie rekordy z wybranej tabeli.
   * @param table - Nazwa tabeli w Supabase
   * @returns Observable z listą rekordów
   */
  getAll(table: string): Observable<Record<string, any>[]> {
    return from(this.supabase.from(table).select('*')).pipe(
      map((response: PostgrestResponse<Record<string, any>>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data || [];
      })
    );
  }

  /**
   * Pobiera rekord według identyfikatora.
   * @param table - Nazwa tabeli w Supabase
   * @param id - ID rekordu
   * @returns Observable z rekordem
   */
  getById(table: string, id: string | number): Observable<Record<string, any> | null> {
    return from(this.supabase.from(table).select('*').eq('id', id).single()).pipe(
      map((response: PostgrestSingleResponse<Record<string, any>>) => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data || null;
      })
    );
  }

  /**
   * Tworzy nowy rekord w wybranej tabeli.
   * @param table - Nazwa tabeli w Supabase
   * @param data - Dane do zapisania
   * @returns Observable z odpowiedzią od Supabase
   */
  create(table: string, data: Record<string, any>): Observable<Record<string, any>> {
    return from(this.supabase.from(table).insert(data).single()).pipe(
      map((response: PostgrestSingleResponse<Record<string, any>>) => {
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
  update(table: string, id: string | number, data: Record<string, any>): Observable<Record<string, any>> {
    return from(this.supabase.from(table).update(data).eq('id', id).single()).pipe(
      map((response: PostgrestSingleResponse<Record<string, any>>) => {
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
}
