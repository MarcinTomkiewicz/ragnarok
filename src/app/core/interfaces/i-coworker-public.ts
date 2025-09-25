export interface ICoworkerPublic {
  userId: string;       // = auth.users.id
  firstName: string;
  lastName: string;
  displayName?: string | null;
}