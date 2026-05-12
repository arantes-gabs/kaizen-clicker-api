import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { ScoresModule } from './modules/scores/scores.module';

@Module({
  imports: [PrismaModule, ScoresModule, RankingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
