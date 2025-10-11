import { Injectable } from '@angular/core';
import { EventFull, RecurrenceRule, EventRoomPlan, EventDbJoined } from '../../interfaces/i-events';
import { EventTag, RecurrenceKind, ParticipantSignupScope } from '../../enums/events';
import { HostSignupLevel, RoomPurpose, RoomScheduleKind } from '../../enums/event-rooms';

@Injectable({ providedIn: 'root' })
export class EventMapper {
  mapDbToEventFull(row: EventDbJoined): EventFull {
    const tags: EventTag[] = (row.eventTags ?? []).map((t) => t.tag);
    const rooms: string[] = (row.eventRooms ?? []).map((r) => r.roomName);

    const r = row.eventRecurrence;
    const recurrence: RecurrenceRule | undefined = r
      ? {
          kind: r.kind as RecurrenceKind,
          interval: r.interval,
          byweekday: r.byweekday ?? undefined,
          monthlyNth: r.monthlyNth ?? undefined,
          monthlyWeekday: r.monthlyWeekday ?? undefined,
          dayOfMonth: r.dayOfMonth ?? undefined,
          startDate: r.startDate,
          endDate: r.endDate ?? undefined,
          exdates: r.exdates ?? [],
        }
      : undefined;

    const hostSignupLevel = (row.hostSignupLevel ?? HostSignupLevel.Event) as HostSignupLevel;

    // === PLANY SAL ===
    const plansByRoom = new Map<string, EventRoomPlan>();
    for (const p of row.eventRoomPlans ?? []) {
      const plan: EventRoomPlan = {
        roomName: p.roomName,
        purpose: (p.purpose ?? RoomPurpose.None) as RoomPurpose,
        customTitle: p.customTitle ?? null,
        scheduleKind: (p.scheduleKind ?? RoomScheduleKind.FullSpan) as RoomScheduleKind,
        intervalHours: p.intervalHours ?? null,
        // legacy
        hostSignup: (p.hostSignup ?? null) as HostSignupLevel | null,

        // NEW: wymagania prowadzących na poziomie salki (tri-state)
        requiresHosts: (p as any).requiresHosts ?? null,
        hostScope: (p as any).hostScope ?? null,

        // NEW opcjonalnie: pola uczestników per room (jeśli masz kolumny)
        ...(p as any).requiresParticipants !== undefined ? { requiresParticipants: (p as any).requiresParticipants } : {},
        ...(p as any).participantSignup !== undefined ? { participantSignup: (p as any).participantSignup } : {},
        ...(p as any).sessionCapacity !== undefined ? { sessionCapacity: (p as any).sessionCapacity } : {},

        slots: [],
      };
      plansByRoom.set(plan.roomName, plan);
    }

    // === SLOTY ===
    for (const s of row.eventRoomSlots ?? []) {
      const plan = plansByRoom.get(s.roomName);
      if (!plan) continue;
      (plan.slots ??= []).push({
        startTime: this.hhmmss(s.startTime),
        endTime: this.hhmmss(s.endTime),
        purpose: (s.purpose ?? undefined) as RoomPurpose | undefined,
        customTitle: s.customTitle ?? null,
        // legacy
        hostSignup: (s.hostSignup ?? null) as (HostSignupLevel | null),

        // NEW: wymagania prowadzących na poziomie slotu (tri-state)
        ...((s as any).requiresHosts !== undefined ? { requiresHosts: (s as any).requiresHosts } : {}),
        ...((s as any).hostScope !== undefined ? { hostScope: (s as any).hostScope } : {}),
      } as any);
    }

    const roomPlans = plansByRoom.size ? Array.from(plansByRoom.values()) : null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDescription: row.shortDescription,
      longDescription: row.longDescription,
      coverImagePath: row.coverImagePath ?? undefined,
      facebookLink: row.facebookLink ?? undefined,
      isActive: !!row.isActive,
      isForBeginners: !!row.isForBeginners,
      requiresHosts: !!row.requiresHosts,  
      attractionType: row.attractionType,
      hostSignup: row.hostSignup,          
      timezone: row.timezone,
      startTime: this.hhmmss(row.startTime),
      endTime: this.hhmmss(row.endTime),
      singleDate: row.singleDate ?? undefined,
      tags,
      rooms,
      entryFeePln: Number(row.entryFeePln ?? 0),
      recurrence,
      autoReservation: !!row.autoReservation,

      // zapisy uczestników (event-level)
      participantSignup: (row.participantSignup ?? 'WHOLE') as ParticipantSignupScope,
      signupRequired: !!row.signupRequired,
      wholeCapacity: row.wholeCapacity ?? null,
      sessionCapacity: row.sessionCapacity ?? null,
      signupOpensAt: row.signupOpensAt ?? undefined,
      signupClosesAt: row.signupClosesAt ?? undefined,

      hostSignupLevel,
      roomPlans,
    };
  }

  private hhmm(hhmmOrS: string): string {
    const s = (hhmmOrS ?? '').slice(0, 5);
    const [H, M] = s.split(':');
    return `${String(H ?? '00').padStart(2, '0')}:${String(M ?? '00').padStart(2, '0')}`;
  }
  private hhmmss(hhmmOrS: string): string {
    return `${this.hhmm(hhmmOrS)}:00`;
  }
}
