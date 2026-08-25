import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { RepositoriesModule } from '../db/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [AuthController, MeController],
})
export class AuthModule {}
