import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UsersRepository } from './users.repository';
import { UserDataRepository } from './user-data.repository';
import { UserSettingsRepository } from './user-settings.repository';
import { HeroesRepository } from './heroes.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    UsersRepository,
    UserDataRepository,
    UserSettingsRepository,
    HeroesRepository,
  ],
  exports: [
    UsersRepository,
    UserDataRepository,
    UserSettingsRepository,
    HeroesRepository,
  ],
})
export class RepositoriesModule {}
