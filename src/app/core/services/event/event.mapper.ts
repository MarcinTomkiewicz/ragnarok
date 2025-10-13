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
        intervalHours: this.asMaybeNumber(p.intervalHours),

        hostSignup: (p.hostSignup ?? null) as HostSignupLevel | null,

        requiresHosts: this.asBoolTri(p.requiresHosts),
        hostScope: p.hostScope ?? null,

        // participants @ room (tri-state, bez utraty wartości)
        requiresParticipants: this.asBoolTri(p.requiresParticipants),
        participantSignup: p.participantSignup ?? null,
        sessionCapacity: this.asMaybeNumber(p.sessionCapacity),

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

        hostSignup: (s.hostSignup ?? null) as HostSignupLevel | null,
        requiresHosts: this.asBoolTri(s.requiresHosts),
        hostScope: s.hostScope ?? null,

        // participants @ slot – to było brakujące
        requiresParticipants: this.asBoolTri(s.requiresParticipants),
        participantSignup: s.participantSignup ?? null,
        sessionCapacity: this.asMaybeNumber(s.sessionCapacity),
      });
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

      // event-level participants
      participantSignup: (row.participantSignup ?? ParticipantSignupScope.None) as ParticipantSignupScope,
      signupRequired: !!row.signupRequired,
      wholeCapacity: row.wholeCapacity ?? null,
      sessionCapacity: row.sessionCapacity ?? null,
      signupOpensAt: row.signupOpensAt ?? undefined,
      signupClosesAt: row.signupClosesAt ?? undefined,

      hostSignupLevel,
      roomPlans,
    };
  }

  // ───────── helpers ─────────
  private asBoolTri(v: boolean | null | undefined): boolean | null {
    return v === true ? true : v === false ? false : null;
  }

  private asMaybeNumber(v: number | string | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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
