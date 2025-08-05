import { GmStyleTag } from "../../enums/gm-styles";

export interface ITeamProfile {
  id: string; // = teamId
  description: string | null;
  quote: string | null;
  styleTags: GmStyleTag[];
  createdAt: string;
}
