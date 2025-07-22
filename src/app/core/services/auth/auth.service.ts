import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import { from, of, switchMap } from 'rxjs';
import { IUser } from '../../interfaces/i-user';
import { toCamelCase } from '../../utils/type-mappers';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly _user = signal<IUser | null>(null);
  readonly user = computed(() => this._user());

  constructor() {
    this.loadUserFromSession(); // odpala na starcie
    this.supabase.auth.onAuthStateChange(() => this.loadUserFromSession());
  }

  private loadUserFromSession() {
    from(this.supabase.auth.getUser())
      .pipe(
        switchMap(({ data }) => {
          const id = data?.user?.id;
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
          this.supabase.from('users').select('*').eq('id', data.user.id).single()
        ).pipe(
          switchMap((response) => {
            if (response.error) return of(response.error.message);
            this._user.set(toCamelCase<IUser>(response.data));
            return of(null);
          })
        );
      })
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
