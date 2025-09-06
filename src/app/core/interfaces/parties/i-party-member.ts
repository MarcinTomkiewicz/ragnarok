import { PartyMemberStatus, TeamRole } from "../../enums/party.enum";
import { IUser } from "../i-user";

export type TeamMemberRole = TeamRole;

export interface IPartyMember {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  role: TeamMemberRole;
  status: PartyMemberStatus;
}

export type MemberRow = { user: IUser | null; role: string; id: string };