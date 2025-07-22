export interface IUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  firstName?: string;
  phoneNumber?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  apartmentNumber?: string;
  postalCode?: string;
  age?: number;
  coworker?: string;
  shortDescription?: string;
  longDescription?: string;
  extendedDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}
