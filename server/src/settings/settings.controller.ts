import {
  Body,
  Controller,
  Get,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UsersRepository } from '../db/users.repository';
import {
  MuralActiveTab,
  UserSettingsRepository,
} from '../db/user-settings.repository';
import { UpdateSettingsDto } from './settings.dto';

const DEFAULT_RETENTION_DAYS = 0;
const DEFAULT_MURAL_ACTIVE_TAB: MuralActiveTab = 'pending';

export interface SettingsResponse {
  retentionDays: number;
  muralActiveTab: MuralActiveTab;
}

/**
 * Read/write path for the `user_settings` table. This is the ONLY route that
 * touches settings — it never reads/writes `user_data`. All routes require an
 * authenticated session (`SessionGuard`) and resolve the internal uuid via
 * `UsersRepository.findBySub`.
 */
@Controller('settings')
@UseGuards(SessionGuard)
export class UserSettingsController {
  constructor(
    private readonly users: UsersRepository,
    private readonly settings: UserSettingsRepository,
  ) {}

  @Get()
  async get(@CurrentUserId() sub: string): Promise<SettingsResponse> {
    if (!sub) {
      throw new UnauthorizedException();
    }
    const uuid = await this.users.findBySub(sub);
    if (!uuid) {
      throw new UnauthorizedException();
    }
    const existing = await this.settings.getSettings(uuid);
    return (
      existing ?? {
        retentionDays: DEFAULT_RETENTION_DAYS,
        muralActiveTab: DEFAULT_MURAL_ACTIVE_TAB,
      }
    );
  }

  @Put()
  async put(
    @CurrentUserId() sub: string,
    @Body() dto: UpdateSettingsDto,
  ): Promise<SettingsResponse> {
    if (!sub) {
      throw new UnauthorizedException();
    }
    const uuid = await this.users.findBySub(sub);
    if (!uuid) {
      throw new UnauthorizedException();
    }
    const existing = await this.settings.getSettings(uuid);
    const current: SettingsResponse =
      existing ?? {
        retentionDays: DEFAULT_RETENTION_DAYS,
        muralActiveTab: DEFAULT_MURAL_ACTIVE_TAB,
      };

    const retentionDays = Math.max(
      0,
      Math.floor(dto.retentionDays ?? current.retentionDays),
    );
    const muralActiveTab = dto.muralActiveTab ?? current.muralActiveTab;

    await this.settings.upsertSettings(uuid, retentionDays, muralActiveTab);
    return { retentionDays, muralActiveTab };
  }
}
