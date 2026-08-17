import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { AuthSession } from 'src/entities/auth-session/auth-session.entity';

@Injectable()
export class AuthSessionService {
  constructor(private readonly em: EntityManager) {}

  async deleteExpiredSessions(): Promise<void> {
    await this.em.nativeDelete(AuthSession, {
      expiresAt: {
        $lt: new Date(),
      },
    });
  }
}
