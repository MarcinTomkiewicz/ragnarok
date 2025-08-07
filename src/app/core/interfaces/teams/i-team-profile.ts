import { GmStyleTag } from "../../enums/gm-styles";

export interface IPartyProfile {
  id: string;
  description: string | null;
  styleTags: GmStyleTag[];
  createdAt: string;
}
