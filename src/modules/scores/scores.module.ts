import { Module } from '@nestjs/common';
import { AntiCheatModule } from '../anti-cheat/anti-cheat.module';
import { ImprovementLevelsConstraint } from './dto/improvement-levels.validator';
import { ScoresController } from './scores.controller';
import { ScoresService } from './scores.service';

@Module({
  imports: [AntiCheatModule],
  controllers: [ScoresController],
  providers: [ScoresService, ImprovementLevelsConstraint],
})
export class ScoresModule {}
