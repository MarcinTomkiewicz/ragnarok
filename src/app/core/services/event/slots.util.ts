import { Injectable } from '@angular/core';
import { EventFull, EventRoomPlan } from '../../interfaces/i-events';
import { HostSignupLevel, RoomPurpose, RoomScheduleKind } from '../../enums/event-rooms';
import { TimeUtil } from './time.util';

export type SlotDef = {
  startTime: string; // 'HH:mm:ss'
  endTime: string;   // 'HH:mm:ss'
  purpose: RoomPurpose;
  title: string | null;
  hostSignup: HostSignupLevel;
};

@Injectable({ providedIn: 'root' })
export class SlotsUtil {
  constructor(private readonly time: TimeUtil) {}

  listRoomSlotsFE(ev: EventFull): Array<{ roomName: string; slots: SlotDef[] }> {
    const hasPlans = Array.isArray(ev.roomPlans) && ev.roomPlans.length > 0;
    const rooms = hasPlans ? (ev.roomPlans ?? []).map((p) => p.roomName) : (ev.rooms ?? []);
    const out: Array<{ roomName: string; slots: SlotDef[] }> = [];

    if (hasPlans) {
      const plansByRoom = new Map<string, EventRoomPlan>((ev.roomPlans ?? []).map((p) => [p.roomName, p]));
      for (const room of rooms) {
        const plan = plansByRoom.get(room);
        if (!plan) continue;
        out.push({ roomName: room, slots: this.generateSlotsForRoom(ev, plan) });
      }
      return out;
    }

    const purposeFromEvent =
      ev.attractionType === 'SESSION'
        ? RoomPurpose.Session
        : ev.attractionType === 'DISCUSSION'
        ? RoomPurpose.Discussion
        : RoomPurpose.Entertainment;

    const start = this.time.hhmmss(ev.startTime);
    const end = this.time.hhmmss(ev.endTime);

    for (const r of rooms) {
      out.push({
        roomName: r,
        slots: [
          {
            startTime: start,
            endTime: end,
            purpose: purposeFromEvent,
            title: purposeFromEvent === RoomPurpose.Entertainment ? 'Rozrywka' : null,
            hostSignup: (ev.hostSignupLevel ?? HostSignupLevel.Event) as HostSignupLevel,
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

    if ((plan.scheduleKind ?? RoomScheduleKind.FullSpan) === RoomScheduleKind.FullSpan) {
      return [
        {
          startTime: evStart,
          endTime: evEnd,
          purpose: defaultPurpose,
          title: defaultPurpose === RoomPurpose.Entertainment ? (defaultTitle ?? 'Rozrywka') : null,
          hostSignup: effectiveLevel(null),
        },
      ];
    }

    if (plan.scheduleKind === RoomScheduleKind.Interval) {
      const intervalH = Math.max(1, Number(plan.intervalHours ?? 0) || 0);
      const out: SlotDef[] = [];
      let cursor = evStart;
      while (this.time.diffHours(cursor, evEnd) > 0) {
        const nextEndHours = Math.min(
          this.time.diffHours(evStart, evEnd),
          this.time.diffHours(evStart, cursor) + intervalH
        );
        const slotEnd = this.time.addHours(evStart, nextEndHours);
        out.push({
          startTime: cursor,
          endTime: slotEnd,
          purpose: defaultPurpose,
          title: defaultPurpose === RoomPurpose.Entertainment ? (defaultTitle ?? 'Rozrywka') : null,
          hostSignup: effectiveLevel(null),
        });
        cursor = slotEnd;
      }
      return out;
    }

    const explicit = (plan.slots ?? []).map<SlotDef>((s) => {
      const st = this.time.hhmmss(s.startTime);
      const en = this.time.hhmmss(s.endTime);
      const p = (s.purpose as RoomPurpose | undefined) ?? defaultPurpose;
      return {
        startTime: st,
        endTime: en,
        purpose: p,
        title: p === RoomPurpose.Entertainment ? (s.customTitle ?? defaultTitle ?? 'Rozrywka') : (s.customTitle ?? null),
        hostSignup: effectiveLevel((s.hostSignup as HostSignupLevel | null) ?? null),
      };
    });

    return explicit
      .filter((sl) => this.time.diffHours(sl.startTime, sl.endTime) > 0)
      .filter((sl) => this.time.hhmmss(sl.startTime) >= evStart && this.time.hhmmss(sl.endTime) <= evEnd);
  }
}
