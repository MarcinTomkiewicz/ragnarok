import { IOfferDetails } from "./i-offer-details";

export interface IOfferCategory {
  id: string;
  slug: string; // np. 'rooms', 'vouchers'
  title: string;
  subtitle?: string;
  position: number;
  sections: IOfferSection[];
}

export interface IOfferSection {
  title: string;
  description?: string;
  services: IOfferDetails[];
  isServiceByHour?: boolean;
  regulationType?: 'rent' | 'pass';
  comments?: string[];
}
