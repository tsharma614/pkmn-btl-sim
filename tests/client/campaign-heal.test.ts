import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Campaign — Full heal between battles', () => {
  const contextSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/client/state/battle-context.tsx'),
    'utf-8',
  );

  it('heals HP to full (stats.hp)', () => {
    expect(contextSource).toContain('currentHp: p.stats.hp');
  });

  it('resets isAlive to true', () => {
    expect(contextSource).toContain('isAlive: true');
  });

  it('clears status to null', () => {
    expect(contextSource).toContain('status: null');
  });

  it('resets all stat boosts to 0', () => {
    expect(contextSource).toContain('boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 }');
  });

  it('resets volatileStatuses', () => {
    expect(contextSource).toContain("volatileStatuses: new Set<string>()");
  });

  it('resets PP to max for all moves', () => {
    expect(contextSource).toContain('currentPp: m.maxPp');
  });

  it('clears substitute HP', () => {
    expect(contextSource).toContain('substituteHp: 0');
  });

  it('resets toxic counter', () => {
    expect(contextSource).toContain('toxicCounter: 0');
  });

  it('resets sleep and confusion turns', () => {
    expect(contextSource).toContain('sleepTurns: 0');
    expect(contextSource).toContain('confusionTurns: 0');
  });

  it('clears choice lock', () => {
    expect(contextSource).toContain('choiceLocked: null');
  });

  it('clears encore', () => {
    expect(contextSource).toContain('encoreTurns: 0');
    expect(contextSource).toContain('encoreMove: null');
  });

  it('resets move disabled state', () => {
    expect(contextSource).toContain('disabled: false');
  });
});
