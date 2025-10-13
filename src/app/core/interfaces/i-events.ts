import {
  AttractionKind,
  EventTag,
  HostSignupScope,
  RecurrenceKind,
  ParticipantSignupScope,
} from '../enums/events';
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
  /** Default host granularity (fallback = EVENT) */
  hostSignupLevel?: HostSignupLevel;

  /** Participants on event level */
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

/** Plan sali (room-level) + ewentualne ręczne sloty */
export interface EventRoomPlan {
  roomName: string;
  purpose: RoomPurpose;
  customTitle?: string | null;

  scheduleKind: RoomScheduleKind;
  intervalHours?: number | null;

  // Hosts @ room/slot
  hostSignup?: HostSignupLevel | null;     // ROOM vs SLOT
  requiresHosts?: boolean | null;
  hostScope?: HostSignupScope | null;

  // Participants @ room level (dla FullSpan/Interval, oraz defaulty dla Schedule)
  requiresParticipants?: boolean | null;
  participantSignup?: ParticipantSignupScope | null; // zostawione dla zgodności
  sessionCapacity?: number | null;                   // 3–5 dla Session

  // Ręczne sloty (Schedule)
  slots?: Array<{
    startTime: string;
    endTime: string;
    purpose?: RoomPurpose;
    customTitle?: string | null;
    hostSignup?: HostSignupLevel | null;

    // NEW: participants @ slot level
    requiresParticipants?: boolean | null;
    participantSignup?: ParticipantSignupScope | null; // dla spójności
    sessionCapacity?: number | null;                   // 3–5 dla Session
    requiresHosts?: boolean | null;
    hostScope?: HostSignupScope | null;
  }> | null;
}

export type EventFull = EventCore & {
  singleDate?: string;
  recurrence?: RecurrenceRule;
  roomPlans?: EventRoomPlan[] | null;
};

/** Zrzut z joinów DB -> mapper konwertuje na EventFull */
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
    requiresHosts?: boolean | null;
    hostScope?: HostSignupScope | null;

    requiresParticipants?: boolean | null;
    participantSignup?: ParticipantSignupScope | null;
    sessionCapacity?: number | null;
  }>;

  eventRoomSlots?: Array<{
    roomName: string;
    startTime: string; // 'HH:mm' | 'HH:mm:ss'
    endTime: string;   // 'HH:mm' | 'HH:mm:ss'
    purpose?: RoomPurpose | null;
    customTitle?: string | null;
    hostSignup?: HostSignupLevel | null;
    requiresHosts?: boolean | null;
    hostScope?: HostSignupScope | null;

    // NEW on slot
    requiresParticipants?: boolean | null;
    participantSignup?: ParticipantSignupScope | null;
    sessionCapacity?: number | null;
  }>;
};
