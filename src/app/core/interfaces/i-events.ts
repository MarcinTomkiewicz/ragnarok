import {
  AttractionKind,
  EventTag,
  HostSignupScope,
  RecurrenceKind,
} from '../enums/events';
import { ParticipantSignupScope } from '../enums/events';

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

export type EventFull = EventCore & {
  singleDate?: string;
  recurrence?: RecurrenceRule;
};
