import { TeamRole } from "../../enums/team-role";
import { IUser } from "../i-user";

export type TeamMemberRole = TeamRole;

export interface IPartyMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  role: TeamMemberRole;
}

export type MemberRow = { user: IUser | null; role: string; id: string };