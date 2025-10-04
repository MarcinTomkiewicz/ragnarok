import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { IUser } from '../../../../core/interfaces/i-user';


@Injectable({ providedIn: 'root' })
export class UserCacheService {
  private readonly backend = inject(BackendService);
  private readonly cache = new Map<string, Observable<IUser | null>>();

  getById(id: string | null | undefined): Observable<IUser | null> {
    if (!id) return of(null);
    const hit = this.cache.get(id);
    if (hit) return hit;

    const req$ = this.backend.getById<IUser>('users', id)
      .pipe(shareReplay(1), catchError(() => of(null)));

    this.cache.set(id, req$);
    return req$;
  }
}
