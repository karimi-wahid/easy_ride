import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {REALTIME_EVENTS,SOCKET_ROOMS,} from './socket.constants';
import { RideOfferEvent } from './events/ride-offer.events';
import { RideAcceptedEvent } from './events/ride-accepted.event';
import { DriverLocationEvent } from './events/driver-location.event';
import { RideStateChangedEvent } from './events/ride-state-changed.event';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(
    RealtimeService.name,
  );

  private server?: Server;

  setServer(server: Server): void { this.server = server;
    this.logger.log( 'Socket.IO server registered in RealtimeService',);
  }


  sendDriverOffer(
    driverId: string,
    payload: RideOfferEvent,
  ): void {
    this.ensureServer();
    const room = SOCKET_ROOMS.driver(driverId);
    const socketsInRoom = this.server!.sockets.adapter.rooms.get(room);
    const connectedDrivers =socketsInRoom?.size ?? 0;
    this.logger.log(`SEND RIDE OFFER | driverId=${driverId} | rideId=${payload.rideId} | offerId=${payload.offerId} | room=${room} | connected=${connectedDrivers}`, );
    if (connectedDrivers === 0) {
      this.logger.warn(`DRIVER SOCKET NOT CONNECTED | driverId=${driverId} | room=${room}`,);}
      this.server!.to(room)
      .emit(
        REALTIME_EVENTS.RIDE_OFFER,
        payload,
      );
    this.logger.log( `RIDE OFFER EMITTED | driverId=${driverId} | rideId=${payload.rideId} | offerId=${payload.offerId}`,);
  }



  notifyRideAccepted(
    userId: string,
    payload: RideAcceptedEvent,
  ): void {
    this.ensureServer();
    const room = SOCKET_ROOMS.user(userId);
    const socketsInRoom =this.server!.sockets.adapter.rooms.get(room);
    const connectedUsers =socketsInRoom?.size ?? 0;
    this.logger.log(`SEND RIDE ACCEPTED | userId=${userId} | rideId=${payload.rideId} | room=${room} | connected=${connectedUsers}`,);
    if (connectedUsers === 0) {
      this.logger.warn(`USER SOCKET NOT CONNECTED | userId=${userId} | room=${room}`, );
    }
    this.server!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_ACCEPTED,
        payload,
      );
  }


  notifyDriverLocation(
    rideId: string,
    payload: DriverLocationEvent,
  ): void {
    this.ensureServer();
    const room = SOCKET_ROOMS.ride(rideId);
    const socketsInRoom = this.server!.sockets.adapter.rooms.get(room);
    const connectedUsers = socketsInRoom?.size ?? 0;
    this.logger.log(`DRIVER LOCATION | rideId=${rideId} | driverId=${payload.driverId} | latitude=${payload.latitude} | longitude=${payload.longitude} | room=${room} | connected=${connectedUsers}`,);
    this.server!
      .to(room)
      .emit(
        REALTIME_EVENTS.DRIVER_LOCATION,
        payload,
      );
  }

  
  notifyRideStateChanged(
    rideId: string,
    payload: RideStateChangedEvent,
  ): void {
    this.ensureServer();
    const room = SOCKET_ROOMS.ride(rideId);
    this.logger.log(`RIDE STATE CHANGED | rideId=${rideId} | room=${room}`,);
    this.server!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_STATE_CHANGED,
        payload,
      );
  }


  notifyOfferExpired(
    driverId: string,
    payload: {
      offerId: string;
      rideId: string;
    },
  ): void {
    this.ensureServer();
    const room = SOCKET_ROOMS.driver(driverId);
    this.logger.log(`OFFER EXPIRED | driverId=${driverId} | rideId=${payload.rideId} | offerId=${payload.offerId}`, );

    this.server!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_OFFER_EXPIRED,
        payload,
      );
  }


  
  notifyOfferCancelled(
    driverId: string,
    payload: {
      offerId: string;
      rideId: string;
    },
  ): void {
    this.ensureServer();
    const room = SOCKET_ROOMS.driver(driverId);
    this.logger.log( `OFFER CANCELLED | driverId=${driverId} | rideId=${payload.rideId} | offerId=${payload.offerId}`,);
    this.server!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_OFFER_CANCELLED,
        payload,
      );
  }

  
  async joinRide(
    socket: {
      join: (
        room: string,
      ) => Promise<void> | void;
    },
    rideId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.ride(rideId);
    await socket.join(room);
    this.logger.log(  `SOCKET JOINED RIDE | rideId=${rideId} | room=${room}`, );
  }

 
  async leaveRide(
    socket: {
      leave: (
        room: string,
      ) => Promise<void> | void;
    },
    rideId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.ride(rideId);
    await socket.leave(room);
    this.logger.log( `SOCKET LEFT RIDE | rideId=${rideId} | room=${room}`,);
  }

  
  async joinDriver(
    socket: {
      join: (
        room: string,
      ) => Promise<void> | void;
    },
    driverId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.driver(driverId);
    await socket.join(room);
    this.logger.log( `DRIVER JOINED ROOM | driverId=${driverId} | room=${room}`, );
  }


  async joinUser(
    socket: {
      join: (
        room: string,
      ) => Promise<void> | void;
    },
    userId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.user(userId);
    await socket.join(room);
    this.logger.log(`USER JOINED ROOM | userId=${userId} | room=${room}`, );
  }

 
  isDriverConnected(
    driverId: string,
  ): boolean {
    this.ensureServer();
    const room = SOCKET_ROOMS.driver(driverId);
    const socketsInRoom = this.server!.sockets.adapter.rooms.get(room);
    return Boolean(
      socketsInRoom &&
      socketsInRoom.size > 0,
    );
  }


  isUserConnected(
    userId: string,
  ): boolean {
    this.ensureServer();
    const room = SOCKET_ROOMS.user(userId);
    const socketsInRoom = this.server!.sockets.adapter.rooms.get(room);
    return Boolean(
      socketsInRoom &&
      socketsInRoom.size > 0,
    );
  }

 
  getRoomSize(
    room: string,
  ): number {
    this.ensureServer();
    const socketsInRoom =this.server!.sockets.adapter.rooms.get(room);
    return socketsInRoom?.size ?? 0;
  }


  private ensureServer(): void {
    if (!this.server) {
      throw new Error(
        'Realtime Socket.IO server has not been initialized',
      );
    }
  }
}