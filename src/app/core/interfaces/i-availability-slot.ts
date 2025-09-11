export type WorkType = 'gm' | 'reception' | 'external_event';

type AvailabilityBase = {
  id?: string;
  userId: string;
  date: string;        // 'yyyy-MM-dd'
  workType: WorkType;
};

export type IAvailabilityTimed = AvailabilityBase & {
  workType: 'gm' | 'reception';
  fromHour: number;    // 12..22
  toHour: number;      // 13..23 (przedział [from, to))
  externalEventOnly?: false | null;
};

export type IAvailabilityExternalOnly = AvailabilityBase & {
  workType: 'external_event';
  externalEventOnly: true;
  fromHour?: null;
  toHour?: null;
};

export type IAvailabilitySlot = IAvailabilityTimed | IAvailabilityExternalOnly;
