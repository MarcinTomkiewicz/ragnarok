import { HostSignupScope } from "../enums/events";
import { GmStyleTag } from "../enums/gm-styles";
import { IGmData } from "./i-gm-profile";
import { IRPGSystem } from "./i-rpg-system";


export interface IEventHost {
  id: string;
  eventId: string;
  occurrenceDate: string;
  roomName: string | null;
  hostUserId: string;
  role: HostSignupScope;
  title: string | null;
  systemId: string | null;
  description: string | null;
  triggers: string[];
  playstyleTags: GmStyleTag[];
  imagePath: string | null;
  sessionCapacity?: number | null;
}

export type IEventHostCreate = Omit<IEventHost, 'id' | 'imagePath'> & {
  imageFile?: File | null;
};

export type IEventHostUpdate =
  Partial<Omit<IEventHost, 'id' | 'eventId' | 'occurrenceDate'>> & {
    imageFile?: File | null;
  };

export type HostCardVM = IEventHost & {
  system?: IRPGSystem | null;
  imageUrl?: string | null;
  displayName?: string | null;
  gm?: IGmData | null;
  triggersTop: string[];
  triggersExtraCount: number;
};