import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../db/repositories.module';
import { HeroController } from './hero.controller';

@Module({
  imports: [RepositoriesModule],
  controllers: [HeroController],
})
export class HeroModule {}
