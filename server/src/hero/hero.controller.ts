import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { UsersRepository } from '../db/users.repository';
import { HeroesRepository, Hero } from '../db/heroes.repository';
import { AddXpDto, CreateHeroDto } from './hero.dto';

/**
 * Read/write path for the `heroes` table. All routes require an authenticated
 * session (`SessionGuard`) and resolve the internal uuid via
 * `UsersRepository.findBySub`. Never reads/writes `user_data`.
 */
@Controller('hero')
@UseGuards(SessionGuard)
export class HeroController {
  constructor(
    private readonly users: UsersRepository,
    private readonly heroes: HeroesRepository,
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
  async get(@CurrentUserId() sub: string): Promise<Hero> {
    const uuid = await this.resolveUuid(sub);
    const hero = await this.heroes.getHero(uuid);
    if (!hero) {
      throw new NotFoundException();
    }
    return hero;
  }

  @Put()
  async put(
    @CurrentUserId() sub: string,
    @Body() dto: CreateHeroDto,
  ): Promise<Hero> {
    const uuid = await this.resolveUuid(sub);
    await this.heroes.upsertHero(uuid, dto.name, dto.heroClass, 0);
    const hero = await this.heroes.getHero(uuid);
    return hero!;
  }

  @Patch('xp')
  async addXp(
    @CurrentUserId() sub: string,
    @Body() dto: AddXpDto,
  ): Promise<Hero> {
    const uuid = await this.resolveUuid(sub);
    await this.heroes.addXp(uuid, dto.delta);
    const hero = await this.heroes.getHero(uuid);
    return hero!;
  }

  @Delete()
  @HttpCode(204)
  async delete(@CurrentUserId() sub: string): Promise<void> {
    const uuid = await this.resolveUuid(sub);
    await this.heroes.deleteHero(uuid);
  }
}
