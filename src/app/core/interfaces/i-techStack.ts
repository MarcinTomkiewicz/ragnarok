import { Roles } from "../enums/roles";

export interface TechStack {
    id: number;
    name: string;
    image?: string;
    description: string;
    longDescription?: string;
    ctaButton?: any;
    isActive: boolean;
    role: Roles;
    roleDisplay: string;
  }