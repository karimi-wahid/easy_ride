import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { randomUUID } from 'crypto';

import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
  ) {}

  async findById(
    id: string,
  ): Promise<User | null> {
    return this.em.findOne(User, {
      id,
      deletedAt: null,
    });
  }

  async findByPhone(
    phone: string,
  ): Promise<User | null> {
    return this.em.findOne(User, {
      phone,
      deletedAt: null,
    });
  }

  async create(
    fullname: string,
    phone: string,
  ): Promise<User> {
    const user = this.em.create(User, {
      id: randomUUID(),
      fullname,
      phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.em.persist(user);

    await this.em.flush();

    return user;
  }
}