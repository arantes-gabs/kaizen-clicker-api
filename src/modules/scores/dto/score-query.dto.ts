import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MAX_TOP_LIMIT } from '../../anti-cheat/game-rules';

export class TopScoresQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TOP_LIMIT)
  limit?: number;
}

export class MeScoreQueryDto {
  @Transform(({ value }: TransformFnParams) => trimString(value))
  @IsString()
  @Length(1, 40)
  playerName!: string;
}

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
