import { UnprocessableEntityException } from '@nestjs/common';
import { AntiCheatService } from './anti-cheat.service';

describe('AntiCheatService', () => {
  let service: AntiCheatService;

  beforeEach(() => {
    service = new AntiCheatService();
  });

  it('accepts a score under the theoretical ceiling', () => {
    const result = service.validateScore({
      score: 100,
      elapsedSeconds: 300,
      improvements: {
        fiveS: 1,
        kanban: 1,
        pokaYoke: 0,
        tpm: 0,
        andon: 0,
        jidoka: 0,
        heijunka: 0,
        justInTime: 0,
      },
    });

    expect(result.acceptedMaxScore).toBeGreaterThanOrEqual(100);
    expect(result.manualClickScore).toBe(2400);
    expect(result.improvements.fiveS).toBe(1);
  });

  it('rejects a score above the generous theoretical ceiling', () => {
    expect(() =>
      service.validateScore({
        score: 1_000_000,
        elapsedSeconds: 10,
        improvements: {
          fiveS: 0,
          kanban: 0,
          pokaYoke: 0,
          tpm: 0,
          andon: 0,
          jidoka: 0,
          heijunka: 0,
          justInTime: 0,
        },
      }),
    ).toThrow(UnprocessableEntityException);
  });

  it('normalizes improvement arrays', () => {
    const result = service.validateScore({
      score: 20,
      elapsedSeconds: 120,
      improvements: [
        { id: '5S', level: 2 },
        { name: 'Kanban', purchaseCount: 1 },
      ],
    });

    expect(result.improvements.fiveS).toBe(2);
    expect(result.improvements.kanban).toBe(1);
  });
});
