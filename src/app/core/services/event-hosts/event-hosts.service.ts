// core/services/event-hosts/event-hosts.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  forkJoin,
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
import { toSnakeCase } from '../../utils/type-mappers';
import { BackendService } from '../backend/backend.service';
import { ImageStorageService } from '../backend/image-storage/image-storage.service';

@Injectable({ providedIn: 'root' })
export class EventHostsService {
  private readonly backend = inject(BackendService);
  private readonly images = inject(ImageStorageService);

  // --- helpers ---------------------------------------------------------------

  /** start_time, end_time, auto_reservation z new_events */
  private fetchEventMeta(eventId: string): Observable<{
    start_time: string;
    end_time: string;
    auto_reservation: boolean;
  }> {
    return this.backend
      .getById<any>('new_events', eventId, undefined, undefined, false)
      .pipe(
        map((row) => ({
          start_time: (row?.startTime as string) ?? '00:00:00',
          end_time: (row?.endTime as string) ?? '23:59:00',
          auto_reservation: !!row?.autoReservation,
        }))
      );
  }

  private diffHours(hhmmssA: string, hhmmssB: string): number {
    const [aH, aM] = hhmmssA
      .slice(0, 5)
      .split(':')
      .map((n) => parseInt(n, 10));
    const [bH, bM] = hhmmssB
      .slice(0, 5)
      .split(':')
      .map((n) => parseInt(n, 10));
    const a = aH + (aM || 0) / 60;
    const b = bH + (bM || 0) / 60;
    return Math.max(1, Math.ceil(Math.max(0, b - a)));
  }
  private hhmmssToMin(h: string): number {
    const [H, M] = h
      .slice(0, 5)
      .split(':')
      .map((x) => parseInt(x, 10));
    return H * 60 + (M || 0);
  }

  // --- public API ------------------------------------------------------------

  getHostsBasic(eventId: string, dateIso: string) {
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

  getHostsWithSystems(eventId: string, dateIso: string) {
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

  listTakenRooms(eventId: string, dateIso: string) {
    return this.getHostsBasic(eventId, dateIso).pipe(
      map(
        (rows) =>
          new Set(rows.map((r) => r.roomName).filter(Boolean) as string[])
      )
    );
  }

  listExternallyBlockedRooms(
    eventId: string,
    dateIso: string,
    rooms: string[],
    startTime: string,
    endTime: string
  ) {
    if (!rooms?.length) return of(new Set<string>());
    return this.backend
      .getAll<any>(
        'reservations',
        undefined,
        'asc',
        {
          filters: {
            date: { operator: FilterOperator.EQ, value: dateIso },
            room_name: { operator: FilterOperator.IN, value: rooms },
          } as any,
        },
        undefined,
        undefined,
        false
      )
      .pipe(
        map(
          (rows) =>
            (rows ?? []).filter(
              (r) => !r.eventId || r.eventId !== eventId
            ) as Array<{
              roomName: string;
              startTime: string;
              durationHours: number;
            }>
        ),
        map((rows) => {
          const evStart = this.hhmmssToMin(startTime);
          const evEnd = this.hhmmssToMin(endTime);
          const blocked = new Set<string>();
          for (const r of rows) {
            const rs = this.hhmmssToMin(r.startTime);
            const re = rs + Math.max(1, r.durationHours) * 60;
            if (rs < evEnd && evStart < re) blocked.add(r.roomName);
          }
          return blocked;
        })
      );
  }

  // --- create / update / delete signups -------------------------------------

  createSignup(input: IEventHostCreate): Observable<IEventHost> {
    const { imageFile, ...rest } = input;

    const precheck$ = rest.roomName
      ? this.fetchEventMeta(rest.eventId).pipe(
          switchMap(({ start_time, end_time }) =>
            this.assertRoomFree(
              rest.eventId,
              rest.occurrenceDate,
              rest.roomName as string,
              start_time,
              end_time,
              rest.role as HostSignupScope
            )
          )
        )
      : of(void 0);

    const upload$ = imageFile
      ? this.images
          .transcodeAndUpload(
            imageFile,
            `events/${rest.eventId}/hosts/${rest.occurrenceDate}`, // spójna ścieżka
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
          // jeśli upload padnie – NIE zapisujemy rekordu z null
          .pipe(
            // jak chcesz zdebugować: tap(p => console.log('uploaded path:', p)),
            switchMap((p) =>
              p ? of(p) : throwError(() => new Error('Upload failed'))
            )
          )
      : of<string | undefined>(undefined);

    return precheck$.pipe(
      switchMap(() => upload$),
      switchMap((uploadedPath) => {
        const payload = uploadedPath
          ? { ...rest, imagePath: uploadedPath }
          : { ...rest };

        return this.backend.create(
          'event_occurrence_hosts',
          toSnakeCase(payload) as any
        );
      }),

      catchError((err) => {
        const domain = HostSignupConflictError.fromSupabase(err, {
          eventId: rest.eventId,
          dateIso: rest.occurrenceDate,
          roomName: rest.roomName ?? null,
          role: rest.role as HostSignupScope,
        });
        return domain ? throwError(() => domain) : throwError(() => err);
      }),
      map((row: any) => {
        const id = row?.id as string;
        const hostOut: IEventHost = {
          id,
          ...rest,
          imagePath: row?.image_path ?? null,
        } as any;
        return hostOut;
      }),
      switchMap((hostOut) => {
        if (!rest.roomName) return of(hostOut);
        return this.fetchEventMeta(rest.eventId).pipe(
          switchMap(({ auto_reservation }) => {
            if (auto_reservation) return of(hostOut);
            return this.ensureHostReservation(
              rest.eventId,
              rest.occurrenceDate,
              rest.roomName!,
              rest.hostUserId,
              rest.systemId ?? null
            ).pipe(
              map(() => hostOut),
              catchError((err) =>
                this.backend
                  .delete('event_occurrence_hosts', hostOut.id)
                  .pipe(switchMap(() => throwError(() => err)))
              )
            );
          })
        );
      })
    );
  }

  updateHost(id: string, patch: IEventHostUpdate): Observable<void> {
  const { imageFile, ...rest } = patch;

  const prev$ = this.backend.getById<IEventHost>(
    'event_occurrence_hosts',
    id,
    undefined,
    undefined,
    false
  ) as Observable<IEventHost>;

  return prev$.pipe(
    // 1) Precheck konfliktu sali (tylko jeśli zmieniamy salę i jest wskazana)
    switchMap((prev) => {
      const nextRoom = (rest.roomName as string | null | undefined) ?? prev.roomName;
      const roomChanged = (prev.roomName || null) !== (nextRoom || null);

      if (roomChanged && nextRoom) {
        return this.fetchEventMeta(prev.eventId).pipe(
          switchMap(({ start_time, end_time }) =>
            this.assertRoomFree(
              prev.eventId,
              prev.occurrenceDate,
              nextRoom,
              start_time,
              end_time,
              prev.role as HostSignupScope
            )
          ),
          map(() => prev)
        );
      }
      return of(prev);
    }),

    switchMap((prev) => {
      const upload$ = imageFile
        ? this.images
            .transcodeAndUpload(
              imageFile,
              // spójnie z createSignup:
              `events/${prev.eventId}/hosts/${prev.occurrenceDate}`,
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
            .pipe(
              map((p) => p ?? undefined),
              catchError(() => of(undefined))
            )
        : of<string | undefined>(undefined);

      return upload$.pipe(
        switchMap((newImg) => {
          const core: Record<string, unknown> = { ...rest };
          if (newImg !== undefined) core['imagePath'] = newImg;

          const snake = toSnakeCase(core) as Partial<Record<string, unknown>>;
          return this.backend.update('event_occurrence_hosts', id, snake).pipe(map(() => prev));
        }),

        switchMap((prev) => {
          const nextRoom = (rest.roomName as string | null | undefined) ?? prev.roomName;
          const roomChanged = (prev.roomName || null) !== (nextRoom || null);
          const sysChanged =
            Object.prototype.hasOwnProperty.call(rest, 'systemId') &&
            (rest.systemId ?? null) !== (prev.systemId ?? null);

          if (!prev.roomName && !nextRoom && !sysChanged) return of(void 0);

          return this.fetchEventMeta(prev.eventId).pipe(
            switchMap(({ start_time, end_time, auto_reservation }) => {
              const duration_hours = this.diffHours(start_time, end_time);

              if (auto_reservation) {
                if (roomChanged) {
                  const clear$ = prev.roomName
                    ? this.backend
                        .upsert(
                          'reservations',
                          {
                            event_id: prev.eventId,
                            room_name: prev.roomName,
                            date: prev.occurrenceDate,
                            start_time,
                            duration_hours,
                            status: 'confirmed',
                            gm_id: null,
                            system_id: null,
                          } as any,
                          'event_id,room_name,date,start_time'
                        )
                        .pipe(map(() => void 0))
                    : of(void 0);

                  const set$ = nextRoom
                    ? this.backend
                        .upsert(
                          'reservations',
                          {
                            event_id: prev.eventId,
                            room_name: nextRoom,
                            date: prev.occurrenceDate,
                            start_time,
                            duration_hours,
                            status: 'confirmed',
                            gm_id: prev.hostUserId,
                            system_id: (rest.systemId ?? prev.systemId) || null,
                          } as any,
                          'event_id,room_name,date,start_time'
                        )
                        .pipe(map(() => void 0))
                    : of(void 0);

                  return forkJoin([clear$, set$]).pipe(map(() => void 0));
                }

                if (sysChanged && nextRoom) {
                  return this.backend
                    .upsert(
                      'reservations',
                      {
                        event_id: prev.eventId,
                        room_name: nextRoom,
                        date: prev.occurrenceDate,
                        start_time,
                        duration_hours,
                        status: 'confirmed',
                        gm_id: prev.hostUserId,
                        system_id: rest.systemId ?? null,
                      } as any,
                      'event_id,room_name,date,start_time'
                    )
                    .pipe(map(() => void 0));
                }

                return of(void 0);
              }

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
                  rest.systemId ?? null,
                  false
                );
              }

              return of(void 0);
            })
          );
        })
      );
    })
  );
}

  deleteHost(id: string): Observable<void> {
    const prev$ = this.backend.getById<IEventHost>(
      'event_occurrence_hosts',
      id,
      undefined,
      undefined,
      false
    ) as Observable<IEventHost>;

    return prev$.pipe(
      switchMap((prev) =>
        this.backend.delete('event_occurrence_hosts', id).pipe(
          switchMap(() => {
            if (!prev.roomName) return of(void 0);
            return this.fetchEventMeta(prev.eventId).pipe(
              switchMap(({ start_time, end_time, auto_reservation }) => {
                if (auto_reservation) {
                  const duration_hours = this.diffHours(start_time, end_time);
                  return this.backend
                    .upsert(
                      'reservations',
                      {
                        event_id: prev.eventId,
                        room_name: prev.roomName,
                        date: prev.occurrenceDate,
                        start_time,
                        duration_hours, // ⬅️ ZOSTAJE
                        status: 'confirmed', // ⬅️ OK
                        gm_id: null,
                        system_id: null,
                      } as any,
                      'event_id,room_name,date,start_time'
                    )
                    .pipe(map(() => void 0));
                }
                return this.deleteHostReservation(
                  prev.eventId,
                  prev.occurrenceDate,
                  prev.roomName!,
                  prev.hostUserId
                );
              })
            );
          })
        )
      )
    );
  }

  updateSignup(id: string, patch: Partial<IEventHostUpdate>) {
    return this.updateHost(id, patch as IEventHostUpdate);
  }
  deleteSignup(id: string) {
    return this.deleteHost(id);
  }

  // --- reservations (manual mode) -------------------------------------------

  private ensureHostReservation(
    eventId: string,
    dateIso: string,
    roomName: string,
    hostUserId: string,
    systemId: string | null
  ): Observable<void> {
    return this.fetchEventMeta(eventId).pipe(
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
        return this.backend.create('reservations', row).pipe(map(() => void 0));
      }),
      catchError((err) => {
        const code = (err as any)?.code ?? (err as any)?.error?.code ?? '';
        if (String(code) === '23505') return of(void 0);
        return throwError(() => err);
      })
    );
  }

  private deleteHostReservation(
    eventId: string,
    dateIso: string,
    roomName: string,
    hostUserId: string
  ) {
    return this.backend.delete('reservations', {
      event_id: { operator: FilterOperator.EQ, value: eventId },
      date: { operator: FilterOperator.EQ, value: dateIso },
      room_name: { operator: FilterOperator.EQ, value: roomName },
      gm_id: { operator: FilterOperator.EQ, value: hostUserId },
    } as any);
  }

  /** dla manualnych slotów (auto=false) + wykorzystywana także przy auto=true w gałęzi „tylko update” */
  private updateHostReservationSystem(
    eventId: string,
    dateIso: string,
    roomName: string,
    hostUserId: string,
    systemId: string | null,
    forceAutoMode?: boolean
  ) {
    return this.fetchEventMeta(eventId).pipe(
      switchMap(({ start_time, end_time, auto_reservation }) => {
        const auto = forceAutoMode ?? auto_reservation;
        const duration_hours = this.diffHours(start_time, end_time);

        if (auto) {
          // AUTO: upsert po unikatowym slocie (event_id, room_name, date, start_time)
          return this.backend
            .upsert(
              'reservations',
              {
                event_id: eventId,
                room_name: roomName,
                date: dateIso,
                start_time,
                duration_hours, // wymagane NOT NULL
                status: 'confirmed',
                gm_id: hostUserId,
                system_id: systemId,
              } as any,
              'event_id,room_name,date,start_time'
            )
            .pipe(map(() => void 0));
        }

        // MANUAL: znajdź konkretny rekord po filtrach i zaktualizuj tylko system_id
        return this.backend
          .getAll<any>(
            'reservations',
            undefined,
            'asc',
            {
              filters: {
                event_id: { operator: FilterOperator.EQ, value: eventId },
                room_name: { operator: FilterOperator.EQ, value: roomName },
                date: { operator: FilterOperator.EQ, value: dateIso },
                start_time: { operator: FilterOperator.EQ, value: start_time },
                gm_id: { operator: FilterOperator.EQ, value: hostUserId },
              } as any,
            },
            undefined,
            undefined,
            false
          )
          .pipe(
            map((rows) => rows?.[0] ?? null),
            switchMap((row) => {
              if (!row?.id) return of(void 0); // brak slota = nic nie zmieniamy
              // klucz: snake_case w payloadzie, bo update() nie snake’uje
              return this.backend
                .update('reservations', row.id, { system_id: systemId } as any)
                .pipe(map(() => void 0));
            })
          );
      })
    );
  }

  // --- conflicts -------------------------------------------------------------

  private assertRoomFree(
    eventId: string,
    dateIso: string,
    roomName: string,
    startTime: string,
    endTime: string,
    role: HostSignupScope
  ): Observable<void> {
    return this.listExternallyBlockedRooms(
      eventId,
      dateIso,
      [roomName],
      startTime,
      endTime
    ).pipe(
      map((blocked) => {
        if (blocked.has(roomName)) {
          throw new HostSignupConflictError(eventId, dateIso, roomName, role);
        }
        return void 0;
      })
    );
  }
}
