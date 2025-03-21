export interface EventData {
    id: number;
    name: string;
    eventDate: string;
    time: string;
    shortDescription: string;
    longDescription: string;
    facebookLink: string;
    recurring: boolean;
    image: string;
    isActive: boolean;
    interval: number;
    imageURL: string;
    cost?: number;
  }