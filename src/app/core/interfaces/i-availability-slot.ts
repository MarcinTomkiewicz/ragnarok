export const WorkTypeConst = {
  Gm: 'gm',
  Reception: 'reception',
  ExternalEvent: 'external_event',
} as const;
export type WorkType = (typeof WorkTypeConst)[keyof typeof WorkTypeConst];

type AvailabilityBase = {
  id?: string;
  userId: string;
  date: string; // 'yyyy-MM-dd'
  workType: WorkType;
};

export type IAvailabilityTimed = AvailabilityBase & {
  workType: 'gm' | 'reception';
  fromHour: number; // 12..22
  toHour: number; // 13..23 (przedział [from, to))
  externalEventOnly?: false | null;
};

export type IAvailabilityExternalOnly = AvailabilityBase & {
  workType: 'external_event';
  externalEventOnly: true;
  fromHour?: null;
  toHour?: null;
};

export type IAvailabilitySlot = IAvailabilityTimed | IAvailabilityExternalOnly;

export interface IDayFlags {
  externalOnly?: boolean;
  externalEventName?: string;
}