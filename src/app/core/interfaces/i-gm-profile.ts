import { IRPGSystem } from './i-rpg-system';

export interface IGmProfile {
  id: string;
  experience: string;
  specialties: IRPGSystem[];
  createdAt: string;
}

export interface IGmData {
  systemId: string;
  gmProfileId: string;
  experience: string;
  gmProfileCreatedAt: string;
  userId: string;
  firstName?: string;
  age?: number;
  shortDescription?: string;
}
