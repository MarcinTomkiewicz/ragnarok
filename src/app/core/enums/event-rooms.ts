// Labels for room purpose; values align with AttractionKind
export enum RoomPurpose {
  Session = 'SESSION',
  Discussion = 'DISCUSSION',
  Entertainment = 'ENTERTAINMENT',
  None = 'NONE',
}

export const RoomPurposeLabel: Record<RoomPurpose, string> = {
  [RoomPurpose.Session]: 'Sesja RPG',
  [RoomPurpose.Discussion]: 'Dyskusja',
  [RoomPurpose.Entertainment]: 'Rozrywka',
  [RoomPurpose.None]: 'Brak',
};

export enum RoomScheduleKind {
  FullSpan = 'FULL_SPAN',
  Interval = 'INTERVAL',
  Schedule = 'SCHEDULE',
}

export enum HostSignupLevel {
  Event = 'EVENT',
  Room = 'ROOM',
  Slot = 'SLOT',
}
