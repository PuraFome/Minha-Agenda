import { IsObject } from 'class-validator';

export class PutNpcFriendshipDto {
  @IsObject()
  friendship!: Record<string, { completedCount: number; level: number }>;
}
