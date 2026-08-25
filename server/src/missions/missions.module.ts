import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../db/repositories.module';
import { MissionsController } from './missions.controller';

@Module({
  imports: [RepositoriesModule],
  controllers: [MissionsController],
})
export class MissionsModule {}
