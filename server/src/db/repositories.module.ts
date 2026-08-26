import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UsersRepository } from './users.repository';
import { UserSettingsRepository } from './user-settings.repository';
import { HeroesRepository } from './heroes.repository';
import { MissionsRepository } from './missions.repository';
import { AuthTokensRepository } from './auth-tokens.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    UsersRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
    AuthTokensRepository,
  ],
  exports: [
    UsersRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
    AuthTokensRepository,
  ],
})
export class RepositoriesModule {}
