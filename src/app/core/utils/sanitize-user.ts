import { IUser } from '../../core/interfaces/i-user';

export function sanitizeUserData(
  rawData: Partial<IUser>
): Omit<IUser, 'id' | 'createdAt' | 'updatedAt'> {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(rawData)) {
    if (value !== null) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
