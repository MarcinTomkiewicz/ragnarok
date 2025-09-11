import { GmStyleTag } from '../enums/gm-styles';
import { IRPGSystem } from './i-rpg-system';

export interface IGmProfile {
  id: string;
  experience: string;
  specialties: IRPGSystem[];
  image: string | null;
  quote: string | null;
  styleTags: GmStyleTag[];
  createdAt: string;
}

export interface IGmData {
  gmProfileId: string;
  userId: string;
  firstName: string;
  nickname: string;
  age: number | null;
  shortDescription: string | null;
  experience: string | null;
  image: string | null;
  quote: string | null;
  styleTags: GmStyleTag[];
  systemId: string;
  gmProfileCreatedAt: Date;
  useNickname: boolean;
}

// export interface IAvailabilitySlot {
//   id?: string;
//   gmId: string;
//   date: string;
//   fromHour: number;
//   toHour: number;
// }