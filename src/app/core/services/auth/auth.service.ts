import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { from, map, Observable, of, switchMap } from 'rxjs';

import { toCamelCase, toSnakeCase } from '../../utils/type-mappers';
import { PlatformService } from '../platform/platform.service';
import { Responses } from '../../enums/responses';
import { IUser } from '../../interfaces/i-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformService = inject(PlatformService);
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly _user = signal<IUser | null>(null);
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
            console.log('User logged in:', this._user());

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

    console.log('Updating user data:', payload);

    return from(this.supabase.from('users').upsert([payload])).pipe(
      map(({ error }) => (error ? error.message : null))
    );
  }

  logout() {
    return from(this.supabase.auth.signOut()).pipe(
      switchMap(() => {
        this._user.set(null);
        return of(void 0);
      })
    );
  }
}
