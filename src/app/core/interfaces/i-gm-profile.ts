import { IRPGSystem } from './i-rpg-system';

export interface IGmProfile {
  id: string;
  experience: string;
  specialties: IRPGSystem[];
  image?: string;
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
  image?: string;
}
