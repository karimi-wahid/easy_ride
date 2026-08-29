import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../../database/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profiel.dto';
import { VerifyPhoneChangeDto } from './dto/verify-phone-change.dto';
import { OtpService } from '../../shared/otp.service';
import { OtpPurpose } from '../../shared/types/otp-purpose.enum';
import { ProfileHelperService } from '../../shared/profile-helper.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly em: EntityManager,
    private readonly otpService: OtpService,
    private readonly profileHelper: ProfileHelperService,
  ) {}

  async getProfile(userId: string): Promise<User> {
    return this.profileHelper.findUser(userId);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ) {
    const user = await this.profileHelper.findUser(userId);
    const data = this.profileHelper.prepareUpdate(
      dto,
      user.phone,
    );

    data.updateFullname && (user.fullname = data.fullname!);
    if (data.changePhone) {
      await this.profileHelper.createPhoneChangeAction(
        user,
        data.phone!,
      );
      await this.otpService.sendOtp(
        data.phone!,
        OtpPurpose.PHONE_CHANGE,
      );
    }
    await this.em.flush();
    return {
      user,
      phoneVerificationRequired: data.changePhone,
    };
  }

  async verifyPhoneChange(
    userId: string,
    dto: VerifyPhoneChangeDto,
  ): Promise<User> {
    const user = await this.profileHelper.findUser(userId);
    const action =
      await this.profileHelper.findPhoneChangeAction(
        user,
        dto.phone,
      );

    await this.otpService.verifyOtp(
      dto.phone,
      OtpPurpose.PHONE_CHANGE,
      dto.code,
    );

    await this.profileHelper.ensurePhoneAvailable(
      dto.phone,
      user.id,
    );
    Object.assign(user, {
      phone: dto.phone,
      phoneVerifiedAt: new Date(),
    });

    action.usedAt = new Date();
    await this.em.flush();
    return user;
  }
}