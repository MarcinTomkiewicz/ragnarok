import { RoleDisplay, CoworkerRoles } from "../enums/roles";

export function getRoleLabel(role: CoworkerRoles): string {
  return RoleDisplay[role] ?? 'Nieznana rola';
}
