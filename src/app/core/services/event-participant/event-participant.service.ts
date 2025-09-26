import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BackendService } from '../../services/backend/backend.service';
import { FilterOperator } from '../../enums/filterOperator';
import { toCamelCase } from '../../utils/type-mappers';

import {
  IEventParticipant,
  IEventParticipantCreateGuest,
  IEventParticipantCreateUser,
} from '../../interfaces/i-event-participant';
import { IUser } from '../../interfaces/i-user';
import { AuthService } from '../../services/auth/auth.service';
import { hasMinimumCoworkerRole } from '../../utils/required-roles';
import { CoworkerRoles } from '../../enums/roles';

@Injectable({ providedIn: 'root' })
export class EventParticipantsService {
  private readonly backend = inject(BackendService);
  private readonly auth = inject(AuthService);
  private readonly TABLE = 'event_participants';

  createForUser(
    input: IEventParticipantCreateUser
  ): Observable<IEventParticipant> {
    const me: IUser | null = this.auth.user();
    
    if (!me?.id) throw new Error('Brak zalogowanego użytkownika.');

    const payload = {
      eventId: input.eventId,
      occurrenceDate: input.occurrenceDate,
      hostId: input.hostId ?? null,
      roomName: input.roomName ?? null,
      userId: me.id,
      guestName: null,
      guestPhone: null,
      note: input.note ?? null,
    };

    return this.backend
      .create<any>(this.TABLE, payload)
      .pipe(map((row) => toCamelCase<IEventParticipant>(row)));
  }

  createForGuest(
    input: IEventParticipantCreateGuest
  ): Observable<IEventParticipant> {
    
    const payload = {
      eventId: input.eventId,
      occurrenceDate: input.occurrenceDate,
      hostId: input.hostId ?? null,
      roomName: input.roomName ?? null,
      userId: null,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      note: input.note ?? null,
    };

    return this.backend
      .create<any>(this.TABLE, payload)
      .pipe(map((row) => toCamelCase<IEventParticipant>(row)));
  }

  /** Lista zapisów dla danej daty + zakresu (sesja/salka/cały event) */
  listForOccurrence(
    eventId: string,
    dateIso: string,
    scope?: { hostId?: string | null; roomName?: string | null }
  ): Observable<IEventParticipant[]> {
    const hostFilter = scope?.hostId
      ? { host_id: { operator: FilterOperator.EQ, value: scope.hostId } }
      : { host_id: { operator: FilterOperator.IS, value: null } }; // „na cały event”

    const roomFilter = scope?.roomName
      ? { room_name: { operator: FilterOperator.EQ, value: scope.roomName } }
      : {};

    return this.backend
      .getAll<IEventParticipant>(
        this.TABLE,
        'createdAt',
        'asc',
        {
          filters: {
            event_id: { operator: FilterOperator.EQ, value: eventId },
            occurrence_date: { operator: FilterOperator.EQ, value: dateIso },
            deleted_at: { operator: FilterOperator.IS, value: null }, // wymaga wsparcia IS w applyFilters
            ...hostFilter,
            ...roomFilter,
          } as any,
        },
        undefined,
        undefined,
        false
      )
      .pipe(map((rows) => rows.map((r) => toCamelCase<IEventParticipant>(r))));
  }

  /** Miękkie usunięcie */
  softDelete(id: string): Observable<void> {
    return this.backend
      .update<IEventParticipant>(this.TABLE, id, {
        deletedAt: new Date().toISOString(),
      } as any)
      .pipe(map(() => void 0));
  }

  /** Uprawnienia do usunięcia */
  canDelete(current: IUser | null, p: IEventParticipant): boolean {
    if (!current) return false;
    if (p.userId && p.userId === current.id) return true; // właściciel wpisu
    return hasMinimumCoworkerRole(current, CoworkerRoles.Reception);
  }
}
