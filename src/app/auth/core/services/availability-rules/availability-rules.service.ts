import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  ReservationStatus
} from '../../../../core/interfaces/i-reservation';
import { ReceptionScheduleService } from '../reception-schedule/reception-schedule.service';
import { ReservationService } from '../reservation/reservation.service';

type DateGuardResult = { date: string; ok: boolean; reason?: string };

@Injectable({ providedIn: 'root' })
export class AvailabilityRulesService {
  private readonly reception = inject(ReceptionScheduleService);
  private readonly reservations = inject(ReservationService);

  isUserScheduledForReceptionOrExternal(
    userId: string,
    dates: string[]
  ): Observable<Map<string, boolean>> {
    if (!dates.length) return of(new Map());
    return this.reception.getForDates(dates).pipe(
      map((rows) => {
        const byDate = new Map<string, boolean>();
        for (const d of dates) byDate.set(d, false);
        rows.forEach((r) => {
          if (!r) return;
          const d = r.workDate;
          const assigned =
            r.receptionistId === userId || r.externalRunnerId === userId;
          if (assigned) byDate.set(d, true);
        });
        return byDate;
      })
    );
  }

  hasActiveGmReservation(userId: string, date: string): Observable<boolean> {
    return this.reservations
      .getReservationsForGm(userId, date)
      .pipe(
        map((list) =>
          list.some(
            (r) =>
              r.status === ReservationStatus.Confirmed ||
              r.status === ReservationStatus.Pending
          )
        )
      );
  }

  guardReceptionOrExternalChange(
    userId: string,
    datesToChange: string[]
  ): Observable<DateGuardResult[]> {
    if (!datesToChange.length) return of([]);
    return this.isUserScheduledForReceptionOrExternal(
      userId,
      datesToChange
    ).pipe(
      map((mapper) =>
        datesToChange.map((date) => {
          const locked = mapper.get(date) === true;
          return locked
            ? {
                date,
                ok: false,
                reason: 'Jesteś wyznaczony na recepcję / event zewnętrzny.',
              }
            : { date, ok: true };
        })
      )
    );
  }

  /** Walidacja pakietu zmian: MG – blok gdy istnieje rezerwacja */
  guardGmChange(
    userId: string,
    datesToChange: string[]
  ): Observable<DateGuardResult[]> {
    if (!datesToChange.length) return of([]);
    return forkJoin(
      datesToChange.map((date) =>
        this.hasActiveGmReservation(userId, date).pipe(
          map((has) => ({
            date,
            ok: !has,
            reason: has ? 'Masz już zabukowaną sesję jako MG.' : undefined,
          }))
        )
      )
    );
  }
}
