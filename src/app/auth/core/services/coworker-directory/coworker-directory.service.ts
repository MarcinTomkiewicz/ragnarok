import { inject, Injectable } from '@angular/core';
import { map, shareReplay } from 'rxjs';
import { BackendService } from '../../../../core/services/backend/backend.service';

export interface ICoworkerPublic {
  userId: string;       // auth.users.id
  firstName: string;
  lastName: string;
  displayName?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CoworkerDirectoryService {
  private readonly backend = inject(BackendService);
  private readonly table = 'coworkers_public';

  // Pełna lista (cache'owana)
  readonly all$ = this.backend
    .getAll<ICoworkerPublic>(this.table, 'lastName', 'asc')
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  // Mapka userId -> dane
  readonly map$ = this.all$.pipe(
    map(list => {
      const m = new Map<string, ICoworkerPublic>();
      list.forEach(x => m.set(x.userId, x));
      return m;
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  // Upsert (konflikt po user_id)
  upsert(payload: ICoworkerPublic) {
    return this.backend.upsert<ICoworkerPublic>(this.table, payload, 'user_id');
  }
}
 