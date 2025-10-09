import { NotificationBucket } from "../enums/notification-bucket";
import { CoworkerRoles } from "../enums/roles";
import { IUser } from "../interfaces/i-user";

export type MenuItem = {
    id: string,
  label: string;
  path: string;
  badgeBucket?: NotificationBucket;
};

export type MenuSection = { title: string; items: MenuItem[] };

export type BuildMenuCtx = {
  user: IUser | null;
  hasMin: (role: CoworkerRoles) => boolean;
  hasStrict: (role: CoworkerRoles) => boolean;
  // np. "99+", "7", "0"…
  notifLabels: Record<NotificationBucket, string>;
};