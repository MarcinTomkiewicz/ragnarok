export interface IGmExtraInfo {
  createCharactersAtTable: boolean;
  provideCharacterGuidelines: boolean;
  characterGuidelines: string | null;
  playersCount: number | null;
  extraNotes: string | null;
}

export const defaultGmExtraInfo: IGmExtraInfo = {
  createCharactersAtTable: false,
  provideCharacterGuidelines: false,
  characterGuidelines: null,
  playersCount: null,
  extraNotes: null,
};

export interface IGmExtraInfoRow {
  id: string;
  reservationId: string;
  createCharactersAtTable: boolean;
  provideCharacterGuidelines: boolean;
  characterGuidelines: string | null;
  playersCount: number | null;
  extraNotes: string | null;
  createdAt: string;
  updatedAt: string;
}