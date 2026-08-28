import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../db/repositories.module';
import { NpcFriendshipController } from './npc-friendship.controller';

@Module({
  imports: [RepositoriesModule],
  controllers: [NpcFriendshipController],
})
export class NpcFriendshipModule {}
