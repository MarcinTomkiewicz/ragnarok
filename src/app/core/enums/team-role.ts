export enum TeamRole {
  Owner = 'owner',
  Gm = 'gm',
  Player = 'player',
  Guest = 'guest',
  None = 'unknown',
}

export const TeamRoleLabels: Record<TeamRole, string> = {
  [TeamRole.Owner]: 'Założyciel',
  [TeamRole.Gm]: 'Mistrz Gry',
  [TeamRole.Player]: 'Gracz',
  [TeamRole.Guest]: 'Gość',
  [TeamRole.None]: 'Rola nieznana',
};