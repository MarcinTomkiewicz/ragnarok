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
