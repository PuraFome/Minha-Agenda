import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UsersRepository } from './users.repository';
import { UserDataRepository } from './user-data.repository';
import { UserSettingsRepository } from './user-settings.repository';

@Module({
  imports: [DatabaseModule],
  providers: [UsersRepository, UserDataRepository, UserSettingsRepository],
  exports: [UsersRepository, UserDataRepository, UserSettingsRepository],
})
export class RepositoriesModule {}
