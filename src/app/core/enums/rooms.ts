export enum Rooms {
  Midgard = 'Midgard',
  Asgard = 'Asgard',
  Alfheim = 'Alfheim',
  Jotunheim = 'Jotunheim',
}

export const RoomDisplay: Record<Rooms, string> = {
  [Rooms.Midgard]: 'Midgard',
  [Rooms.Asgard]: 'Asgard',
  [Rooms.Alfheim]: 'Alfheim',
  [Rooms.Jotunheim]: 'Jotunheim',
};

export const SortedRooms: Rooms[] = [
  Rooms.Midgard,
  Rooms.Asgard,
  Rooms.Alfheim,
  Rooms.Jotunheim,
];