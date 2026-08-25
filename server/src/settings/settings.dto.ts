import { IsIn, IsInt, IsOptional } from 'class-validator';
import type { MuralActiveTab } from '../db/user-settings.repository';

/**
 * Body for `PUT /api/settings`. Both fields are optional so a partial update
 * merges with the existing row (or defaults). `retentionDays` is validated as
 * an integer; the controller clamps it to a non-negative int (`Math.max(0, floor)`)
 * so negative values like `-5` are stored as `0` rather than rejected.
 * `muralActiveTab` must be one of the allowed enum values or the request 400s.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  readonly retentionDays?: number;

  @IsOptional()
  @IsIn(['pending', 'completed'])
  readonly muralActiveTab?: MuralActiveTab;
}
