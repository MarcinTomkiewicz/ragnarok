export interface EventData {
    id: number;
    name: string;
    eventDate: string;
    time: string;
    shortDescription: string;
    longDescription: string;
    facebookLink: string;
    isRecurring: boolean;
    image: string;
    isActive: boolean;
    interval: number;
    cost?: number;
  }