import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { IsImprovementLevels } from './improvement-levels.validator';

export class CreateScoreDto {
  @Transform(({ value }: TransformFnParams) => trimString(value))
  @IsString()
  @Length(1, 40)
  playerName!: string;

  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  score!: number;

  @IsDefined()
  @IsImprovementLevels()
  improvements!: unknown;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  elapsedSeconds!: number;

  @IsUUID()
  requestId!: string;
}

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
