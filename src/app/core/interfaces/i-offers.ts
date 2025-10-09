// core/interfaces/i-offers.ts

export interface Offer {
  id: number;           
  uid?: string;         

  slug: string;         
  ean?: string | null;  
  isbn?: string | null; 

  title: string;
  description: string;
  price: number;
  stock: number;

  image: string;
  buyNowLink: string;

  categoryId: number;
  subcategoryId: number;

  createdAt: string;    
  isActive?: boolean;   
}

export interface Category {
  id: number;
  name: string;
  createdAt: string;
}

export interface Subcategory {
  id: number;
  name: string;
  categoryId: number;
  createdAt: string;
}
