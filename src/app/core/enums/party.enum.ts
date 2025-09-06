export const maxPartyMembers = 5;
export const alreadyThereLabel = 'Należysz';
export const waitingForApprovalLabel = 'Oczekujesz';

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

export enum PartyType {
  Club = 'club',
  Golden = 'golden',
  Regular = 'regular',
}

export const PartyTypeLabels: Record<PartyType, string> = {
  [PartyType.Club]: 'Klubowa',
  [PartyType.Golden]: 'Złoty Bilet',
  [PartyType.Regular]: 'Zwykła',
};

export enum PartyMemberStatus {
  Active = 'active',
  Left = 'left',
  Pending = 'pending',
  Rejected = 'rejected',
  Removed = 'removed',
}
