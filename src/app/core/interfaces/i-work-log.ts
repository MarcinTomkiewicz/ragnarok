export interface  IWorkLog {
  id?: string;
  userId: string;
  workDate: string;
  hours: number;
  comment?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
