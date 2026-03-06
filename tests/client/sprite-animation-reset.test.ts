import { describe, it, expect } from 'vitest';

/**
 * Tests for the PokemonSprite animation trigger reset logic.
 *
 * PokemonSprite uses refs (lastFaint, lastAttack, etc.) to detect new triggers
 * vs stale ones. When a new Pokemon is sent in (speciesId changes), all trigger
 * refs must be synced to the current trigger values. Without this, a stale faint
 * trigger from the previous Pokemon would replay the faint animation on the new
 * sprite — causing the "replacement immediately faints" bug.
 *
 * This file tests the invariant in pure logic form since PokemonSprite is a
 * React Native component that can't run in Node vitest.
 */

/**
 * Simulates the trigger ref logic from PokemonSprite.
 * Returns whether the animation would fire for each trigger type.
 */
function simulateSpriteTransition(opts: {
  /** Trigger counters when Pokemon A was showing */
  prevTriggers: { attack: number; damage: number; faint: number; switchOut: number };
  /** Trigger counters when Pokemon B arrives (may be same as prev if no new events) */
  currentTriggers: { attack: number; damage: number; faint: number; switchOut: number };
  /** Whether the speciesId changed (new Pokemon sent in) */
  speciesChanged: boolean;
}) {
  // Simulate lastXxx refs — they hold the trigger value from the last animation
  let lastAttack = opts.prevTriggers.attack;
  let lastDamage = opts.prevTriggers.damage;
  let lastFaint = opts.prevTriggers.faint;
  let lastSwitchOut = opts.prevTriggers.switchOut;

  // When species changes, PokemonSprite resets refs to current values
  if (opts.speciesChanged) {
    lastAttack = opts.currentTriggers.attack;
    lastDamage = opts.currentTriggers.damage;
    lastFaint = opts.currentTriggers.faint;
    lastSwitchOut = opts.currentTriggers.switchOut;
  }

  // Check if animations would fire (trigger > 0 && trigger !== last)
  return {
    attackFires: opts.currentTriggers.attack > 0 && opts.currentTriggers.attack !== lastAttack,
    damageFires: opts.currentTriggers.damage > 0 && opts.currentTriggers.damage !== lastDamage,
    faintFires: opts.currentTriggers.faint > 0 && opts.currentTriggers.faint !== lastFaint,
    switchOutFires: opts.currentTriggers.switchOut > 0 && opts.currentTriggers.switchOut !== lastSwitchOut,
  };
}

describe('PokemonSprite animation trigger reset', () => {
  describe('species change resets trigger refs (fix #3: replacement faint)', () => {
    it('faint trigger does NOT replay when new Pokemon arrives', () => {
      // Pokemon A fainted (faintTrigger went from 0 to 1)
      // Pokemon B sent in (speciesId changes), faintTrigger is still 1
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 3, faint: 1, switchOut: 0 },
        currentTriggers: { attack: 2, damage: 3, faint: 1, switchOut: 0 },
        speciesChanged: true,
      });

      expect(result.faintFires).toBe(false);
      expect(result.attackFires).toBe(false);
      expect(result.damageFires).toBe(false);
      expect(result.switchOutFires).toBe(false);
    });

    it('switchOut trigger does NOT replay when replacement arrives', () => {
      // Pokemon A switched out (switchOutTrigger went from 0 to 1)
      // Pokemon B appears (speciesId changes), switchOutTrigger is still 1
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 1, damage: 2, faint: 0, switchOut: 1 },
        currentTriggers: { attack: 1, damage: 2, faint: 0, switchOut: 1 },
        speciesChanged: true,
      });

      expect(result.switchOutFires).toBe(false);
      expect(result.faintFires).toBe(false);
    });

    it('damage trigger does NOT replay on species change', () => {
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 0, damage: 5, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 0, damage: 5, faint: 0, switchOut: 0 },
        speciesChanged: true,
      });

      expect(result.damageFires).toBe(false);
    });

    it('trigger that incremented during species change does NOT fire (was for old Pokemon)', () => {
      // Attack went from 2→3 during the same render that changed species.
      // The increment was for the OLD Pokemon's attack, not the new one.
      // After ref reset, lastAttack = 3 = currentTriggers.attack, so no fire.
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 0, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 3, damage: 0, faint: 0, switchOut: 0 },
        speciesChanged: true,
      });

      expect(result.attackFires).toBe(false);
    });

    it('damage trigger that incremented during species change does NOT fire', () => {
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 0, damage: 3, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 0, damage: 4, faint: 0, switchOut: 0 },
        speciesChanged: true,
      });

      expect(result.damageFires).toBe(false);
    });

    it('subsequent trigger increment AFTER species change DOES fire (two-step)', () => {
      // Step 1: Species changes, refs reset to current values
      const step1 = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 3, faint: 1, switchOut: 0 },
        currentTriggers: { attack: 2, damage: 3, faint: 1, switchOut: 0 },
        speciesChanged: true,
      });
      expect(step1.attackFires).toBe(false); // all suppressed

      // Step 2: New attack on the new Pokemon (trigger increments, same species)
      const step2 = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 3, faint: 1, switchOut: 0 }, // refs from step1
        currentTriggers: { attack: 3, damage: 3, faint: 1, switchOut: 0 },
        speciesChanged: false,
      });
      expect(step2.attackFires).toBe(true); // fires correctly
    });
  });

  describe('without species change (same Pokemon), triggers work normally', () => {
    it('incremented faint trigger fires animation', () => {
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 0, damage: 0, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 0, damage: 0, faint: 1, switchOut: 0 },
        speciesChanged: false,
      });

      expect(result.faintFires).toBe(true);
    });

    it('same trigger value does NOT re-fire', () => {
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 3, faint: 1, switchOut: 1 },
        currentTriggers: { attack: 2, damage: 3, faint: 1, switchOut: 1 },
        speciesChanged: false,
      });

      expect(result.attackFires).toBe(false);
      expect(result.damageFires).toBe(false);
      expect(result.faintFires).toBe(false);
      expect(result.switchOutFires).toBe(false);
    });

    it('incremented attack trigger fires', () => {
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 3, damage: 0, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 4, damage: 0, faint: 0, switchOut: 0 },
        speciesChanged: false,
      });

      expect(result.attackFires).toBe(true);
    });

    it('trigger value of 0 never fires even if different from last', () => {
      // Edge case: last was 0, current is 0 — still doesn't fire
      const result = simulateSpriteTransition({
        prevTriggers: { attack: 0, damage: 0, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 0, damage: 0, faint: 0, switchOut: 0 },
        speciesChanged: false,
      });

      expect(result.attackFires).toBe(false);
      expect(result.faintFires).toBe(false);
    });
  });

  describe('full faint → send_out sequence', () => {
    it('faint on Pokemon A, then send_out Pokemon B: no stale faint on B', () => {
      // Step 1: Pokemon A is showing, faint triggers
      const step1 = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 4, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 2, damage: 4, faint: 1, switchOut: 0 },
        speciesChanged: false,
      });
      expect(step1.faintFires).toBe(true); // A faints correctly

      // Step 2: Pokemon B arrives (species changes), faint counter is still 1
      const step2 = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 4, faint: 1, switchOut: 0 },
        currentTriggers: { attack: 2, damage: 4, faint: 1, switchOut: 0 },
        speciesChanged: true,
      });
      expect(step2.faintFires).toBe(false); // B does NOT faint

      // Step 3: Pokemon B takes a hit (damage increments)
      const step3 = simulateSpriteTransition({
        prevTriggers: { attack: 2, damage: 4, faint: 1, switchOut: 0 },
        currentTriggers: { attack: 2, damage: 5, faint: 1, switchOut: 0 },
        speciesChanged: false, // same species B, no change
      });
      expect(step3.damageFires).toBe(true);
      expect(step3.faintFires).toBe(false);
    });

    it('switch out A, send in B, then B faints: faint fires correctly on B', () => {
      // Step 1: A switches out
      const step1 = simulateSpriteTransition({
        prevTriggers: { attack: 1, damage: 2, faint: 0, switchOut: 0 },
        currentTriggers: { attack: 1, damage: 2, faint: 0, switchOut: 1 },
        speciesChanged: false,
      });
      expect(step1.switchOutFires).toBe(true);

      // Step 2: B arrives (species changes)
      const step2 = simulateSpriteTransition({
        prevTriggers: { attack: 1, damage: 2, faint: 0, switchOut: 1 },
        currentTriggers: { attack: 1, damage: 2, faint: 0, switchOut: 1 },
        speciesChanged: true,
      });
      expect(step2.switchOutFires).toBe(false);
      expect(step2.faintFires).toBe(false);

      // Step 3: B takes hits and faints
      const step3 = simulateSpriteTransition({
        prevTriggers: { attack: 1, damage: 2, faint: 0, switchOut: 1 },
        currentTriggers: { attack: 1, damage: 4, faint: 1, switchOut: 1 },
        speciesChanged: false,
      });
      expect(step3.faintFires).toBe(true); // B faints correctly
      expect(step3.damageFires).toBe(true);
    });
  });

  describe('rematch: all counters reset to 0', () => {
    it('stale faint counter from previous game does not fire on new game start', () => {
      // Previous game ended with faint counter at 3
      // New game starts: both Pokemon names become null, then new names appear
      // useEventQueue resets animations to all 0s, speciesId changes

      const result = simulateSpriteTransition({
        prevTriggers: { attack: 5, damage: 8, faint: 3, switchOut: 2 },
        currentTriggers: { attack: 0, damage: 0, faint: 0, switchOut: 0 },
        speciesChanged: true,
      });

      // All triggers are 0 so nothing fires (guard: trigger > 0)
      expect(result.attackFires).toBe(false);
      expect(result.damageFires).toBe(false);
      expect(result.faintFires).toBe(false);
      expect(result.switchOutFires).toBe(false);
    });
  });
});
