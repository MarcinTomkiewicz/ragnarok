export interface IOfferDetails {
  id: number;
  name: string;
  price: number;
  priceType: 'hour' | 'piece';
  shortDescription: string;
  longDescription?: string;
}
