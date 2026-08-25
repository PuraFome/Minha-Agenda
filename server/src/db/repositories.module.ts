import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UsersRepository } from './users.repository';
import { UserSettingsRepository } from './user-settings.repository';
import { HeroesRepository } from './heroes.repository';
import { MissionsRepository } from './missions.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    UsersRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
  ],
  exports: [
    UsersRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
  ],
})
export class RepositoriesModule {}
