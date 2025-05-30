import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabaseService = inject(SupabaseService)
  private readonly supabaseClient = this.supabaseService.getClient();


  // Logowanie użytkownika
  login(email: string, password: string): Observable<string | null> {
    return new Observable<string | null>((observer) => {
      this.supabaseClient.auth
        .signInWithPassword({ email, password })
        .then(({ error,  }) => {
          if (error) {
            observer.next(error.message);
          } else {
            observer.next(error);
          }
          observer.complete();
        })
        .catch((err) => {
          observer.error(err);
        });
    });
  }

  // Rejestracja użytkownika
  register(pseudonim: string, email: string, password: string): Observable<string | null> {
    return new Observable<string | null>((observer) => {
      this.supabaseClient.auth
        .signUp({ email, password })
        .then(async ({ error }) => {
          if (error) {
            observer.next(error.message);
          } else {
            const { data, error: userError } = await this.supabaseClient
              .from('users')
              .upsert([{ pseudonim, email }]);

            observer.next(userError ? userError.message : null);
          }
          observer.complete();
        })
        .catch((err) => {
          observer.error(err);
        });
    });
  }

  // Wylogowanie
  logout(): Observable<void> {
    return new Observable<void>((observer) => {
      this.supabaseClient.auth
        .signOut()
        .then(() => observer.complete())
        .catch((err) => observer.error(err));
    });
  }

  // Sprawdzenie aktualnie zalogowanego użytkownika
  getCurrentUser(): Observable<any> {
    return new Observable((observer) => {
      const user = this.supabaseClient.auth.getUser();
      observer.next(user);
      observer.complete();
    });
  }
}
