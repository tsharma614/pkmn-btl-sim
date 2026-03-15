import { describe, it, expect } from 'vitest';
import { generateGymLeaderPool, generateDraftPool, MONOTYPE_TYPES } from '../../src/engine/draft-pool';
import { createLocalBattle } from '../../src/client/local-battle';
import { getGymLeader, GYM_LEADERS } from '../../src/data/gym-leaders';
import { SeededRNG } from '../../src/utils/rng';
import type { BattleAction } from '../../src/client/state/battle-reducer';

describe('Gym Leader Mode', () => {
  describe('Gym leader pool — all monotype', () => {
    it('every Pokemon in the pool has the gym type', () => {
      for (const type of ['Fire', 'Water', 'Grass', 'Electric', 'Dragon']) {
        const pool = generateGymLeaderPool(new SeededRNG(42), type);
        for (const entry of pool) {
          expect(entry.species.types, `${entry.species.name} should have ${type}`).toContain(type);
        }
      }
    });

    it('legendary mode pool is all monotype', () => {
      const pool = generateGymLeaderPool(new SeededRNG(42), 'Fire', { legendaryMode: true });
      for (const entry of pool) {
        expect(entry.species.types).toContain('Fire');
      }
    });

    it('classic + legendary gym pool is all monotype', () => {
      const pool = generateGymLeaderPool(new SeededRNG(42), 'Water', { legendaryMode: true, maxGen: 4 });
      for (const entry of pool) {
        expect(entry.species.types).toContain('Water');
        expect(entry.species.generation).toBeLessThanOrEqual(4);
      }
    });

    it('fills pool for all 18 types', () => {
      for (const type of MONOTYPE_TYPES) {
        const pool = generateGymLeaderPool(new SeededRNG(42), type, { legendaryMode: true });
        expect(pool.length, `${type} pool too small`).toBeGreaterThanOrEqual(6);
        for (const entry of pool) {
          expect(entry.species.types).toContain(type);
        }
      }
    });

    it('no duplicate species', () => {
      const pool = generateGymLeaderPool(new SeededRNG(42), 'Normal', { legendaryMode: true });
      const ids = pool.map(p => p.species.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('prioritizes higher tiers', () => {
      const pool = generateGymLeaderPool(new SeededRNG(42), 'Water', { legendaryMode: true });
      // First entries should tend toward T1/T2
      const topHalf = pool.slice(0, Math.floor(pool.length / 2));
      const avgTier = topHalf.reduce((s, e) => s + e.tier, 0) / topHalf.length;
      // Not a strict test, just sanity check that it's not all T4
      expect(avgTier).toBeLessThan(3.5);
    });
  });

  describe('Gym leader activation conditions', () => {
    it('activates when legendary + hard + draft + monotype + snake', () => {
      const dispatched: BattleAction[] = [];
      const lb = createLocalBattle({
        playerName: 'Tanmay',
        itemMode: 'competitive',
        maxGen: null,
        difficulty: 'hard',
        legendaryMode: true,
        draftMode: true,
        draftType: 'snake',
        monotype: 'Fire',
        dispatch: (a: BattleAction) => dispatched.push(a),
      });
      // Bot name should be the gym leader name
      const leader = getGymLeader('Fire');
      expect(lb.botName).toBe(leader!.name);
    });

    it('does NOT activate for role draft', () => {
      const dispatched: BattleAction[] = [];
      const lb = createLocalBattle({
        playerName: 'Tanmay',
        itemMode: 'competitive',
        maxGen: null,
        difficulty: 'hard',
        legendaryMode: true,
        draftMode: true,
        draftType: 'role',
        monotype: 'Fire',
        dispatch: (a: BattleAction) => dispatched.push(a),
      });
      const leader = getGymLeader('Fire');
      // Bot name should NOT be the gym leader
      expect(lb.botName).not.toBe(leader!.name);
    });

    it('does NOT activate without legendary mode', () => {
      const dispatched: BattleAction[] = [];
      const lb = createLocalBattle({
        playerName: 'Tanmay',
        itemMode: 'competitive',
        maxGen: null,
        difficulty: 'hard',
        legendaryMode: false,
        draftMode: true,
        draftType: 'snake',
        monotype: 'Fire',
        dispatch: (a: BattleAction) => dispatched.push(a),
      });
      const leader = getGymLeader('Fire');
      expect(lb.botName).not.toBe(leader!.name);
    });

    it('does NOT activate on normal difficulty', () => {
      const dispatched: BattleAction[] = [];
      const lb = createLocalBattle({
        playerName: 'Tanmay',
        itemMode: 'competitive',
        maxGen: null,
        difficulty: 'normal',
        legendaryMode: true,
        draftMode: true,
        draftType: 'snake',
        monotype: 'Fire',
        dispatch: (a: BattleAction) => dispatched.push(a),
      });
      const leader = getGymLeader('Fire');
      expect(lb.botName).not.toBe(leader!.name);
    });
  });

  describe('Gym leader data', () => {
    it('every monotype has a gym leader', () => {
      for (const type of MONOTYPE_TYPES) {
        const leader = GYM_LEADERS[type];
        expect(leader, `Missing gym leader for ${type}`).toBeDefined();
        expect(leader.name).toBeTruthy();
        expect(leader.badgeName).toBeTruthy();
        expect(leader.type).toBe(type);
      }
    });

    it('getGymLeader returns correct leader', () => {
      const blaine = getGymLeader('Fire');
      expect(blaine).toBeDefined();
      expect(blaine!.type).toBe('Fire');
    });

    it('getGymLeader returns null for invalid type', () => {
      const result = getGymLeader('FakeType');
      expect(result).toBeNull();
    });
  });
});
