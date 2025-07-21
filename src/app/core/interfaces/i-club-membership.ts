export interface IMembershipPerk {
  id: number;
  text: string;
  membershipId: number;
}

export interface IClubMembership {
  id: number;
  name: string;
  price: number;
  monthly: boolean;
  description: string;
  slug: string;
  imageUrl?: string;
  position: number;
  membershipPerks: IMembershipPerk[];
}