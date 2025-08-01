import { inject, Injectable } from '@angular/core';
import { forkJoin, from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import {
  IReservation,
  ReservationStatus,
} from '../../../../core/interfaces/i-reservation';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { Rooms } from '../../../../core/enums/rooms';
import { toCamelCase, toSnakeCase } from '../../../../core/utils/type-mappers';
import { IUser } from '../../../../core/interfaces/i-user';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import { ImageStorageService } from '../../../../core/services/backend/image-storage/image-storage.service';

// TODO: Refactor this service to separate GM logic from reservation logic
// This service should focus on reservation management, while GM-related logic should be handled in a dedicated service.

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly backend = inject(BackendService);
  private readonly imageService = inject(ImageStorageService);
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly authService = inject(AuthService);

  // === UTILS ===
  private isReservationActive(res: IReservation): boolean {
    return (
      res.status === ReservationStatus.Confirmed ||
      res.status === ReservationStatus.Pending
    );
  }

  private isTimeOverlapping(
    startA: number,
    durationA: number,
    startB: number,
    durationB: number
  ): boolean {
    const endA = startA + durationA;
    const endB = startB + durationB;
    return startA < endB && endA > startB;
  }

  private getActiveReservations(reservations: IReservation[]): IReservation[] {
    return reservations.filter(this.isReservationActive);
  }

  // === PUBLIC METHODS ===

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

  getReservationsForGm(gmId: string, date: string): Observable<IReservation[]> {
    return this.backend.getAll<IReservation>(
      'reservations',
      'startTime',
      'asc',
      {
        filters: {
          gm_id: { value: gmId, operator: FilterOperator.EQ },
          date: { value: date, operator: FilterOperator.EQ },
          status: {
            value: [ReservationStatus.Confirmed, ReservationStatus.Pending],
            operator: FilterOperator.IN,
          },
        },
      }
    );
  }

  checkGmAvailability(
    gmId: string,
    date: string,
    newStartHour: number,
    newDuration: number
  ): Observable<boolean> {
    return this.getReservationsForGm(gmId, date).pipe(
      map((reservations) =>
        reservations.some((res) => {
          const existingStart = parseInt(res.startTime.split(':')[0], 10);
          return this.isTimeOverlapping(
            newStartHour,
            newDuration,
            existingStart,
            res.durationHours
          );
        })
      )
    );
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

        const sorted = this.getActiveReservations(reservations).sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        );

        if (sorted.length === 0) {
          return [{ start: '17:00', end: '23:00' }];
        }

        let current = OPEN;
        for (const res of sorted) {
          const start = parseInt(res.startTime.split(':')[0], 10);
          if (current < start) {
            allSlots.push({
              start: `${String(current).padStart(2, '0')}:00`,
              end: `${String(start).padStart(2, '0')}:00`,
            });
          }
          current = Math.max(current, start + res.durationHours);
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

  private isAvailableDuringTimeRange(
    gmId: string,
    date: string,
    startHour: number,
    duration: number
  ): Observable<boolean> {
    console.log('Checking availability for', {
      gmId,
      date,
      startHour,
      duration,
    });
    const endHour = startHour + duration;

    return this.backend
      .getOneByFields<{ fromHour: number; toHour: number }>('gm_availability', {
        gmId,
        date,
      })
      .pipe(
        map((availability) => {
          if (!availability) return false;
          return (
            availability.fromHour <= startHour && availability.toHour >= endHour
          );
        })
      );
  }

  getAvailableGmsForSystem(
    systemId: string,
    date: string,
    startHour: number,
    duration: number
  ): Observable<IGmData[]> {
    return this.backend
      .getAll<IGmData>('v_gm_specialties_with_user', undefined, 'asc', {
        filters: {
          systemId: { value: systemId, operator: FilterOperator.EQ },
        },
      })
      .pipe(
        switchMap((gms) =>
          forkJoin(
            gms.map((gm) =>
              forkJoin([
                this.checkGmAvailability(gm.userId, date, startHour, duration),
                this.isAvailableDuringTimeRange(
                  gm.userId,
                  date,
                  startHour,
                  duration
                ),
              ]).pipe(
                map(([isBusy, isAvailable]) =>
                  !isBusy && isAvailable ? gm : null
                )
              )
            )
          ).pipe(map((result) => result.filter((g): g is IGmData => !!g)))
        )
      );
  }

  getAllSystems(): Observable<IRPGSystem[]> {
    return this.backend.getAll<IRPGSystem>('systems', 'name');
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

  checkIfUserHasConflictingReservation(
    date: string,
    newStartHour: number,
    newDuration: number
  ): Observable<boolean> {
    const user = this.authService.user();
    if (!user) return of(false);

    return this.getMyReservations().pipe(
      map((reservations) =>
        reservations.some((r) => {
          if (!this.isReservationActive(r) || r.date !== date) return false;

          const existingStart = parseInt(r.startTime.split(':')[0], 10);
          const existingDuration = r.durationHours;

          return this.isTimeOverlapping(
            newStartHour,
            newDuration,
            existingStart,
            existingDuration
          );
        })
      )
    );
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

  checkIfUserHasActiveReservation(): Observable<boolean> {
    const user = this.authService.user();
    if (!user) return of(false);

    const today = new Date().toISOString().slice(0, 10);

    return this.getMyReservations().pipe(
      map((reservations) =>
        reservations.some((r) => this.isReservationActive(r) && r.date >= today)
      )
    );
  }

  checkIfMemberHasReservationThisWeekInClubRooms(): Observable<boolean> {
    const user = this.authService.user();
    if (!user) return of(false);

    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return this.getMyReservations().pipe(
      map((reservations) =>
        reservations.some((r) => {
          const resDate = new Date(r.date);
          return (
            this.isReservationActive(r) &&
            [Rooms.Asgard, Rooms.Alfheim].includes(r.roomName) &&
            resDate >= monday &&
            resDate <= sunday
          );
        })
      )
    );
  }

  getReservationWithDetails(
    id: string
  ): Observable<IReservation & { user: IUser; system: IRPGSystem }> {
    return from(
      this.supabase
        .from('reservations')
        .select(`*, user:user_id(*), system:system_id(*)`)
        .eq('id', id)
        .single()
    ).pipe(
      map((response) => {
        if (response.error) throw new Error(response.error.message);
        const data = response.data;
        const withImage = this.imageService.processImage(data);
        return toCamelCase(withImage);
      })
    );
  }
}
