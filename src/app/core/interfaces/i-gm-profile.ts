import { IRPGSystem } from "./i-rpg-system";

export interface IGmProfile {
  id: string;
  experience: string;
  specialties: IRPGSystem[];
  createdAt: string;
}
