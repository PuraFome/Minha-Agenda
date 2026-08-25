import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UsersRepository } from './users.repository';
import { UserDataRepository } from './user-data.repository';
import { UserSettingsRepository } from './user-settings.repository';
import { HeroesRepository } from './heroes.repository';
import { MissionsRepository } from './missions.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    UsersRepository,
    UserDataRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
  ],
  exports: [
    UsersRepository,
    UserDataRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
  ],
})
export class RepositoriesModule {}
