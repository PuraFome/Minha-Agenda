import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UsersRepository } from '../db/users.repository';
import {
  MissionsRepository,
  Mission,
} from '../db/missions.repository';
import {
  CreateMissionDto,
  SetCompletedDto,
  UpdateMissionDto,
} from './missions.dto';

/**
 * Read/write path for the `missions` table. All routes require an authenticated
 * session (`SessionGuard`) and resolve the internal uuid via
 * `UsersRepository.findBySub`. Never reads/writes `user_data`.
 */
@Controller('missions')
@UseGuards(SessionGuard)
export class MissionsController {
  constructor(
    private readonly users: UsersRepository,
    private readonly missions: MissionsRepository,
  ) {}

  /**
   * Resolve the session's Google `sub` to the internal uuid `id`. Throws
   * `UnauthorizedException` when the session user has no DB record.
   */
  private async resolveUuid(sub: string): Promise<string> {
    if (!sub) {
      throw new UnauthorizedException();
    }
    const uuid = await this.users.findBySub(sub);
    if (!uuid) {
      throw new UnauthorizedException();
    }
    return uuid;
  }

  @Get()
  async list(@CurrentUserId() sub: string): Promise<Mission[]> {
    const uuid = await this.resolveUuid(sub);
    return this.missions.listMissions(uuid);
  }

  @Post()
  async create(
    @CurrentUserId() sub: string,
    @Body() dto: CreateMissionDto,
  ): Promise<Mission> {
    const uuid = await this.resolveUuid(sub);
    const mission: Mission = {
      id: dto.id ?? randomUUID(),
      title: dto.title,
      difficulty: dto.difficulty,
      dueDate: dto.dueDate ?? null,
      completed: false,
      completedAt: null,
      source: dto.source,
      npcId: dto.npcId,
      npcName: dto.npcName,
      npcAvatar: dto.npcAvatar,
      templateId: dto.templateId,
    };
    await this.missions.createMission(uuid, mission);
    return mission;
  }

  @Put(':id')
  async update(
    @CurrentUserId() sub: string,
    @Param('id') id: string,
    @Body() dto: UpdateMissionDto,
  ): Promise<void> {
    const uuid = await this.resolveUuid(sub);
    const existing = await this.missions.getMission(uuid, id);
    if (existing?.source === 'npc') {
      throw new BadRequestException('cannot edit an npc mission');
    }
    if (existing?.completed) {
      throw new BadRequestException('cannot edit a completed mission');
    }
    const patch: Partial<
      Pick<Mission, 'title' | 'difficulty' | 'dueDate' | 'completed'>
    > = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.difficulty !== undefined) patch.difficulty = dto.difficulty;
    if (dto.dueDate !== undefined) patch.dueDate = dto.dueDate;
    await this.missions.updateMission(uuid, id, patch);
  }

  @Patch(':id/complete')
  async complete(
    @CurrentUserId() sub: string,
    @Param('id') id: string,
    @Body() dto: SetCompletedDto,
  ): Promise<void> {
    const uuid = await this.resolveUuid(sub);
    const completedAt = dto.completed ? new Date().toISOString() : null;
    await this.missions.setCompleted(uuid, id, completedAt);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(
    @CurrentUserId() sub: string,
    @Param('id') id: string,
  ): Promise<void> {
    const uuid = await this.resolveUuid(sub);
    await this.missions.deleteMission(uuid, id);
  }
}
