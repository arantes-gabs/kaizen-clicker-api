import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RateLimitExceededException } from '../../common/errors/rate-limit-exceeded.exception';
import { CreateScoreDto } from './dto/create-score.dto';
import { MeScoreQueryDto, TopScoresQueryDto } from './dto/score-query.dto';
import { ScoresService } from './scores.service';
import {
  MeScoreResponse,
  SaveScoreResponse,
  TopScoreResponse,
} from './scores.types';

@Controller('scores')
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Post()
  async saveScore(
    @Body() dto: CreateScoreDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SaveScoreResponse> {
    try {
      return await this.scoresService.saveScore(dto);
    } catch (error) {
      if (error instanceof RateLimitExceededException) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
      }

      throw error;
    }
  }

  @Get('top')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  getTopScores(@Query() query: TopScoresQueryDto): Promise<TopScoreResponse[]> {
    return this.scoresService.getTopScores(query.limit);
  }

  @Get('me')
  getPlayerScore(@Query() query: MeScoreQueryDto): Promise<MeScoreResponse> {
    return this.scoresService.getPlayerScore(query.playerName);
  }
}
