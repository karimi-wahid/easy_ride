import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { EntityManager } from '@mikro-orm/postgresql';
import { randomUUID } from 'crypto';

import { Driver } from '../database/entities/driver.entity';
import { DriverSecurityAction } from '../database/entities/driver-security-action.entity';

import { UpdateDriverProfileDto } from './profile/dto/updateDriverProfileDto';
import { VerifyPhoneChangeDto } from './profile/dto/VerifyPhoneChangeDto';

import { OtpService } from 'src/shared/otp.service';
import { OtpPurpose } from 'src/shared/types/otp-purpose.enum';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(
    DriversService.name,
  );

  constructor(
    private readonly em: EntityManager,
    private readonly otpService: OtpService,
  ) {}

  async findById(id: string): Promise<Driver | null> {
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

  async getMe(driverId: string) {
    const driver = await this.em.findOne(Driver, {
      id: driverId,
      deletedAt: null,
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Driver not found',
      );
    }

    return {
      id: driver.id,
      fullname: driver.fullname,
      phone: driver.phone,
      phoneVerifiedAt:
        driver.phoneVerifiedAt ?? null,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }

  async updateProfile(
    driverId: string,
    dto: UpdateDriverProfileDto,
  ) {
    const driver = await this.em.findOne(Driver, {
      id: driverId,
      deletedAt: null,
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Driver not found',
      );
    }

    const allowedFields: (
      keyof UpdateDriverProfileDto
    )[] = [
      'fullname',
    ];

    for (const field of allowedFields) {
      if (dto[field] !== undefined) {
        driver[field] = dto[field] as never;
      }
    }

    driver.updatedAt = new Date();

    await this.em.flush();

    return {
      id: driver.id,
      fullname: driver.fullname,
      phone: driver.phone,
      phoneVerifiedAt:
        driver.phoneVerifiedAt ?? null,
      updatedAt: driver.updatedAt,
    };
  }

  async requestPhoneChange(
    driverId: string,
    phone: string,
  ) {
    const driver = await this.em.findOne(Driver, {
      id: driverId,
      deletedAt: null,
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Driver not found',
      );
    }

    if (driver.phone === phone) {
      throw new ConflictException(
        'This is already your phone number',
      );
    }

    const existingDriver = await this.em.findOne(
      Driver,
      {
        phone,
        deletedAt: null,
      },
    );

    if (existingDriver) {
      throw new ConflictException(
        'Phone number is already registered',
      );
    }

    const action = this.em.create(
      DriverSecurityAction,
      {
        driver,
        usedAt: null,
        expiresAt: this.getExpiration(5),
        secret: randomUUID(),
        eventType: 'PHONE_CHANGE',
        ipAddress: null,
        userAgent: null,
        metadata: JSON.stringify({
          phone,
        }),
        createdAt: new Date(),
      },
    );

    this.em.persist(action);

    await this.otpService.sendOtp(
      phone,
      OtpPurpose.PHONE_CHANGE,
    );

    await this.em.flush();

    this.logger.log(
      `Phone change OTP sent for driver ${driverId}`,
    );

    return {
      message: 'OTP sent successfully',
    };
  }

  async verifyPhoneChange(
    driverId: string,
    dto: VerifyPhoneChangeDto,
  ) {
    const action = await this.em.findOne(
      DriverSecurityAction,
      {
        driver: driverId,
        eventType: 'PHONE_CHANGE',
        usedAt: null,
      },
      {
        orderBy: {
          createdAt: 'DESC',
        },
      },
    );

    if (!action) {
      throw new UnauthorizedException(
        'Invalid or expired phone change request',
      );
    }

    if (action.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Phone change request has expired',
      );
    }

    const metadata = JSON.parse(
      action.metadata ?? '{}',
    ) as {
      phone?: string;
    };

    if (!metadata.phone) {
      throw new UnauthorizedException(
        'Invalid phone change data',
      );
    }

    await this.otpService.verifyOtp(
      metadata.phone,
      OtpPurpose.PHONE_CHANGE,
      dto.code,
    );

    const driver = await this.em.findOne(Driver, {
      id: driverId,
      deletedAt: null,
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Driver not found',
      );
    }

    const existingDriver = await this.em.findOne(
      Driver,
      {
        phone: metadata.phone,
        deletedAt: null,
      },
    );

    if (
      existingDriver &&
      existingDriver.id !== driver.id
    ) {
      throw new ConflictException(
        'Phone number is already registered',
      );
    }

    driver.phone = metadata.phone;
    driver.phoneVerifiedAt = new Date();
    driver.updatedAt = new Date();

    action.usedAt = new Date();

    await this.em.flush();

    this.logger.log(
      `Phone number changed for driver ${driver.id}`,
    );

    return {
      success: true,
      phone: driver.phone,
      phoneVerifiedAt: driver.phoneVerifiedAt,
    };
  }

  private getExpiration(minutes: number): Date {
    const date = new Date();

    date.setMinutes(
      date.getMinutes() + minutes,
    );

    return date;
  }
}