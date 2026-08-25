import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../db/repositories.module';
import { UserSettingsController } from './settings.controller';

@Module({
  imports: [RepositoriesModule],
  controllers: [UserSettingsController],
})
export class SettingsModule {}
