import { IRPGSystem } from './i-rpg-system';

export interface IGmProfile {
  id: string;
  experience: string;
  specialties: IRPGSystem[];
  image?: string;
  createdAt: string;
}

export interface IGmData {
  gmProfileId: string;
  userId: string;
  firstName: string;
  age: number | null;
  shortDescription: string | null;
  experience: string | null;
  image: string | null;
  quote: string | null;
  styleTags: GmStyleTag[];
  systemId: string;
  gmProfileCreatedAt: Date;
}

export enum GmStyleTag {
  Narrative = 'narrative',
  RulesLight = 'rules-light',
  RulesHeavy = 'rules-heavy',
  Sandbox = 'sandbox',
  Cinematic = 'cinematic',
  RoleplayFocused = 'roleplay-focused',
  CombatHeavy = 'combat-heavy',
  BeginnerFriendly = 'beginner-friendly',
  DarkAtmosphere = 'dark-atmosphere',
}

export const GmStyleTagLabels: Record<GmStyleTag, string> = {
  [GmStyleTag.Narrative]: 'Narracyjny',
  [GmStyleTag.RulesLight]: 'Mało zasad',
  [GmStyleTag.RulesHeavy]: 'Dużo zasad',
  [GmStyleTag.Sandbox]: 'Sandbox',
  [GmStyleTag.Cinematic]: 'Filmowy',
  [GmStyleTag.RoleplayFocused]: 'Nacisk na odgrywanie',
  [GmStyleTag.CombatHeavy]: 'Dużo walki',
  [GmStyleTag.BeginnerFriendly]: 'Dla początkujących',
  [GmStyleTag.DarkAtmosphere]: 'Mroczny klimat',
};
