import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  forkJoin,
  from,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import { HostSignupScope } from '../../enums/events';
import { FilterOperator } from '../../enums/filterOperator';
import { HostSignupConflictError } from '../../errors/host-conflicts.error';
import {
  IEventHost,
  IEventHostCreate,
  IEventHostUpdate,
} from '../../interfaces/i-event-host';
import { IRPGSystem } from '../../interfaces/i-rpg-system';
import { toSnakeCase } from '../../utils/type-mappers';
import { BackendService } from '../backend/backend.service';
import { ImageStorageService } from '../backend/image-storage/image-storage.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class EventHostsService {
  private readonly supabase = inject(SupabaseService).getClient();
  private readonly backend = inject(BackendService);
  private readonly images = inject(ImageStorageService);

  getHostsBasic(eventId: string, dateIso: string): Observable<IEventHost[]> {
    return this.backend.getAll<IEventHost>(
      'event_occurrence_hosts',
      undefined,
      'asc',
      {
        filters: {
          event_id: { operator: FilterOperator.EQ, value: eventId },
          occurrence_date: { operator: FilterOperator.EQ, value: dateIso },
        } as any,
      },
      undefined,
      undefined,
      false
    );
  }

  getHostsWithSystems(
    eventId: string,
    dateIso: string
  ): Observable<(IEventHost & { systems?: IRPGSystem | null })[]> {
    return this.backend.getAll<any>(
      'event_occurrence_hosts',
      undefined,
      'asc',
      {
        filters: {
          event_id: { operator: FilterOperator.EQ, value: eventId },
          occurrence_date: { operator: FilterOperator.EQ, value: dateIso },
        } as any,
      },
      undefined,
      'systems(*)',
      false
    );
  }

  listTakenRooms(eventId: string, dateIso: string): Observable<Set<string>> {
    return this.getHostsBasic(eventId, dateIso).pipe(
      map(
        (rows) =>
          new Set(rows.map((r) => r.roomName).filter(Boolean) as string[])
      )
    );
  }

  createSignup(input: IEventHostCreate): Observable<IEventHost> {
    const { imageFile, ...rest } = input;

    const upload$ = imageFile
      ? this.images
          .transcodeAndUpload(
            imageFile,
            `events/${rest.eventId}/hosts/${rest.occurrenceDate}`,
            {
              keepBaseName: true,
              uniqueStrategy: 'date',
              dateFormat: 'dd-MM-yyyy-HHmmss',
              prefer: 'avif',
              quality: 0.82,
              maxW: 1600,
              maxH: 1200,
              largerFallbackFactor: 1.15,
            }
          )
          .pipe(catchError(() => of(null)))
      : of(null);

    return upload$.pipe(
      switchMap((imagePath) => {
        const payload = { ...rest, imagePath };
        const snake = toSnakeCase(payload);
        return from(
          this.supabase
            .from('event_occurrence_hosts')
            .insert(snake)
            .select('*')
            .single()
        ).pipe(
          catchError((err) => {
            const domain = HostSignupConflictError.fromSupabase(err, {
              eventId: rest.eventId,
              dateIso: rest.occurrenceDate,
              roomName: rest.roomName ?? null,
              role: rest.role as HostSignupScope,
            });
            return domain ? throwError(() => domain) : throwError(() => err);
          }),
          map((res) => res.data as IEventHost)
        );
      }),
      switchMap((host) => {
        if (!host.roomName) return of(host);
        return this.ensureHostReservation(
          host.eventId,
          host.occurrenceDate,
          host.roomName,
          host.hostUserId,
          host.systemId ?? null
        ).pipe(map(() => host));
      })
    );
  }

  updateHost(id: string, patch: IEventHostUpdate): Observable<void> {
    const { imageFile, ...rest } = patch;

    const prev$ = from(
      this.supabase
        .from('event_occurrence_hosts')
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(map((r) => r.data as IEventHost));

    const upload$ = imageFile
      ? this.images
          .transcodeAndUpload(imageFile, `hosts/${id}`, {
            keepBaseName: true,
            uniqueStrategy: 'date',
            dateFormat: 'dd-MM-yyyy-HHmmss',
            prefer: 'avif',
            quality: 0.82,
            maxW: 1600,
            maxH: 1200,
            largerFallbackFactor: 1.15,
          })
          .pipe(
            map((p) => p ?? undefined),
            catchError(() => of(undefined))
          )
      : of(undefined);

    return prev$.pipe(
      switchMap((prev) =>
        upload$.pipe(
          switchMap((newImg) => {
            const core: Record<string, unknown> = { ...rest };
            if (newImg !== undefined) core['imagePath'] = newImg;
            const snake = toSnakeCase(core) as Partial<Record<string, unknown>>;
            return this.backend
              .update<Record<string, unknown>>(
                'event_occurrence_hosts',
                id,
                snake
              )
              .pipe(map(() => prev));
          }),
          switchMap((prev) => {
            const nextRoom =
              (rest.roomName as string | null | undefined) ?? prev.roomName;
            const roomChanged = (prev.roomName || null) !== (nextRoom || null);
            const sysChanged =
              Object.prototype.hasOwnProperty.call(rest, 'systemId') &&
              (rest.systemId ?? null) !== (prev.systemId ?? null);

            if (!prev.roomName && !nextRoom) return of(void 0);

            if (roomChanged) {
              const del$ = prev.roomName
                ? this.deleteHostReservation(
                    prev.eventId,
                    prev.occurrenceDate,
                    prev.roomName,
                    prev.hostUserId
                  )
                : of(void 0);
              const ins$ = nextRoom
                ? this.ensureHostReservation(
                    prev.eventId,
                    prev.occurrenceDate,
                    nextRoom,
                    prev.hostUserId,
                    (rest.systemId ?? prev.systemId) || null
                  )
                : of(void 0);
              return forkJoin([del$, ins$]).pipe(map(() => void 0));
            }

            if (sysChanged && nextRoom) {
              return this.updateHostReservationSystem(
                prev.eventId,
                prev.occurrenceDate,
                nextRoom,
                prev.hostUserId,
                rest.systemId ?? null
              );
            }

            return of(void 0);
          })
        )
      )
    );
  }

  deleteHost(id: string): Observable<void> {
    const prev$ = from(
      this.supabase
        .from('event_occurrence_hosts')
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(map((r) => r.data as IEventHost));

    return prev$.pipe(
      switchMap((prev) =>
        this.backend.delete('event_occurrence_hosts', id).pipe(
          switchMap(() => {
            if (!prev.roomName) return of(void 0);
            return this.deleteHostReservation(
              prev.eventId,
              prev.occurrenceDate,
              prev.roomName,
              prev.hostUserId
            );
          })
        )
      )
    );
  }

  updateSignup(id: string, patch: Partial<IEventHostUpdate>): Observable<void> {
    return this.updateHost(id, patch as IEventHostUpdate);
  }

  deleteSignup(id: string): Observable<void> {
    return this.deleteHost(id);
  }

  private fetchEventTimes(eventId: string): Observable<{
    start_time: string;
    end_time: string;
  }> {
    return from(
      this.supabase
        .from('new_events')
        .select('start_time,end_time')
        .eq('id', eventId)
        .single()
    ).pipe(
      map((r) => ({
        start_time: r.data?.start_time as string,
        end_time: r.data?.end_time as string,
      }))
    );
  }

  private diffHours(hhmmssA: string, hhmmssB: string): number {
    const [aH, aM] = hhmmssA.split(':').map((n) => parseInt(n, 10));
    const [bH, bM] = hhmmssB.split(':').map((n) => parseInt(n, 10));
    const a = aH + (aM || 0) / 60;
    const b = bH + (bM || 0) / 60;
    return Math.max(1, Math.ceil(Math.max(0, b - a)));
  }

  private ensureHostReservation(
    eventId: string,
    dateIso: string,
    roomName: string,
    hostUserId: string,
    systemId: string | null
  ): Observable<void> {
    return this.fetchEventTimes(eventId).pipe(
      switchMap(({ start_time, end_time }) => {
        const duration_hours = this.diffHours(start_time, end_time);
        const row = {
          event_id: eventId,
          room_name: roomName,
          date: dateIso,
          start_time,
          duration_hours,
          status: 'confirmed',
          gm_id: hostUserId,
          system_id: systemId,
        } as any;
        return from(this.supabase.from('reservations').insert(row)).pipe(
          catchError((err) => {
            if ((err && err.code) === '23505') return of({} as any);
            return throwError(() => err);
          }),
          map(() => void 0)
        );
      })
    );
  }

  private deleteHostReservation(
    eventId: string,
    dateIso: string,
    roomName: string,
    hostUserId: string
  ): Observable<void> {
    return from(
      this.supabase
        .from('reservations')
        .delete()
        .eq('event_id', eventId)
        .eq('date', dateIso)
        .eq('room_name', roomName)
        .eq('gm_id', hostUserId)
    ).pipe(map(() => void 0));
  }

  private updateHostReservationSystem(
    eventId: string,
    dateIso: string,
    roomName: string,
    hostUserId: string,
    systemId: string | null
  ): Observable<void> {
    return from(
      this.supabase
        .from('reservations')
        .update({ system_id: systemId })
        .eq('event_id', eventId)
        .eq('date', dateIso)
        .eq('room_name', roomName)
        .eq('gm_id', hostUserId)
    ).pipe(map(() => void 0));
  }
}
