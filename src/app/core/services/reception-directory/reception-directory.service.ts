// src/app/.../core/services/reception-directory/reception-directory.service.ts
import { Injectable, inject } from '@angular/core';
import { combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { BackendService } from '../backend/backend.service';
import { IUser } from '../../interfaces/i-user';
import { FilterOperator } from '../../enums/filterOperator';
import { IParty } from '../../interfaces/parties/i-party';

@Injectable({ providedIn: 'root' })
export class ReceptionDirectoryService {
  private readonly backend = inject(BackendService);

  searchUsers(query: string, limit = 20) {
    const q = (query ?? '').trim();
    if (!q) return of([] as IUser[]);

    // prosty OR przez 3 zapytania i deduplikację
    const like = `%${q.replace(/\s+/g, '%')}%`;
    return combineLatest([
      this.backend.getAll<IUser>('users', undefined, 'asc', {
        filters: { firstName: { value: like, operator: FilterOperator.LIKE } },
      }),
      this.backend.getAll<IUser>('users', undefined, 'asc', {
        filters: { nickname: { value: like, operator: FilterOperator.LIKE } },
      }),
      this.backend.getAll<IUser>('users', undefined, 'asc', {
        filters: { phoneNumber: { value: like, operator: FilterOperator.LIKE } },
      }),
    ]).pipe(
      map((buckets) => {
        const byId = new Map<string, IUser>();
        buckets.flat().forEach((u) => u && byId.set(u.id, u));
        return Array.from(byId.values()).slice(0, limit);
      })
    );
  }

  searchParties(query: string, limit = 20) {
    const q = (query ?? '').trim();
    if (!q) return of([] as IParty[]);
    const like = `%${q.replace(/\s+/g, '%')}%`;
    return this.backend.getAll<IParty>('parties', undefined, 'asc', {
      filters: { name: { value: like, operator: FilterOperator.LIKE } },
    })
    .pipe(map(list => list.slice(0, limit)));
  }

  getUserById(userId: string) {
    return this.backend.getById<IUser>('users', userId);
  }
}
