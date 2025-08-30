export interface IParty {
  id: string;
  name: string;
  createdAt: string;
  gmId: string | null;
  ownerId: string;
  beginnersProgram: boolean;
  programStage: boolean;
  notes: string | null;
  isOpen: boolean;
  isForBeginners: boolean;
  slug: string;
}