import { inject, Injectable } from '@angular/core';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { IUser } from '../../../../core/interfaces/i-user';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CoworkersService {
  private readonly backend = inject(BackendService);

  private readonly hierarchy: CoworkerRoles[] = [
    CoworkerRoles.User,
    CoworkerRoles.Member,
    CoworkerRoles.Golden,
    CoworkerRoles.Gm,
    CoworkerRoles.Reception,
    CoworkerRoles.Coowner,
    CoworkerRoles.Owner,
  ];

  getWithMinRole(minRole: CoworkerRoles): Observable<IUser[]> {
    const from = this.hierarchy.indexOf(minRole);
    const allowed = this.hierarchy.slice(from);

    return this.backend.getAll<IUser>('users', 'firstName', 'asc', {
      filters: { coworker: { operator: FilterOperator.IN, value: allowed } },
    });
  }
}
