import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { randomUUID } from 'crypto';

import { Driver } from '../database/entities/driver.entity';

@Injectable()
export class DriversService {
  constructor(
    private readonly em: EntityManager,
  ) {}

  async findById(
    id: string,
  ): Promise<Driver | null> {
    return this.em.findOne(Driver, {
      id,
      deletedAt: null,
    });
  }

  async findByPhone(
    phone: string,
  ): Promise<Driver | null> {
    return this.em.findOne(Driver, {
      phone,
      deletedAt: null,
    });
  }

  async create(
    fullname: string,
    phone: string,
  ): Promise<Driver> {
    const driver = this.em.create(Driver, {
      id: randomUUID(),
      fullname,
      phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.em.persist(driver);

    await this.em.flush();

    return driver;
  }
}