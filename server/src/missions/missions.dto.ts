import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type { Difficulty } from '../db/missions.repository';

/**
 * Allowed mission difficulty values. Mirrors `DIFFICULTIES` in the frontend
 * `src/app/game/game.types.ts` (kept local here because the server `tsconfig`
 * has `rootDir: ./src` and must not import from the frontend project).
 */
export const DIFFICULTIES: readonly Difficulty[] = [
  'facil',
  'media',
  'dificil',
  'muito-dificil',
  'epica',
];

/**
 * Body for `POST /api/missions`. `id` is optional — when present the client
 * supplies the mission uuid; when absent the server generates one.
 */
export class CreateMissionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  title!: string;

  @IsIn([...DIFFICULTIES])
  difficulty!: Difficulty;

  @IsOptional()
  dueDate?: string | null;

  @IsOptional()
  @IsIn(['manual', 'npc'])
  source?: 'manual' | 'npc';

  @IsOptional()
  @IsString()
  npcId?: string;

  @IsOptional()
  @IsString()
  npcName?: string;

  @IsOptional()
  @IsString()
  npcAvatar?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}

/**
 * Body for `PUT /api/missions/:id`. All fields optional; only present fields
 * are patched.
 */
export class UpdateMissionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn([...DIFFICULTIES])
  difficulty?: Difficulty;

  @IsOptional()
  dueDate?: string | null;
}

/**
 * Body for `PATCH /api/missions/:id/complete`.
 */
export class SetCompletedDto {
  @IsBoolean()
  completed!: boolean;
}
