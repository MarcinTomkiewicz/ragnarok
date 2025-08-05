export enum TeamRole {
  Owner = 'owner',
  Gm = 'gm',
  Player = 'player',
  Guest = 'guest',
}

export const TeamRoleLabels: Record<TeamRole, string> = {
  [TeamRole.Owner]: 'Założyciel',
  [TeamRole.Gm]: 'Mistrz Gry',
  [TeamRole.Player]: 'Gracz',
  [TeamRole.Guest]: 'Gość',
};