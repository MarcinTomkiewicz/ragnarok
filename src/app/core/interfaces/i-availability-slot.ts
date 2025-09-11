export type WorkType = 'gm' | 'reception' | 'external_event';

export interface IAvailabilitySlot {
  id?: string;
  userId: string;
  date: string;
  fromHour: number;
  toHour: number;
  workType: WorkType;
}
