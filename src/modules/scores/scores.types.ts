import { ImprovementLevels } from '../anti-cheat/game-rules';

export type SaveScoreResponse = {
  requestId: string;
  playerName: string;
  submittedScore: number;
  bestScore: number;
  saved: boolean;
  rank: number;
  improvements: ImprovementLevels;
  theoreticalMaxScore: number;
  acceptedMaxScore: number;
  marginPercent: number;
  updatedAt: string;
};

export type TopScoreResponse = {
  playerName: string;
  score: number;
  rank: number;
  improvements: ImprovementLevels;
  elapsedSeconds: number;
  updatedAt: string;
};

export type MeScoreResponse = TopScoreResponse;
