import {
  AttractionKind,
  EventTag,
  HostSignupScope,
  RecurrenceKind,
} from '../enums/events';
import { ParticipantSignupScope } from '../enums/events';
import {
  HostSignupLevel,
  RoomPurpose,
  RoomScheduleKind,
} from '../enums/event-rooms';

export interface EventCore {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  coverImagePath?: string;
  facebookLink?: string;
  isActive: boolean;
  isForBeginners: boolean;
  requiresHosts: boolean;
  attractionType: AttractionKind;
  hostSignup: HostSignupScope;
  participantSignup?: ParticipantSignupScope | null;
  signupRequired: boolean;
  wholeCapacity?: number | null;
  sessionCapacity?: number | null;
  signupOpensAt?: string | null;
  signupClosesAt?: string | null;
  timezone: string;
  startTime: string;
  endTime: string;
  tags: EventTag[];
  rooms: string[];
  entryFeePln: number;
  autoReservation: boolean;

  /** Default host-signup granularity; falls back to EVENT if absent */
  hostSignupLevel?: HostSignupLevel; 
}

export interface RecurrenceRule {
  kind: RecurrenceKind;
  interval: number;
  byweekday?: number[];
  monthlyNth?: number;
  monthlyWeekday?: number;
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  exdates: string[];
}

/** Room-level plan driving generated or manual slots */
export interface EventRoomPlan {
  roomName: string;
  purpose: RoomPurpose;
  customTitle?: string | null;
  scheduleKind: RoomScheduleKind;
  intervalHours?: number | null;
  hostSignup?: HostSignupLevel | null;
  requiresHosts?: boolean | null;
  hostScope?: HostSignupScope | null;
  slots?: Array<{
    startTime: string;
    endTime: string; 
    purpose?: RoomPurpose;
    customTitle?: string | null;
    hostSignup?: HostSignupLevel | null;
  }> | null;
}

export type EventFull = EventCore & {
  singleDate?: string;
  recurrence?: RecurrenceRule;

  /** Optional advanced room planning; when absent app behaves as today */
  roomPlans?: EventRoomPlan[] | null;
};

export type EventDbJoined = Omit<
  EventFull,
  'tags' | 'rooms' | 'recurrence' | 'roomPlans'
> & {
  eventTags?: Array<{ tag: EventTag }>;
  eventRooms?: Array<{ roomName: string }>;

  eventRecurrence?: {
    kind: RecurrenceKind;
    interval: number;
    byweekday?: number[] | null;
    monthlyNth?: number | null;
    monthlyWeekday?: number | null;
    dayOfMonth?: number | null;
    startDate: string;
    endDate?: string | null;
    exdates?: string[] | null;
  } | null;

  eventRoomPlans?: Array<{
    roomName: string;
    purpose?: RoomPurpose | null;
    customTitle?: string | null;
    scheduleKind?: RoomScheduleKind | null;
    intervalHours?: number | null;
    hostSignup?: HostSignupLevel | null;
  }>;

  eventRoomSlots?: Array<{
    roomName: string;
    startTime: string; // 'HH:mm' | 'HH:mm:ss'
    endTime: string; // 'HH:mm' | 'HH:mm:ss'
    purpose?: RoomPurpose | null;
    customTitle?: string | null;
    hostSignup?: HostSignupLevel | null;
  }>;
};
