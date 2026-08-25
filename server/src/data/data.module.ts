import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../db/repositories.module';
import { DataController } from './data.controller';

@Module({
  imports: [RepositoriesModule],
  controllers: [DataController],
})
export class DataModule {}
