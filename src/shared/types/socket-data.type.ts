export type SocketUserRole = 'user' | 'driver';

export interface SocketData {
  userId: string;
  role: SocketUserRole;
}
