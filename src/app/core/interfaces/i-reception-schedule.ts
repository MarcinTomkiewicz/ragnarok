export interface IReceptionSchedule {
  id?: string;
  workDate: string;
  receptionistId?: string | null;
  externalEventId?: string | null;
  externalRunnerId?: string | null;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReceptionRosterRow {
  date: string;
  weekday: string;
  receptionistId: string | null;
  externalRunnerId: string | null;
  externalEventId: string | null;
  receptionistCandidates: string[];
  externalRunnerCandidates: string[];
}
