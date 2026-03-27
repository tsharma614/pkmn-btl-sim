import { describe, it, expect } from 'vitest';
import { Battle } from '../../../src/engine/battle';
import { createBattlePokemon } from '../../../src/engine/pokemon-factory';
import { chooseCpuAction, AITier } from '../../../src/engine/ai';
import { assessThreat } from '../../../src/engine/ai/threat-calc';
import { SeededRNG } from '../../../src/utils/rng';
import type { Player, PokemonSpecies, PokemonSet, PokemonType, Nature } from '../../../src/types';

function makeSpecies(overrides: Partial<PokemonSpecies> = {}): PokemonSpecies {
  return {
    id: 'testmon',
    name: 'Testmon',
    dexNum: 1,
    types: ['Normal'] as [PokemonType],
    baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: ['Overgrow'],
    bestAbility: 'Overgrow',
    tier: 3,
    generation: 1,
    movePool: [],
    sets: [],
    weightkg: 50,
    ...overrides,
  } as PokemonSpecies;
}

function makeSet(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    moves: ['Tackle'],
    ability: 'Overgrow',
    item: 'Leftovers',
    nature: 'Hardy' as Nature,
    evs: { hp: 252, atk: 252, spe: 4 },
    ...overrides,
  };
}

function makePlayer(
  id: string,
  name: string,
  teamDefs: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }>,
): Player {
  const team = teamDefs.map((def, i) => {
    const species = makeSpecies({ id: `mon${i}`, name: `Mon${i}`, ...def.species });
    const set = makeSet(def.set);
    return createBattlePokemon(species, set);
  });
  return { id, name, team, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false };
}

function makeBattle(
  p1Team: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }>,
  p2Team: Array<{ species?: Partial<PokemonSpecies>; set?: Partial<PokemonSet> }>,
): Battle {
  const p1 = makePlayer('p1', 'Human', p1Team);
  const p2 = makePlayer('p2', 'CPU', p2Team);
  return new Battle(p1, p2);
}

// =====================
// CHECK_BAD_MOVE TESTS
// =====================

describe('CPU AI - Check Bad Move', () => {
  it('never uses Electric moves on Ground types', () => {
    const battle = makeBattle(
      [{ species: { types: ['Ground'] as [PokemonType] } }],
      [{
        species: { types: ['Electric'] as [PokemonType] },
        set: { moves: ['Thunderbolt', 'Tackle'] },
      }],
    );
    const rng = new SeededRNG(42);

    // Run 20 times — should never pick Thunderbolt
    for (let i = 0; i < 20; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.BASIC);
      if (action.type === 'move') {
        const move = battle.state.players[1].team[0].moves[action.moveIndex];
        expect(move.data.name).not.toBe('Thunderbolt');
      }
    }
  });

  it('never uses Ground moves on Levitate', () => {
    const battle = makeBattle(
      [{
        species: { types: ['Psychic'] as [PokemonType], abilities: ['Levitate'], bestAbility: 'Levitate' },
        set: { ability: 'Levitate' },
      }],
      [{
        species: { types: ['Ground'] as [PokemonType] },
        set: { moves: ['Earthquake', 'Tackle'] },
      }],
    );
    const rng = new SeededRNG(42);

    for (let i = 0; i < 20; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.BASIC);
      if (action.type === 'move') {
        const move = battle.state.players[1].team[0].moves[action.moveIndex];
        expect(move.data.name).not.toBe('Earthquake');
      }
    }
  });

  it('never uses Normal moves on Ghost types', () => {
    const battle = makeBattle(
      [{ species: { types: ['Ghost'] as [PokemonType] } }],
      [{
        species: { types: ['Normal'] as [PokemonType] },
        set: { moves: ['Tackle', 'Shadow Ball'] },
      }],
    );
    const rng = new SeededRNG(42);

    for (let i = 0; i < 20; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.BASIC);
      if (action.type === 'move') {
        const move = battle.state.players[1].team[0].moves[action.moveIndex];
        expect(move.data.name).not.toBe('Tackle');
      }
    }
  });

  it('never uses Explosion on turn 1', () => {
    const battle = makeBattle(
      [{ species: { types: ['Normal'] as [PokemonType] } }],
      [{
        species: { types: ['Normal'] as [PokemonType] },
        set: { moves: ['Explosion', 'Tackle'] },
      },
      { species: { types: ['Normal'] as [PokemonType] }, set: { moves: ['Tackle'] } }],
    );
    const rng = new SeededRNG(42);

    for (let i = 0; i < 20; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.CHAMPION);
      if (action.type === 'move') {
        const move = battle.state.players[1].team[0].moves[action.moveIndex];
        expect(move.data.name).not.toBe('Explosion');
      }
    }
  });
});

// ====================
// TRY_TO_FAINT TESTS
// ====================

describe('CPU AI - Try to Faint', () => {
  it('prefers KO moves over weaker moves', () => {
    const battle = makeBattle(
      [{ species: { types: ['Water'] as [PokemonType], baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 } } }],
      [{
        species: { types: ['Electric'] as [PokemonType], baseStats: { hp: 100, atk: 150, def: 100, spa: 150, spd: 100, spe: 100 } },
        set: { moves: ['Thunderbolt', 'Tackle'] },
      }],
    );
    // Reduce opponent HP so Thunderbolt can KO
    battle.state.players[0].team[0].currentHp = 20;

    const rng = new SeededRNG(42);
    const koCount = { thunderbolt: 0, other: 0 };

    for (let i = 0; i < 20; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.SMART);
      if (action.type === 'move') {
        const move = battle.state.players[1].team[0].moves[action.moveIndex];
        if (move.data.name === 'Thunderbolt') koCount.thunderbolt++;
        else koCount.other++;
      }
    }

    // Should overwhelmingly pick Thunderbolt
    expect(koCount.thunderbolt).toBeGreaterThan(koCount.other);
  });
});

// ========================
// SWITCHING LOGIC TESTS
// ========================

describe('CPU AI - Switching', () => {
  it('switches out when all moves are immune', () => {
    const battle = makeBattle(
      [{ species: { types: ['Ghost'] as [PokemonType] } }],
      [
        {
          species: { types: ['Normal'] as [PokemonType] },
          set: { moves: ['Tackle', 'Return'] },
        },
        {
          species: { types: ['Dark'] as [PokemonType] },
          set: { moves: ['Crunch'] },
        },
      ],
    );
    const rng = new SeededRNG(42);
    let switchCount = 0;

    for (let i = 0; i < 30; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.SMART);
      if (action.type === 'switch') switchCount++;
    }

    // Should switch at least sometimes when walled
    expect(switchCount).toBeGreaterThan(0);
  });

  it('never switches when last pokemon', () => {
    const battle = makeBattle(
      [{ species: { types: ['Ghost'] as [PokemonType] } }],
      [{
        species: { types: ['Normal'] as [PokemonType] },
        set: { moves: ['Tackle'] },
      }],
    );
    const rng = new SeededRNG(42);

    for (let i = 0; i < 20; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.CHAMPION);
      expect(action.type).not.toBe('switch');
    }
  });

  it('CHAMPION tier switches when about to be KOd with better option on bench', () => {
    const battle = makeBattle(
      [{
        species: {
          types: ['Fire'] as [PokemonType],
          baseStats: { hp: 100, atk: 150, def: 100, spa: 150, spd: 100, spe: 130 },
        },
        set: { moves: ['Flamethrower'] },
      }],
      [
        {
          species: {
            types: ['Grass'] as [PokemonType],
            baseStats: { hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 60 },
          },
          set: { moves: ['Tackle'] },
        },
        {
          species: {
            types: ['Water'] as [PokemonType],
            baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
          },
          set: { moves: ['Surf'] },
        },
      ],
    );
    // Low HP on the Grass type to trigger "about to be KOd"
    battle.state.players[1].team[0].currentHp = 40;

    const rng = new SeededRNG(42);
    let switchCount = 0;

    for (let i = 0; i < 30; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.CHAMPION);
      if (action.type === 'switch') switchCount++;
    }

    // CHAMPION should switch at least some of the time
    expect(switchCount).toBeGreaterThan(0);
  });
});

// ========================
// THREAT ASSESSMENT TESTS
// ========================

describe('CPU AI - Threat Assessment', () => {
  it('correctly identifies speed advantage', () => {
    const battle = makeBattle(
      [{ species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 80 } } }],
      [{ species: { baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 120 } } }],
    );

    const threat = assessThreat(battle, 1, 0);
    expect(threat.iGoFirst).toBe(true);
  });

  it('correctly identifies when it can KO', () => {
    const battle = makeBattle(
      [{
        species: { types: ['Water'] as [PokemonType], baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 } },
      }],
      [{
        species: { types: ['Electric'] as [PokemonType], baseStats: { hp: 100, atk: 100, def: 100, spa: 150, spd: 100, spe: 100 } },
        set: { moves: ['Thunderbolt'] },
      }],
    );
    // Set opponent to very low HP
    battle.state.players[0].team[0].currentHp = 10;

    const threat = assessThreat(battle, 1, 0);
    expect(threat.canIKO).toBe(true);
  });
});

// ========================
// FULL INTEGRATION TESTS
// ========================

describe('CPU AI - Integration', () => {
  it('produces valid actions for all AI tiers', () => {
    const battle = makeBattle(
      [{ species: { types: ['Water'] as [PokemonType] }, set: { moves: ['Surf'] } }],
      [
        { species: { types: ['Grass'] as [PokemonType] }, set: { moves: ['Razor Leaf', 'Swords Dance'] } },
        { species: { types: ['Fire'] as [PokemonType] }, set: { moves: ['Flamethrower'] } },
      ],
    );
    const rng = new SeededRNG(42);

    for (const tier of [AITier.BASIC, AITier.SMART, AITier.EXPERT, AITier.CHAMPION]) {
      const action = chooseCpuAction(battle, 1, rng, tier);
      expect(['move', 'switch', 'forfeit']).toContain(action.type);
      if (action.type === 'move') {
        expect(action.moveIndex).toBeGreaterThanOrEqual(0);
      }
      if (action.type === 'switch') {
        expect(action.pokemonIndex).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('handles fainted pokemon (forced switch)', () => {
    const battle = makeBattle(
      [{ species: { types: ['Water'] as [PokemonType] }, set: { moves: ['Surf'] } }],
      [
        { species: { types: ['Grass'] as [PokemonType] }, set: { moves: ['Razor Leaf'] } },
        { species: { types: ['Fire'] as [PokemonType] }, set: { moves: ['Flamethrower'] } },
      ],
    );
    // Kill the active pokemon
    battle.state.players[1].team[0].currentHp = 0;
    battle.state.players[1].team[0].isAlive = false;

    const rng = new SeededRNG(42);
    const action = chooseCpuAction(battle, 1, rng, AITier.SMART);

    expect(action.type).toBe('switch');
    if (action.type === 'switch') {
      expect(action.pokemonIndex).toBe(1); // Only other option
    }
  });

  it('forfeits when all pokemon are fainted', () => {
    const battle = makeBattle(
      [{ species: { types: ['Water'] as [PokemonType] }, set: { moves: ['Surf'] } }],
      [{ species: { types: ['Grass'] as [PokemonType] }, set: { moves: ['Razor Leaf'] } }],
    );
    battle.state.players[1].team[0].currentHp = 0;
    battle.state.players[1].team[0].isAlive = false;

    const rng = new SeededRNG(42);
    const action = chooseCpuAction(battle, 1, rng, AITier.SMART);

    expect(action.type).toBe('forfeit');
  });

  it('backward-compat chooseBotAction works', async () => {
    const { chooseBotAction } = await import('../../../src/engine/bot');

    const battle = makeBattle(
      [{ species: { types: ['Water'] as [PokemonType] }, set: { moves: ['Surf'] } }],
      [{ species: { types: ['Grass'] as [PokemonType] }, set: { moves: ['Razor Leaf'] } }],
    );
    const rng = new SeededRNG(42);
    const action = chooseBotAction(battle, 1, rng);
    expect(['move', 'switch', 'forfeit']).toContain(action.type);
  });
});

// ========================
// HP_AWARE TESTS
// ========================

describe('CPU AI - HP Aware', () => {
  it('prefers healing at low HP (EXPERT tier)', () => {
    const battle = makeBattle(
      [{ species: { types: ['Normal'] as [PokemonType] }, set: { moves: ['Tackle'] } }],
      [{
        species: { types: ['Normal'] as [PokemonType], baseStats: { hp: 200, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 } },
        set: { moves: ['Tackle', 'Recover'] },
      }],
    );
    // Set CPU HP to 25%
    const cpuMon = battle.state.players[1].team[0];
    cpuMon.currentHp = Math.floor(cpuMon.maxHp * 0.25);

    const rng = new SeededRNG(42);
    let recoverCount = 0;
    let attackCount = 0;

    for (let i = 0; i < 30; i++) {
      const action = chooseCpuAction(battle, 1, rng, AITier.EXPERT);
      if (action.type === 'move') {
        const move = cpuMon.moves[action.moveIndex];
        if (move.data.name === 'Recover') recoverCount++;
        else attackCount++;
      }
    }

    // Should favor Recover when at low HP
    expect(recoverCount).toBeGreaterThan(0);
  });
});
