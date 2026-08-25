import { IsIn, IsInt, IsString } from 'class-validator';

export const HERO_CLASSES = ['guerreiro', 'mago', 'ladino', 'clerigo'] as const;
export type HeroClass = (typeof HERO_CLASSES)[number];

/**
 * Body for `PUT /api/hero`. Creates or overwrites the session user's hero.
 * `totalXp` is intentionally absent — a fresh PUT starts at 0 XP.
 */
export class CreateHeroDto {
  @IsString()
  name!: string;

  @IsIn(HERO_CLASSES)
  heroClass!: HeroClass;
}

/**
 * Body for `PATCH /api/hero/xp`. Adds `delta` XP (may be negative); the
 * repository clamps `total_xp` at >= 0.
 */
export class AddXpDto {
  @IsInt()
  delta!: number;
}
