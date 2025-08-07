import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { catchError, from, map, Observable, of, switchMap, tap } from 'rxjs';

import { toCamelCase, toSnakeCase } from '../../utils/type-mappers';
import { PlatformService } from '../platform/platform.service';
import { Responses } from '../../enums/responses';
import { IUser } from '../../interfaces/i-user';
import { AuthError, isAuthApiError } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { SystemRole } from '../../enums/systemRole';
import { CoworkerRoles } from '../../enums/roles';
import { getSupabaseErrorMessage } from '../../utils/supabase-error-handling';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformService = inject(PlatformService);
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly _user = signal<IUser | null>(null);
  private readonly router = inject(Router);
  readonly user = computed(() => this._user());

  constructor() {
    if (this.platformService.isBrowser) {
      this.loadUser().subscribe();
      this.supabase.auth.onAuthStateChange(
        () => void this.loadUser().subscribe()
      );
    }
  }

  loadUser(): Observable<IUser | null> {
    return from(this.supabase.auth.getSession()).pipe(
      switchMap(({ data }) => {
        const id = data?.session?.user?.id;
        if (!id) {
          this._user.set(null);
          return of(null);
        }

        return from(
          this.supabase.from('users').select('*').eq('id', id).single()
        ).pipe(
          map((response) => {
            if (!response || response.error) {
              this._user.set(null);
              return null;
            }

            const user = toCamelCase<IUser>(response.data);
            this._user.set(user);
            return user;
          })
        );
      }),
      catchError(() => {
        this._user.set(null);
        return of(null);
      })
    );
  }

login(email: string, password: string): Observable<string | Responses> {
  return from(this.supabase.auth.signInWithPassword({ email, password })).pipe(
    switchMap(({ data, error }) => {
      if (error) {
        const errorMessage = getSupabaseErrorMessage(error.code);
        throw new Error(errorMessage.replace(/^Error: /, ''));
      }

      return from(
        this.supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()
      ).pipe(
        switchMap((response) => {
          if (response.error) {
            throw new Error(response.error.message.replace(/^Error: /, ''));
          }

          this._user.set(toCamelCase<IUser>(response.data));
          return of(Responses.Success);
        })
      );
    }),
    catchError((err) => {
      throw err.message.replace(/^Error: /, '')
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
    return from(this.supabase.auth.signOut()).pipe(
      catchError((err) => {
        console.warn('Logout error:', err?.message || err);
        return of(void 0);
      }),
      switchMap(() => {
        this._user.set(null);

        // Usunięcie potencjalnych resztek tokenów z localStorage – jeśli jesteś w przeglądarce
        if (this.platformService.isBrowser) {
          Object.keys(localStorage)
            .filter(
              (key) => key.startsWith('sb-') && key.includes('-auth-token')
            )
            .forEach((key) => localStorage.removeItem(key));
        }

        // Przekierowanie do strony głównej jako observable
        return from(this.router.navigate(['/']));
      }),
      map(() => void 0)
    );
  }

  readonly userSystemRole = computed<SystemRole | null>(() => {
    return this._user()?.role ?? null;
  });

  readonly userCoworkerRole = computed<CoworkerRoles | null>(() => {
    return this._user()?.coworker ?? null;
  });
}
