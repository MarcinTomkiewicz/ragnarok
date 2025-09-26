export interface IEventParticipant {
  id: string;
  eventId: string;
  occurrenceDate: string; // ISO yyyy-mm-dd
  hostId: string | null;  // gdy zapis na sesję
  roomName: string | null; // alternatywa, gdy zapis na salę
  userId: string | null;   // zalogowany
  guestName: string | null; // gość
  guestPhone: string | null;
  createdAt: string;
  deletedAt: string | null;
  note?: string | null;
}

export type IEventParticipantCreateUser = {
  eventId: string;
  occurrenceDate: string;
  hostId?: string | null;
  roomName?: string | null;
  note?: string | null;
};

export type IEventParticipantCreateGuest = {
  eventId: string;
  occurrenceDate: string;
  hostId?: string | null;
  roomName?: string | null;
  guestName: string;
  guestPhone: string;
  note?: string | null;
};

export interface IEventParticipantVM extends IEventParticipant {
  displayName: string;
  isGuest: boolean;
  isSelf: boolean;
}

export interface IEventParticipantInsert {
  eventId: string;
  occurrenceDate: string;
  hostId: string | null;
  roomName: string | null;
  userId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  note: string | null;
}

