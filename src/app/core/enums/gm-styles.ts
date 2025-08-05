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