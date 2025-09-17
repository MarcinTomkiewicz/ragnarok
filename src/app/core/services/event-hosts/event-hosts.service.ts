import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
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

    const upload$: Observable<string | null> = imageFile
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
              role: rest.role, // HostSignupScope
            });
            return domain ? throwError(() => domain) : throwError(() => err);
          }),
          map((res) => res.data as IEventHost)
        );
      })
    );
  }

  updateHost(id: string, patch: IEventHostUpdate): Observable<void> {
    const { imageFile, ...rest } = patch;

    const upload$: Observable<string | undefined> = imageFile
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

    return upload$.pipe(
      switchMap((newImg) => {
        const core: Record<string, unknown> = { ...rest };
        if (newImg !== undefined) core['imagePath'] = newImg;

        const snake = toSnakeCase(core) as Partial<Record<string, unknown>>;
        return this.backend
          .update<Record<string, unknown>>('event_occurrence_hosts', id, snake)
          .pipe(
            map(() => void 0),
            catchError((err) => {
              const domain = HostSignupConflictError.fromSupabase(err, {
                eventId: (patch as any).eventId ?? 'unknown',
                dateIso: (patch as any).occurrenceDate ?? 'unknown',
                roomName: (rest as any).roomName ?? null,
                role:
                  (rest as any).role ??
                  (HostSignupScope.Staff as HostSignupScope),
              });
              return domain ? throwError(() => domain) : throwError(() => err);
            })
          );
      })
    );
  }

  deleteHost(id: string): Observable<void> {
    return this.backend.delete('event_occurrence_hosts', id);
  }
}
