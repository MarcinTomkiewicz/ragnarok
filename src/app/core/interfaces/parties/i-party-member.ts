import { TeamRole } from "../../enums/team-role";

export type TeamMemberRole = TeamRole;

export interface IPartyMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  role: TeamMemberRole;
}
