import { Rooms } from '../enums/rooms';

export interface IReservation {
  id: string;
  userId: string;
  roomName: Rooms;
  date: string;
  startTime: string;
  durationHours: number;
  needsGm: boolean;
  gmId?: string;
  systemId?: string;
  confirmedTeam?: boolean;
  status: ReservationStatus;
  createdAt: string;
}

export enum ReservationStatus {
  Confirmed = 'confirmed',
  Pending = 'pending',
  Cancelled = 'cancelled',
}

export const ReservationStatusDisplay: Record<ReservationStatus, string> = {
  [ReservationStatus.Confirmed]: 'Potwierdzona',
  [ReservationStatus.Pending]: 'Oczekująca',
  [ReservationStatus.Cancelled]: 'Anulowana',
};
