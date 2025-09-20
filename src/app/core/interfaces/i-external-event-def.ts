export interface IExternalEventDef {
  id: string;
  name: string;
  shortName: string;
  weekday: number;
  active: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
