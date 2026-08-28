import { Body, Controller, Get, Put, UnauthorizedException, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UsersRepository } from '../db/users.repository';
import { NpcFriendshipRepository } from '../db/npc-friendship.repository';
import { PutNpcFriendshipDto } from './npc-friendship.dto';

@Controller('npc-friendship')
@UseGuards(SessionGuard)
export class NpcFriendshipController {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendship: NpcFriendshipRepository,
  ) {}

  private async resolveUuid(sub: string): Promise<string> {
    if (!sub) throw new UnauthorizedException();
    const uuid = await this.users.findBySub(sub);
    if (!uuid) throw new UnauthorizedException();
    return uuid;
  }

  @Get()
  async get(@CurrentUserId() sub: string) {
    const uuid = await this.resolveUuid(sub);
    return this.friendship.getFriendship(uuid);
  }

  @Put()
  async put(@CurrentUserId() sub: string, @Body() dto: PutNpcFriendshipDto) {
    const uuid = await this.resolveUuid(sub);
    const entries = Object.entries(dto.friendship).map(([npcId, v]) => ({
      npcId,
      completedCount: v.completedCount,
    }));
    await this.friendship.putFriendship(uuid, entries);
    return this.friendship.getFriendship(uuid);
  }
}
