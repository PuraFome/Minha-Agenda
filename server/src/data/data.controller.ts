import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { SessionGuard } from '../auth/session.guard';
import { UserDataRepository } from '../db/user-data.repository';
import { UsersRepository, ALLOWED_COLLECTIONS, Collection } from '../db/users.repository';

/**
 * Per-collection payload validation. Throws `BadRequestException` on a missing
 * body, unknown keys, or wrong value types. `perfil`/`mural` accept any plain
 * record; `missions` accepts any array; `settings`/`hero` enforce an exact
 * shape.
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

function validatePayload(collection: Collection, body: unknown): void {
  if (body === undefined || body === null) {
    throw new BadRequestException('request body is required');
  }

  switch (collection) {
    case 'settings': {
      if (!isPlainObject(body)) {
        throw new BadRequestException('settings must be an object');
      }
      const keys = Object.keys(body);
      if (keys.length !== 1 || !keys.includes('retentionDays')) {
        throw new BadRequestException(
          'settings must contain exactly { retentionDays }',
        );
      }
      if (typeof body.retentionDays !== 'number' || Number.isNaN(body.retentionDays)) {
        throw new BadRequestException('settings.retentionDays must be a number');
      }
      return;
    }
    case 'hero': {
      if (!isPlainObject(body)) {
        throw new BadRequestException('hero must be an object');
      }
      const keys = Object.keys(body).sort().join(',');
      const expected = ['heroClass', 'name', 'totalXp'].sort().join(',');
      if (keys !== expected) {
        throw new BadRequestException(
          'hero must contain exactly { name, heroClass, totalXp }',
        );
      }
      if (typeof body.name !== 'string') {
        throw new BadRequestException('hero.name must be a string');
      }
      if (typeof body.heroClass !== 'string') {
        throw new BadRequestException('hero.heroClass must be a string');
      }
      if (typeof body.totalXp !== 'number' || Number.isNaN(body.totalXp)) {
        throw new BadRequestException('hero.totalXp must be a number');
      }
      return;
    }
    case 'missions': {
      if (!Array.isArray(body)) {
        throw new BadRequestException('missions must be an array');
      }
      return;
    }
    case 'perfil':
    case 'mural': {
      if (!isPlainObject(body)) {
        throw new BadRequestException(`${collection} must be an object`);
      }
      return;
    }
  }
}

@Controller('data')
@UseGuards(SessionGuard)
@Throttle({ data: {} })
export class DataController {
  constructor(
    private readonly userData: UserDataRepository,
    private readonly users: UsersRepository,
  ) {}

  /**
   * Resolve the session's Google `sub` to the internal uuid `id` used as the
   * `user_data.user_id` foreign key.
   */
  private async resolveUserId(req: Request): Promise<string> {
    const user = req.session.user;
    if (!user) {
      throw new UnauthorizedException('session has no authenticated user');
    }
    const userId = await this.users.findBySub(user.sub);
    if (!userId) {
      throw new UnauthorizedException('session user has no database record');
    }
    return userId;
  }

  @Get(':collection')
  async get(
    @Req() req: Request,
    @Param('collection') collection: string,
  ): Promise<unknown> {
    if (!(ALLOWED_COLLECTIONS as readonly string[]).includes(collection)) {
      throw new BadRequestException(`unknown collection: ${collection}`);
    }
    const userId = await this.resolveUserId(req);
    return this.userData.getCollection(userId, collection as Collection);
  }

  @Put(':collection')
  async put(
    @Req() req: Request,
    @Param('collection') collection: string,
    @Body() body: unknown,
  ): Promise<{ updated_at: string }> {
    if (!(ALLOWED_COLLECTIONS as readonly string[]).includes(collection)) {
      throw new BadRequestException(`unknown collection: ${collection}`);
    }
    const col = collection as Collection;
    validatePayload(col, body);
    const userId = await this.resolveUserId(req);
    const updatedAt = await this.userData.upsertCollection(userId, col, body);
    return { updated_at: updatedAt.toISOString() };
  }
}
