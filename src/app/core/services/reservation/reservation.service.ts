import { inject, Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { FilterOperator } from '../../enums/filterOperator';
import { Rooms } from '../../enums/rooms';
import {
  IReservation,
  ReservationStatus,
} from '../../interfaces/i-reservation';
import { IUser } from '../../interfaces/i-user';
import { toCamelCase, toSnakeCase } from '../../utils/type-mappers';
import { AuthService } from '../auth/auth.service';
import { BackendService } from '../backend/backend.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly backend = inject(BackendService);
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly authService = inject(AuthService);

  getMyReservations(): Observable<IReservation[]> {
    const user = this.authService.user();
    if (!user) return of([]);
    return this.backend.getAll<IReservation>('reservations', 'date', 'asc', {
      filters: {
        user_id: { value: user.id, operator: FilterOperator.EQ },
      },
    });
  }

  getReservationsForRoom(
    room: Rooms,
    date: string
  ): Observable<IReservation[]> {
    return this.backend.getAll<IReservation>(
      'reservations',
      'startTime',
      'asc',
      {
        filters: {
          room_name: { value: room, operator: FilterOperator.EQ },
          date: { value: date, operator: FilterOperator.EQ },
        },
      }
    );
  }

  getAllReservationsForReception(): Observable<IReservation[]> {
    return this.backend.getAll<IReservation>('reservations', 'date', 'asc');
  }

  createReservation(data: Partial<IReservation>): Observable<IReservation> {
    const payload = toSnakeCase({
      ...data,
      status: ReservationStatus.Confirmed,
    });

    return this.backend.create<IReservation>(
      'reservations',
      payload as IReservation
    );
  }

  cancelReservation(id: string): Observable<IReservation> {
    return this.backend.update<IReservation>('reservations', id, {
      status: ReservationStatus.Cancelled,
    } as any);
  }

  getAvailableTimeSlots(
    room: Rooms,
    date: string
  ): Observable<{ start: string; end: string }[]> {
    return this.getReservationsForRoom(room, date).pipe(
      map((reservations) => {
        const OPEN = 17;
        const CLOSE = 23;
        const allSlots: { start: string; end: string }[] = [];

        reservations.sort((a, b) => a.startTime.localeCompare(b.startTime));

        if (reservations.length === 0) {
          allSlots.push({ start: '17:00', end: '23:00' });
          return allSlots;
        }

        let current = OPEN;

        for (const res of reservations) {
          const [startHourStr] = res.startTime.split(':');
          const startHour = Number(startHourStr);

          if (current < startHour) {
            allSlots.push({
              start: `${String(current).padStart(2, '0')}:00`,
              end: `${String(startHour).padStart(2, '0')}:00`,
            });
          }

          current = Math.max(current, startHour + res.durationHours);
        }

        if (current < CLOSE) {
          allSlots.push({
            start: `${String(current).padStart(2, '0')}:00`,
            end: '23:00',
          });
        }

        return allSlots;
      })
    );
  }

  getGmCandidatesForSystem(systemId: string): Observable<IUser[]> {
    return from(
      this.supabase
        .from('gm_specialties')
        .select('gm_id, gm_profiles!inner(*), users(*)')
        .eq('system_id', systemId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(error.message);
        return (data || [])
          .map((row) => toCamelCase<IUser>(row.users))
          .filter(Boolean);
      })
    );
  }

  checkIfUserHasActiveReservation(): Observable<boolean> {
  const user = this.authService.user();
  if (!user) return of(false);

  const today = new Date().toISOString().slice(0, 10);

  return this.getMyReservations().pipe(
    map((reservations) =>
      reservations.some(
        (r) =>
          r.status === ReservationStatus.Confirmed &&
          r.date >= today
      )
    )
  );
}

checkIfMemberHasReservationThisWeekInClubRooms(): Observable<boolean> {
  const user = this.authService.user();
  if (!user) return of(false);

  const today = new Date();
  const day = today.getDay();

  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return this.getMyReservations().pipe(
    map((reservations) =>
      reservations.some((r) => {
        const resDate = new Date(r.date);
        return (
          [Rooms.Asgard, Rooms.Alfheim].includes(r.roomName) &&
          resDate >= monday &&
          resDate <= sunday
        );
      })
    )
  );
}

}
