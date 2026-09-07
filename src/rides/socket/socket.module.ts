import { Module } from '@nestjs/common';
import { RealtimeGateway } from './socket.gateway';
import { RealtimeService } from './socket.service';

@Module({
  providers: [
    RealtimeGateway,
    RealtimeService,
  ],

  exports: [
    RealtimeService,
  ],
})
export class RealtimeModule {}
