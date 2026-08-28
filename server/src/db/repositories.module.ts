import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UsersRepository } from './users.repository';
import { UserSettingsRepository } from './user-settings.repository';
import { HeroesRepository } from './heroes.repository';
import { MissionsRepository } from './missions.repository';
import { AuthTokensRepository } from './auth-tokens.repository';
import { NpcFriendshipRepository } from './npc-friendship.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    UsersRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
    AuthTokensRepository,
    NpcFriendshipRepository,
  ],
  exports: [
    UsersRepository,
    UserSettingsRepository,
    HeroesRepository,
    MissionsRepository,
    AuthTokensRepository,
    NpcFriendshipRepository,
  ],
})
export class RepositoriesModule {}
