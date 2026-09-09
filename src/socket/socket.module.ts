import { forwardRef,Module,} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './socket.gateway';
import { RealtimeService } from './socket.service';
import { SocketAuthMiddleware } from './socket-auth.middleware';
import { RidesModule } from '../rides/rides.module';

@Module({
  imports: [
    JwtModule,

    forwardRef(() =>
      RidesModule,
    ),
  ],

  providers: [
    RealtimeGateway,
    RealtimeService,
    SocketAuthMiddleware,
  ],

  exports: [
    RealtimeService,
    SocketAuthMiddleware,
  ],
})
export class RealtimeModule {}
