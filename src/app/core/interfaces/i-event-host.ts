import { HostSignupScope } from "../enums/events";
import { GmStyleTag } from "../enums/gm-styles";


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
}

export type IEventHostCreate = Omit<IEventHost, 'id' | 'imagePath'> & {
  imageFile?: File | null;
};

export type IEventHostUpdate = Partial<Omit<IEventHost, 'id' | 'eventId' | 'occurrenceDate'>> & {
  imageFile?: File | null;
};