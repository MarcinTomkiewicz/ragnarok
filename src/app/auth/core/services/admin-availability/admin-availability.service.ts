import { Injectable, inject } from '@angular/core';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { IAvailabilitySlot, WorkType } from '../../../../core/interfaces/i-availability-slot';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { IUser } from '../../../../core/interfaces/i-user';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminAvailabilityService {
  private readonly backend = inject(BackendService);

  getAvailabilityForDates(
    dates: string[],
    workTypes: WorkType[]
  ): Observable<IAvailabilitySlot[]> {
    if (!dates.length || !workTypes.length) return of([]);
    return this.backend.getAll<IAvailabilitySlot>('user_availability', undefined, 'asc', {
      filters: {
        date: { value: dates, operator: FilterOperator.IN },
        workType: { value: workTypes, operator: FilterOperator.IN },
      },
    });
  }

  getUsersByIds(ids: string[]): Observable<IUser[]> {
    if (!ids.length) return of([]);
    return this.backend.getByIds<IUser>('users', ids);
  }
}
