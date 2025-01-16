export interface IServices {
  name: string;
  price: number;
  priceType: 'hour' | 'piece';
  shortDescription: string;
  longDescription?: string;
}
