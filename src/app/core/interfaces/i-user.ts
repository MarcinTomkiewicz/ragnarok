  import { CoworkerRoles } from "../enums/roles";
  import { SystemRole } from "../enums/systemRole";

  export interface IUser {
    id: string;
    email: string;
    role: SystemRole;
    firstName?: string;
    phoneNumber?: string;
    city?: string;
    street?: string;
    houseNumber?: string;
    apartmentNumber?: string;
    postalCode?: string;
    age?: number;
    coworker?: CoworkerRoles;
    shortDescription?: string;
    longDescription?: string;
    extendedDescription?: string;
    createdAt?: string;
    updatedAt?: string;
    nickname?: string;
    useNickname?: boolean;
    isTestUser?: boolean;
  }
