import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IReceptionSchedule } from '../../../../core/interfaces/i-reception-schedule';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { FilterOperator } from '../../../../core/enums/filterOperator';


@Injectable({ providedIn: 'root' })
export class ReceptionScheduleService {
  private readonly backend = inject(BackendService);
  private readonly table = 'reception_schedule';

  getForDates(dates: string[]): Observable<IReceptionSchedule[]> {
    if (!dates.length) return of([]);
    return this.backend.getAll<IReceptionSchedule>(this.table, 'workDate', 'asc', {
      filters: {
        workDate: { operator: FilterOperator.IN, value: dates },
      },
    });
  }

  upsertMany(rows: IReceptionSchedule[]): Observable<IReceptionSchedule[]> {
    if (!rows.length) return of([]);
    return this.backend.upsertMany<IReceptionSchedule>(this.table, rows, 'work_date');
  }

  deleteByDates(dates: string[]): Observable<void> {
    if (!dates.length) return of();
    return this.backend.delete(this.table, {
      work_date: { operator: FilterOperator.IN, value: dates },
    });
  }

  // pomocnicze: stała 6h dla recepcji
  static RECEPTION_HOURS = 6;
}
