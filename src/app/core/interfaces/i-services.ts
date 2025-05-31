export interface IServices {
  id: number;
  name: string;
  price: number;
  priceType: 'hour' | 'piece';
  shortDescription: string;
  longDescription?: string;
}
