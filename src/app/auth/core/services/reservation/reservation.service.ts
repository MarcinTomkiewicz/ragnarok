import { inject, Injectable } from '@angular/core';
import { combineLatest, forkJoin, from, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { FilterOperator } from '../../../../core/enums/filterOperator';
import { Rooms } from '../../../../core/enums/rooms';
import { IGmData } from '../../../../core/interfaces/i-gm-profile';
import {
  IReservation,
  ReservationStatus,
} from '../../../../core/interfaces/i-reservation';
import { IRPGSystem } from '../../../../core/interfaces/i-rpg-system';
import { IUser } from '../../../../core/interfaces/i-user';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { BackendService } from '../../../../core/services/backend/backend.service';
import { ImageStorageService } from '../../../../core/services/backend/image-storage/image-storage.service';
import { SupabaseService } from '../../../../core/services/supabase/supabase.service';
import { toCamelCase, toSnakeCase } from '../../../../core/utils/type-mappers';
import { PartyService } from '../party/party.service';
import { TimeSlots } from '../../../../core/enums/hours';
import { CoworkerRoles } from '../../../../core/enums/roles';
import { TeamRole } from '../../../../core/enums/party.enum';
import {
  IGmExtraInfo,
  IGmExtraInfoRow,
} from '../../../../core/interfaces/i-gm-extra-info';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly backend = inject(BackendService);
  private readonly imageService = inject(ImageStorageService);
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly authService = inject(AuthService);
  private readonly partyService = inject(PartyService);

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
    date: string,
    opts?: { statuses?: ReservationStatus | ReservationStatus[] }
  ): Observable<IReservation[]> {
    const statuses = opts?.statuses ?? ReservationStatus.Confirmed;
    const statusFilter = Array.isArray(statuses)
      ? { value: statuses, operator: FilterOperator.IN }
      : { value: statuses, operator: FilterOperator.EQ };

    return this.backend.getAll<IReservation>(
      'reservations',
      'startTime',
      'asc',
      {
        filters: {
          room_name: { value: room, operator: FilterOperator.EQ },
          date: { value: date, operator: FilterOperator.EQ },
          status: statusFilter,
        },
      }
    );
  }

  getConfirmedReservationsForRoom(room: Rooms, date: string) {
    return this.getReservationsForRoom(room, date, {
      statuses: ReservationStatus.Confirmed,
    });
  }

  getActiveReservationsForRoom(room: Rooms, date: string) {
    return this.getReservationsForRoom(room, date, {
      statuses: [ReservationStatus.Confirmed, ReservationStatus.Pending],
    });
  }

  getReservationsForTeams(teamIds: string[]): Observable<IReservation[]> {
    return this.backend
      .getAll<IReservation>('reservations', 'date', 'asc', {
        filters: {
          team_id: { value: teamIds, operator: FilterOperator.IN },
        },
      })
      .pipe(map((reservations) => reservations));
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

  private openingHourForRoom(room: Rooms): number {
    return [Rooms.Asgard, Rooms.Alfheim].includes(room)
      ? TimeSlots.earlyStart
      : TimeSlots.lateStart;
  }

  getAvailableTimeSlots(
    room: Rooms,
    date: string,
    opts: { open?: number; close?: number } = {}
  ): Observable<{ start: string; end: string }[]> {
    const OPEN = opts.open ?? this.openingHourForRoom(room);
    const CLOSE = opts.close ?? TimeSlots.end;

    return this.getReservationsForRoom(room, date).pipe(
      map((reservations) => {
        const all: { start: string; end: string }[] = [];
        const sorted = this.getActiveReservations(reservations).sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        );

        if (sorted.length === 0) {
          return [
            {
              start: `${String(OPEN).padStart(2, '0')}:00`,
              end: `${String(CLOSE).padStart(2, '0')}:00`,
            },
          ];
        }

        let current = OPEN;
        for (const res of sorted) {
          const start = parseInt(res.startTime.split(':')[0], 10);
          if (current < start) {
            all.push({
              start: `${String(current).padStart(2, '0')}:00`,
              end: `${String(Math.min(start, CLOSE)).padStart(2, '0')}:00`,
            });
          }
          current = Math.max(current, start + res.durationHours);
          if (current >= CLOSE) break;
        }

        if (current < CLOSE) {
          all.push({
            start: `${String(current).padStart(2, '0')}:00`,
            end: `${String(CLOSE).padStart(2, '0')}:00`,
          });
        }

        return all;
      })
    );
  }

  getAllSystems(): Observable<IRPGSystem[]> {
    return this.backend.getAll<IRPGSystem>('systems', 'name');
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

  getGmExtraInfoByReservationId(reservationId: string) {
    return this.backend.getOneByFields<IGmExtraInfoRow>(
      'reservation_gm_extra_info',
      { reservationId }
    );
  }

  createGmExtraInfoForReservation(reservationId: string, extra: IGmExtraInfo) {
    const payload = {
      reservationId,
      ...extra,
    };
    return this.backend
      .create<IGmExtraInfoRow>('reservation_gm_extra_info', payload as any)
      .pipe(map((row) => toCamelCase(row) as IGmExtraInfoRow));
  }

  createReservationWithOptionalExtra(
    data: Partial<IReservation>,
    extra: IGmExtraInfo | null
  ) {
    return this.createReservation(data).pipe(
      switchMap((reservation) => {
        if (!extra) {
          return of({ reservation, extra: null as IGmExtraInfoRow | null });
        }
        return this.createGmExtraInfoForReservation(reservation.id, extra).pipe(
          map((row) => ({ reservation, extra: row }))
        );
      })
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

    return forkJoin([
      this.partyService.getPartiesOwnedBy(user.id),
      this.partyService.getPartiesWhereMember(user.id),
    ]).pipe(
      map(([owned, member]) => {
        const all = [...owned, ...member];
        const uniqueTeamIds = Array.from(new Set(all.map((p) => p.id)));
        return uniqueTeamIds;
      }),
      switchMap((teamIds) => {
        if (!teamIds.length) return of(false);

        return this.backend
          .getAll<IReservation>('reservations', 'date', 'asc', {
            filters: {
              team_id: { operator: FilterOperator.IN, value: teamIds },
              room_name: {
                operator: FilterOperator.IN,
                value: [Rooms.Asgard, Rooms.Alfheim],
              },
              date: {
                operator: FilterOperator.GTE,
                value: monday.toISOString().split('T')[0],
              },
            },
          })
          .pipe(
            map((reservations) =>
              reservations.some((r) => {
                const resDate = new Date(r.date);
                return (
                  this.isReservationActive(r) &&
                  resDate >= monday &&
                  resDate <= sunday
                );
              })
            )
          );
      })
    );
  }

  checkIfAnyMemberOfPartyHasClubReservationThisWeek(partyId: string) {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayIso = monday.toISOString().split('T')[0];

    return forkJoin({
      party: this.partyService.getPartyById(partyId),
      members: this.partyService.getPartyMembers(partyId),
    }).pipe(
      map(({ party, members }) => {
        const ids = new Set<string>();
        members
          .filter((m) => !m.leftAt && m.role === TeamRole.Player)
          .forEach((m) => ids.add(m.userId));
        if (party?.ownerId) ids.add(party.ownerId); // ⬅️ ważne: właściciel też liczony
        return Array.from(ids);
      }),
      switchMap((userIds) => {
        if (!userIds.length) return of(false);

        return this.partyService.getUsersByIds(userIds).pipe(
          map((users) =>
            users
              .filter((u) => u.coworker === CoworkerRoles.Member) // tylko Klubowicze (Member)
              .map((u) => u.id)
          ),
          switchMap((memberUserIds) => {
            if (!memberUserIds.length) return of(false);

            return forkJoin(
              memberUserIds.map((uid) =>
                forkJoin({
                  owned: this.partyService.getPartiesOwnedBy(uid),
                  member: this.partyService.getPartiesWhereMember(uid),
                })
              )
            ).pipe(
              map((rows) => {
                const teamIds = new Set<string>();
                rows.forEach(({ owned, member }) => {
                  owned.forEach((p) => teamIds.add(p.id));
                  member.forEach((p) => teamIds.add(p.id));
                });
                return Array.from(teamIds);
              }),
              switchMap((teamIds) => {
                if (!teamIds.length) return of(false);

                return this.backend
                  .getAll<IReservation>('reservations', 'date', 'asc', {
                    filters: {
                      team_id: { operator: FilterOperator.IN, value: teamIds },
                      room_name: {
                        operator: FilterOperator.IN,
                        value: [Rooms.Asgard, Rooms.Alfheim],
                      },
                      date: { operator: FilterOperator.GTE, value: mondayIso }, // górny limit sprawdzamy lokalnie
                    },
                  })
                  .pipe(
                    map((list) =>
                      list.some((r) => {
                        const d = new Date(r.date);
                        return (
                          this.isReservationActive(r) &&
                          d >= monday &&
                          d <= sunday
                        );
                      })
                    )
                  );
              })
            );
          })
        );
      })
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
