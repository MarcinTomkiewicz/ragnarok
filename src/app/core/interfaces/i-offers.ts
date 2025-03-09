export interface Offer {
    id: number;
    title: string;
    description: string;
    price: number;
    stock: number;
    imageUrl: string;
    buyNowLink?: string;
    categoryId: number;
    subcategoryId?: number;
    createdAt: string;
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