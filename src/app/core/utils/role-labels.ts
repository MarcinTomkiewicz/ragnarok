import { RoleDisplay, Roles } from "../enums/roles";

export function getRoleLabel(role: Roles): string {
  return RoleDisplay[role] ?? 'Nieznana rola';
}
