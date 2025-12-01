import { Injectable } from '@angular/core';
import { EventFull, EventRoomPlan } from '../../interfaces/i-events';
import { HostSignupLevel, RoomPurpose, RoomScheduleKind } from '../../enums/event-rooms';
import { HostSignupScope } from '../../enums/events';
import { TimeUtil } from './time.util';

export type SlotDef = {
  startTime: string; // 'HH:mm:ss'
  endTime: string;   // 'HH:mm:ss'
  purpose: RoomPurpose;
  title: string | null;

  /** Efektywny poziom zgłoszeń (Event/Room/Slot) – legacy, ale przydatne do UI */
  hostSignup: HostSignupLevel;

  /** NEW: czy ten slot finalnie wymaga prowadzących (po kaskadzie slot→room→event) */
  requiresHosts: boolean;

  /** NEW: efektywny scope prowadzących (STAFF / ANY) po kaskadzie */
  hostScope: HostSignupScope;
};

@Injectable({ providedIn: 'root' })
export class SlotsUtil {
  constructor(private readonly time: TimeUtil) {}

  listRoomSlotsFE(ev: EventFull): Array<{ roomName: string; slots: SlotDef[] }> {
    const hasPlans = Array.isArray(ev.roomPlans) && ev.roomPlans.length > 0;
    const rooms = hasPlans ? (ev.roomPlans ?? []).map((p) => p.roomName) : (ev.rooms ?? []);
    const out: Array<{ roomName: string; slots: SlotDef[] }> = [];

    if (hasPlans) {
      const plansByRoom = new Map<string, EventRoomPlan>(
        (ev.roomPlans ?? []).map((p) => [p.roomName, p])
      );
      for (const room of rooms) {
        const plan = plansByRoom.get(room);
        if (!plan) continue;
        out.push({ roomName: room, slots: this.generateSlotsForRoom(ev, plan) });
      }
      return out;
    }

    // Brak planów – pojedynczy slot na salę wg eventu
    const purposeFromEvent =
      ev.attractionType === 'SESSION'
        ? RoomPurpose.Session
        : ev.attractionType === 'DISCUSSION'
        ? RoomPurpose.Discussion
        : RoomPurpose.Entertainment;

    const start = this.time.hhmmss(ev.startTime);
    const end = this.time.hhmmss(ev.endTime);

    const eventLevel = (ev.hostSignupLevel ?? HostSignupLevel.Event) as HostSignupLevel;
    const eventRequires = !!ev.requiresHosts;
    const eventScope = (ev.hostSignup ?? HostSignupScope.Staff) as HostSignupScope;

    for (const r of rooms) {
      out.push({
        roomName: r,
        slots: [
          {
            startTime: start,
            endTime: end,
            purpose: purposeFromEvent,
            title:
              purposeFromEvent === RoomPurpose.Entertainment
                ? 'Rozrywka'
                : null,
            hostSignup: eventLevel,
            requiresHosts: eventRequires,
            hostScope: eventScope,
          },
        ],
      });
    }
    return out;
  }

  generateSlotsForRoom(ev: EventFull, plan: EventRoomPlan): SlotDef[] {
    const evStart = this.time.hhmmss(ev.startTime);
    const evEnd = this.time.hhmmss(ev.endTime);
    const defaultPurpose = (plan.purpose ?? RoomPurpose.None) as RoomPurpose;
    const defaultTitle = plan.customTitle ?? null;

    const eventLevel = (ev.hostSignupLevel ?? HostSignupLevel.Event) as HostSignupLevel;
    const roomLevel = (plan.hostSignup ?? null) as HostSignupLevel | null;
    const effectiveLevel = (slotLevel?: HostSignupLevel | null): HostSignupLevel =>
      (slotLevel ?? roomLevel ?? eventLevel);

    // --- Kaskada requiresHosts (slot -> room -> event) ---
    const eventRequires = !!ev.requiresHosts;
    const roomRequiresTri = (plan as any).requiresHosts as boolean | null | undefined;

    // ważne: NULL / false na salce = "nie zbiera MG" (nie dziedziczymy po evencie)
    const roomRequires =
      roomRequiresTri === true
        ? true
        : roomRequiresTri === false || roomRequiresTri === null
        ? false
        : eventRequires; // tylko przy undefined dziedziczymy z eventu

    // --- Kaskada scope (slot -> room -> event) ---
    const eventScope = (ev.hostSignup ?? HostSignupScope.Staff) as HostSignupScope;
    const roomScope = ((plan as any).hostScope ?? null) as HostSignupScope | null;

    const effectiveScope = (slotScope?: HostSignupScope | null): HostSignupScope =>
      (slotScope ?? roomScope ?? eventScope);

    const schedule = (plan.scheduleKind ?? RoomScheduleKind.FullSpan) as RoomScheduleKind;

    // --- FULL_SPAN ---
    if (schedule === RoomScheduleKind.FullSpan) {
      return [
        {
          startTime: evStart,
          endTime: evEnd,
          purpose: defaultPurpose,
          title:
            defaultPurpose === RoomPurpose.Entertainment
              ? (defaultTitle ?? 'Rozrywka')
              : null,
          hostSignup: effectiveLevel(null),
          requiresHosts: roomRequires,
          hostScope: effectiveScope(null),
        },
      ];
    }

    // --- INTERVAL (bez 37:00, z obsługą przejścia przez północ) ---
    if (schedule === RoomScheduleKind.Interval) {
      const intervalH = Math.max(1, Number(plan.intervalHours ?? 0) || 0);

      let total = this.time.diffHours(evStart, evEnd);
      // jeśli end <= start → zakładamy przejście przez północ
      if (total <= 0) {
        total += 24;
      }

      const out: SlotDef[] = [];
      let remaining = total;
      let cursor = evStart;

      while (remaining > 0) {
        const step = Math.min(intervalH, remaining);
        const slotEnd = this.time.addHours(cursor, step);

        out.push({
          startTime: cursor,
          endTime: slotEnd,
          purpose: defaultPurpose,
          title:
            defaultPurpose === RoomPurpose.Entertainment
              ? (defaultTitle ?? 'Rozrywka')
              : null,
          hostSignup: effectiveLevel(null),
          requiresHosts: roomRequires,
          hostScope: effectiveScope(null),
        });

        cursor = slotEnd;
        remaining -= step;
      }

      return out;
    }

    // --- SCHEDULE (ręczne sloty) ---
    const explicit = (plan.slots ?? []).map<SlotDef>((s) => {
      const st = this.time.hhmmss(s.startTime as any);
      const en = this.time.hhmmss(s.endTime as any);
      const p = (s.purpose as RoomPurpose | undefined) ?? defaultPurpose;

      // per-slot override:
      //  TRUE  → slot zbiera MG
      //  FALSE / NULL → slot NIE zbiera MG (nie dziedziczymy)
      //  undefined → dziedziczy roomRequires
      const slotRequiresTri = (s as any).requiresHosts as boolean | null | undefined;
      const slotRequires =
        slotRequiresTri === true
          ? true
          : slotRequiresTri === false || slotRequiresTri === null
          ? false
          : roomRequires;

      const slotScope = ((s as any).hostScope ?? null) as HostSignupScope | null;

      return {
        startTime: st,
        endTime: en,
        purpose: p,
        title:
          p === RoomPurpose.Entertainment
            ? (s.customTitle ?? defaultTitle ?? 'Rozrywka')
            : (s.customTitle ?? null),
        hostSignup: effectiveLevel((s.hostSignup as HostSignupLevel | null) ?? null),
        requiresHosts: slotRequires,
        hostScope: effectiveScope(slotScope),
      };
    });

    // zostawiamy tylko sensowne sloty (>0h); NIE przycinamy do [evStart, evEnd],
    // bo ręczne sloty mogą minimalnie wystawać i nie chcemy ich wycinać po cichu
    return explicit.filter(
      (sl) => this.time.diffHours(sl.startTime, sl.endTime) > 0
    );
  }
}
