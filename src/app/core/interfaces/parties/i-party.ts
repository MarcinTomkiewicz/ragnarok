export interface IParty {
  id: string;
  name: string;
  createdAt: string;
  gmId: string | null;
  ownerId: string;
  beginnersProgram: boolean;
  programStage: 1 | 2 | null;
  notes: string | null;
  isOpen: boolean | null;
  isForBeginners: boolean;
  slug: string;
}

export type Row = IParty & { ownerLabel: string; gmLabel: string };