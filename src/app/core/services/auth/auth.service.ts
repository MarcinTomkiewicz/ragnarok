import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { catchError, from, map, Observable, of, switchMap, tap } from 'rxjs';

import { toCamelCase, toSnakeCase } from '../../utils/type-mappers';
import { PlatformService } from '../platform/platform.service';
import { Responses } from '../../enums/responses';
import { IUser } from '../../interfaces/i-user';
import { AuthError } from '@supabase/supabase-js';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformService = inject(PlatformService);
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly _user = signal<IUser | null>(null);
  private readonly router = inject(Router);
  readonly user = computed(() => this._user());

  constructor() {
    if (this.platformService.isBrowser) {
      this.loadUserFromSession();
      this.supabase.auth.onAuthStateChange(() => this.loadUserFromSession());
    }
  }

  private loadUserFromSession() {
    from(this.supabase.auth.getSession())
      .pipe(
        switchMap(({ data }) => {
          const id = data?.session?.user?.id;
          if (!id) return of(null);

          return from(
            this.supabase.from('users').select('*').eq('id', id).single()
          );
        })
      )
      .subscribe((response) => {
        if (!response || response.error) {
          this._user.set(null);
        } else {
          this._user.set(toCamelCase<IUser>(response.data));
        }
      });
  }

  login(email: string, password: string) {
    return from(
      this.supabase.auth.signInWithPassword({ email, password })
    ).pipe(
      switchMap(({ data, error }) => {
        if (error) return of(error.message);
        return from(
          this.supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single()
        ).pipe(
          switchMap((response) => {
            if (response.error) return of(response.error.message);
            this._user.set(toCamelCase<IUser>(response.data));
            return of(Responses.Success);
          })
        );
      })
    );
  }

  register(
    email: string,
    password: string,
    userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<string | null> {
    return from(
      this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      })
    ).pipe(map(({ error }) => (error ? error.message : null)));
  }

  updateUserData(data: Partial<IUser>): Observable<string | null> {
    const user = this.user();
    if (!user) return of('Brak użytkownika.');

    const payload = toSnakeCase({
      id: user.id,
      ...data,
    });

    return from(this.supabase.from('users').upsert([payload])).pipe(
      map(({ error }) => (error ? error.message : null))
    );
  }

  logout(): Observable<void> {
    return from(this.supabase.auth.getSession()).pipe(
      switchMap(({ data }) => {
        if (!data.session) {
          // Brak sesji – fallback: czyść lokalnie i przekieruj
          localStorage.removeItem('supabase.auth.token');
          this._user.set(null);
          this.router.navigate(['/']);
          return of(void 0);
        }

        return from(this.supabase.auth.signOut({ scope: 'local' })).pipe(
          catchError((err) => {
            console.warn('Logout error:', err?.message || err);
            localStorage.removeItem('supabase.auth.token');
            return of({ error: null });
          }),
          tap(() => {
            this._user.set(null);
            this.router.navigate(['/']);
          }),
          map(() => void 0)
        );
      })
    );
  }
}
