import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Socket } from 'socket.io';

import { SocketData } from '../types/socket-data.type';

@Injectable()
export class RideAccessGuard implements CanActivate {
  constructor(
    private readonly rideService: any,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const client =
      context.switchToWs().getClient<Socket>();

    const data = client.data as SocketData;

    const payload = context.switchToWs().getData<{
      rideId: string;
    }>();

    if (!payload?.rideId) {
      throw new ForbiddenException(
        'Ride ID is required',
      );
    }

    const allowed =
      await this.rideService.canUserAccessRide(
        payload.rideId,
        data.userId,
        data.role,
      );

    if (!allowed) {
      throw new ForbiddenException(
        'You are not allowed to access this ride',
      );
    }

    return true;
  }
}
