export interface ITeam {
  id: string;
  name: string;
  createdAt: string;
  gmId: string | null;
  ownerId: string | null;
  startProgram: boolean;
  finishedProgram: boolean;
  notes: string | null;
  isOpen: boolean;
  isForBeginners: boolean;
}