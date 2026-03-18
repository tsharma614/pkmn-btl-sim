import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4 — Stats recording wiring', () => {
  const overlaySource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/components/BattleEndOverlay.tsx'),
    'utf-8',
  );

  it('BattleEndOverlay imports recordBattleResult from stats-storage', () => {
    expect(overlaySource).toContain("recordBattleResult, recordBattlePokemonStats");
    expect(overlaySource).toContain("from '../utils/stats-storage'");
  });

  it('BattleEndOverlay calls recordBattleResult on battle end', () => {
    expect(overlaySource).toContain('recordBattleResult(isWinner');
  });

  it('BattleEndOverlay records per-Pokemon stats from pokemonKOs and pokemonDamage', () => {
    expect(overlaySource).toContain('stats.pokemonKOs');
    expect(overlaySource).toContain('stats.pokemonDamage');
    expect(overlaySource).toContain('recordBattlePokemonStats(pokemonEntries)');
  });

  it('BattleEndOverlay records campaign loss when campaign battle is lost', () => {
    expect(overlaySource).toContain("!isWinner && campaignMode");
    expect(overlaySource).toContain("saveCampaignRun");
    expect(overlaySource).toContain("result: 'loss'");
  });

  it('also records Pokemon that dealt damage but got no KOs', () => {
    expect(overlaySource).toContain('!stats.pokemonKOs[name]');
  });
});
