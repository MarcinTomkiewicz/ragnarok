export interface  IWorkLog {
  id?: string;
  userId: string;
  workDate: string;
  hours: number;
  comment?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type JoinedEntry = IWorkLog & {
  firstName: string;
  lastName: string;
  displayName: string;
  source: 'oficjalne' | 'fallback';
};

export type AggRow = {
  userId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  hours: number;
  source: 'oficjalne' | 'fallback';
};