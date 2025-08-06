import { GmStyleTag } from "../../enums/gm-styles";

export interface ITeamProfile {
  id: string;
  description: string | null;
  styleTags: GmStyleTag[];
  createdAt: string;
}
