import { CoworkerRoles } from "../enums/roles";
import { SystemRole } from "../enums/systemRole";

export function hasMinimumCoworkerRole(
  actual: CoworkerRoles,
  required: CoworkerRoles
): boolean {
  const hierarchy: CoworkerRoles[] = [
    CoworkerRoles.User,
    CoworkerRoles.Member,
    CoworkerRoles.Golden,
    CoworkerRoles.Reception,
    CoworkerRoles.Gm,
    CoworkerRoles.Coowner,
    CoworkerRoles.Owner,
  ];

  return hierarchy.indexOf(actual) >= hierarchy.indexOf(required);
}

export function hasMinimumSystemRole(
  actual: SystemRole,
  required: SystemRole
): boolean {
  const hierarchy: SystemRole[] = [
    SystemRole.User,
    SystemRole.Mod,
    SystemRole.Admin,
  ];

  return hierarchy.indexOf(actual) >= hierarchy.indexOf(required);
}