import { Rooms } from '../enums/rooms';

export interface IReservation {
  id: string;
  userId: string;
  roomName: Rooms;
  date: string;
  startTime: string;
  durationHours: number;
  needsGm: boolean;
  gmId?: string | null;
  systemId?: string | null;
  confirmedTeam?: boolean | null;
  externalName: string | null;
  externalPhone: string | null;
  status: ReservationStatus;
  teamId?: string | null;
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

export interface IReservations {
  individualReservations: IReservation[];
  teamsWithReservations: { teamId: string; reservations: IReservation[] }[];
}
