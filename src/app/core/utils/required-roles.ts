import { CoworkerRoles } from "../enums/roles";
import { SystemRole } from "../enums/systemRole";

// Admin zawsze ma dostęp niezależnie od reszty
import { IUser } from '../interfaces/i-user';

export const hierarchy: CoworkerRoles[] = [
    CoworkerRoles.User,
    CoworkerRoles.Member,
    CoworkerRoles.Golden,
    CoworkerRoles.Gm,
    CoworkerRoles.Coordinator,
    CoworkerRoles.Reception,
    CoworkerRoles.Coowner,
    CoworkerRoles.Owner,
  ];

export function hasMinimumCoworkerRole(
  user: IUser | null | undefined,
  required: CoworkerRoles
): boolean {
  if (!user) return false;
  if (user.role === SystemRole.Admin) return true;
  if (!user.coworker) return false;

  return hierarchy.indexOf(user.coworker) >= hierarchy.indexOf(required);
}


export function hasMinimumSystemRole(
  user: IUser | null | undefined,
  required: SystemRole
): boolean {
  if (!user) return false;
  if (user.role === SystemRole.Admin) return true;

  const hierarchy: SystemRole[] = [
    SystemRole.User,
    SystemRole.Mod,
    SystemRole.Admin,
  ];

  return hierarchy.indexOf(user.role) >= hierarchy.indexOf(required);
}

export function hasStrictCoworkerRole(
  user: IUser | null | undefined,
  role: CoworkerRoles
): boolean {
  if (!user) return false;
  if (user.role === SystemRole.Admin) return true;
  return user.coworker === role;
}

export function hasStrictSystemRole(
  user: IUser | null | undefined,
  role: SystemRole
): boolean {
  if (!user) return false;
  if (user.role === SystemRole.Admin) return true;
  return user.role === role;
}
