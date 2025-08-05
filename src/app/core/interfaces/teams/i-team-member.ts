export type TeamMemberRole = 'player' | 'gm';

export interface ITeamMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  role: TeamMemberRole;
}
