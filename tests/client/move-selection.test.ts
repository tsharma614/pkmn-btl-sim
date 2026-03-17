import { describe, it, expect } from 'vitest';
import { serializeOwnPokemon } from '../../src/server/state-sanitizer';
import { pickSet } from '../../src/engine/team-generator';
import { createBattlePokemon } from '../../src/engine/pokemon-factory';
import { SeededRNG } from '../../src/utils/rng';
import { Room } from '../../src/server/room';
import pokedexData from '../../src/data/pokedex.json';
import megaPokedexData from '../../src/data/mega-pokemon.json';
import movesJsonData from '../../src/data/moves.json';
import type { PokemonSpecies } from '../../src/types';

const movesLookup = movesJsonData as Record<string, any>;

// Mirror the lookup built in MoveSelectionScreen and battle-context
const fullSpeciesById: Record<string, PokemonSpecies> = {};
for (const entry of Object.values(pokedexData as Record<string, any>)) {
  fullSpeciesById[entry.id] = entry as PokemonSpecies;
}
for (const entry of Object.values(megaPokedexData as Record<string, any>)) {
  fullSpeciesById[entry.id] = entry as PokemonSpecies;
}

function getMoveData(moveName: string) {
  const id = moveName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return movesLookup[id] || null;
}

const GOOD_STATUS_MOVES = new Set([
  'Swords Dance', 'Calm Mind', 'Dragon Dance', 'Nasty Plot', 'Shell Smash',
  'Quiver Dance', 'Bulk Up', 'Iron Defense', 'Amnesia', 'Agility', 'Rock Polish',
  'Shift Gear', 'Coil', 'Belly Drum', 'Tail Glow', 'Growth', 'Work Up',
  'Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web',
  'Toxic', 'Will-O-Wisp', 'Thunder Wave', 'Glare', 'Stun Spore', 'Spore', 'Sleep Powder', 'Hypnosis',
  'Recover', 'Roost', 'Soft-Boiled', 'Slack Off', 'Moonlight', 'Morning Sun', 'Synthesis', 'Shore Up', 'Wish',
  'Protect', 'Substitute', 'Encore', 'Taunt', 'Trick', 'Switcheroo',
  'Defog', 'Rapid Spin', 'Haze', 'Whirlwind', 'Roar',
  'Leech Seed', 'Pain Split', 'Destiny Bond', 'Trick Room',
  'Light Screen', 'Reflect', 'Aurora Veil', 'Tailwind',
]);

/** Replicate the filtering logic from MoveSelectionScreen */
function getFilteredMoves(speciesId: string, setMoveNames: Set<string>) {
  const speciesData = fullSpeciesById[speciesId];
  if (!speciesData) return [];
  return (speciesData.movePool || [])
    .map(name => ({ name, data: getMoveData(name) }))
    .filter(m => {
      if (!m.data) return false;
      if (setMoveNames.has(m.name)) return true;
      if (m.data.category === 'Status') return GOOD_STATUS_MOVES.has(m.name);
      const power = m.data.basePower ?? m.data.power ?? 0;
      return power >= 60;
    });
}

describe('Move Selection Phase', () => {
  describe('movePool lookup from pokedex', () => {
    it('OwnPokemon does not include movePool', () => {
      const room = new Room('TEST01', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');
      const pokemon = room.teams[0]![0];
      const serialized = serializeOwnPokemon(pokemon);

      expect(serialized.species).not.toHaveProperty('movePool');
      expect(serialized.species).not.toHaveProperty('sets');
    });

    it('can resolve full species from pokedex using OwnPokemon.species.id', () => {
      const room = new Room('TEST01', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');
      const pokemon = room.teams[0]![0];
      const serialized = serializeOwnPokemon(pokemon);

      const fullSpecies = fullSpeciesById[serialized.species.id];
      expect(fullSpecies).toBeDefined();
      expect(fullSpecies.movePool).toBeDefined();
      expect(fullSpecies.movePool.length).toBeGreaterThan(0);
      expect(fullSpecies.sets).toBeDefined();
    });

    it('every species in a generated team can be looked up', () => {
      const room = new Room('LOOK01', 123);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');
      for (const team of room.teams) {
        for (const pokemon of team!) {
          const serialized = serializeOwnPokemon(pokemon);
          const fullSpecies = fullSpeciesById[serialized.species.id];
          expect(fullSpecies, `Missing species for ${serialized.species.id}`).toBeDefined();
          expect(fullSpecies.movePool.length).toBeGreaterThan(0);
        }
      }
    });

    it('mega species can be looked up too', () => {
      const megaIds = Object.keys(megaPokedexData as Record<string, any>);
      expect(megaIds.length).toBeGreaterThan(0);
      for (const id of megaIds.slice(0, 5)) {
        const species = fullSpeciesById[id];
        expect(species, `Missing mega: ${id}`).toBeDefined();
        expect(species.movePool.length).toBeGreaterThan(0);
      }
    });
  });

  describe('move filtering', () => {
    it('includes set moves regardless of power', () => {
      // Pick a well-known species
      const species = fullSpeciesById['garchomp'];
      if (!species) return; // skip if not in dex
      const rng = new SeededRNG(42);
      const set = pickSet(species, rng, 'competitive');
      const setMoveNames = new Set(set.moves);

      const filtered = getFilteredMoves('garchomp', setMoveNames);
      const filteredNames = new Set(filtered.map(m => m.name));

      for (const moveName of setMoveNames) {
        const data = getMoveData(moveName);
        if (data) {
          expect(filteredNames.has(moveName), `Set move ${moveName} should be in filtered list`).toBe(true);
        }
      }
    });

    it('includes damaging moves with 60+ base power', () => {
      const species = fullSpeciesById['garchomp'];
      if (!species) return;
      const filtered = getFilteredMoves('garchomp', new Set());
      const hasHighPower = filtered.some(m => {
        const power = m.data.basePower ?? m.data.power ?? 0;
        return m.data.category !== 'Status' && power >= 60;
      });
      expect(hasHighPower).toBe(true);
    });

    it('excludes damaging moves below 60 power that are not in set', () => {
      const species = fullSpeciesById['garchomp'];
      if (!species) return;
      const filtered = getFilteredMoves('garchomp', new Set());
      for (const move of filtered) {
        if (move.data.category !== 'Status') {
          const power = move.data.basePower ?? move.data.power ?? 0;
          // Either power >= 60 or it's a set move (we passed empty set, so none are set moves)
          expect(power).toBeGreaterThanOrEqual(60);
        }
      }
    });

    it('includes whitelisted status moves', () => {
      // Find a species that learns a whitelisted status move
      const species = fullSpeciesById['garchomp'];
      if (!species) return;
      const filtered = getFilteredMoves('garchomp', new Set());
      const statusMoves = filtered.filter(m => m.data.category === 'Status');
      for (const m of statusMoves) {
        expect(GOOD_STATUS_MOVES.has(m.name), `${m.name} should be in whitelist`).toBe(true);
      }
    });

    it('excludes non-whitelisted status moves', () => {
      // All status moves in any filtered result must be in the whitelist
      const testSpecies = ['garchomp', 'blissey', 'skarmory', 'tyranitar'];
      for (const id of testSpecies) {
        const species = fullSpeciesById[id];
        if (!species) continue;
        const filtered = getFilteredMoves(id, new Set());
        for (const m of filtered) {
          if (m.data.category === 'Status') {
            expect(GOOD_STATUS_MOVES.has(m.name), `${m.name} from ${id} should be whitelisted`).toBe(true);
          }
        }
      }
    });

    it('produces more than 6 moves for most species', () => {
      // The bug was that movePool was undefined, giving 0 moves.
      // After fix, typical species should have many more.
      const testSpecies = ['garchomp', 'tyranitar', 'alakazam', 'gengar', 'dragonite'];
      for (const id of testSpecies) {
        const species = fullSpeciesById[id];
        if (!species) continue;
        const rng = new SeededRNG(42);
        const set = pickSet(species, rng, 'competitive');
        const setMoveNames = new Set(set.moves);
        const filtered = getFilteredMoves(id, setMoveNames);
        expect(filtered.length, `${id} should have many filtered moves`).toBeGreaterThan(10);
      }
    });

    it('returns empty for species not in pokedex', () => {
      const filtered = getFilteredMoves('nonexistent_fakemon', new Set());
      expect(filtered).toHaveLength(0);
    });
  });

  describe('rebuilding Pokemon with custom moves', () => {
    it('pickSet + createBattlePokemon with full species produces valid Pokemon', () => {
      const species = fullSpeciesById['garchomp'];
      if (!species) return;
      const rng = new SeededRNG(42);
      const set = pickSet(species, rng, 'competitive');
      const pokemon = createBattlePokemon(species, set, 100, null);

      expect(pokemon.species.name).toBe('Garchomp');
      expect(pokemon.moves).toHaveLength(4);
      expect(pokemon.stats.hp).toBeGreaterThan(0);
      expect(pokemon.isAlive).toBe(true);
      expect(pokemon.ability).toBeDefined();
    });

    it('custom moves are applied when overriding set.moves', () => {
      const species = fullSpeciesById['garchomp'];
      if (!species) return;
      const rng = new SeededRNG(42);
      const set = pickSet(species, rng, 'competitive');
      const customMoves = ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Stone Edge'];
      set.moves = customMoves;
      const pokemon = createBattlePokemon(species, set, 100, null);

      const moveNames = pokemon.moves.map(m => m.data.name);
      expect(moveNames).toEqual(customMoves);
    });

    it('using stripped OwnPokemon.species with pickSet produces broken results', () => {
      // This test documents the bug that was fixed
      const room = new Room('BUG01', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');
      const serialized = serializeOwnPokemon(room.teams[0]![0]);

      // Stripped species has no sets or movePool
      expect(serialized.species).not.toHaveProperty('sets');
      expect(serialized.species).not.toHaveProperty('movePool');

      // pickSet with stripped species — sets is undefined, so it gets empty array
      const rng = new SeededRNG(42);
      const set = pickSet(serialized.species as any, rng, 'competitive');
      // The set will be broken — no EVs from real sets, random/missing moves
      // The key point: it won't have the same quality as using full species
      const fullSpecies = fullSpeciesById[serialized.species.id];
      const goodSet = pickSet(fullSpecies, rng, 'competitive');
      // Full species set has proper EVs
      expect(goodSet.evs).toBeDefined();
      expect(Object.values(goodSet.evs).some(v => v > 0)).toBe(true);
    });

    it('full rebuild flow: serialize → lookup → pickSet → createBattlePokemon → serialize', () => {
      const room = new Room('FLOW01', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');

      // Simulate what moveSelectionComplete does
      const team = room.teams[0]!.map(serializeOwnPokemon);
      const rng = new SeededRNG(99);

      const rebuiltTeam = team.map((poke, i) => {
        const fullSpecies = fullSpeciesById[poke.species.id];
        expect(fullSpecies, `Species ${poke.species.id} not found`).toBeDefined();

        const customMoves = fullSpecies.movePool.slice(0, 4);
        const baseSet = pickSet(fullSpecies, rng, 'competitive');
        baseSet.moves = customMoves;
        return createBattlePokemon(fullSpecies, baseSet, 100, null);
      });

      expect(rebuiltTeam).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        const bp = rebuiltTeam[i];
        expect(bp.moves).toHaveLength(4);
        expect(bp.stats.hp).toBeGreaterThan(0);
        expect(bp.species.id).toBe(team[i].species.id);
        expect(bp.isAlive).toBe(true);

        // Moves should match what we set
        const moveNames = bp.moves.map(m => m.data.name);
        const expected = fullSpeciesById[team[i].species.id].movePool.slice(0, 4);
        expect(moveNames).toEqual(expected);
      }

      // Can re-serialize without error
      const reSerialized = rebuiltTeam.map(serializeOwnPokemon);
      expect(reSerialized).toHaveLength(6);
      for (const s of reSerialized) {
        expect(s.moves).toHaveLength(4);
        expect(s.species.id).toBeDefined();
      }
    });
  });

  describe('server-side updatePlayerMoves', () => {
    it('applies custom moves to the team', () => {
      const room = new Room('SERV01', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');

      const species0 = room.teams[0]![0].species;
      const validMoves = species0.movePool.slice(0, 4);
      if (validMoves.length < 4) return;

      const result = room.updatePlayerMoves(0, { 0: validMoves });
      expect(result).toBe(true);

      const updatedMoveNames = room.teams[0]![0].moves.map(m => m.data.name);
      expect(updatedMoveNames).toEqual(validMoves);
    });

    it('applies custom moves to multiple Pokemon', () => {
      const room = new Room('SERV02', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');

      const moveSelections: Record<number, string[]> = {};
      for (let i = 0; i < 6; i++) {
        const species = room.teams[0]![i].species;
        const moves = species.movePool.slice(0, 4);
        if (moves.length === 4) {
          moveSelections[i] = moves;
        }
      }

      const result = room.updatePlayerMoves(0, moveSelections);
      expect(result).toBe(true);

      for (const [idx, expectedMoves] of Object.entries(moveSelections)) {
        const pokemon = room.teams[0]![Number(idx)];
        const actualMoves = pokemon.moves.map(m => m.data.name);
        expect(actualMoves).toEqual(expectedMoves);
      }
    });

    it('skips Pokemon with fewer than 4 custom moves', () => {
      const room = new Room('SERV03', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');

      const originalMoves = room.teams[0]![0].moves.map(m => m.data.name);
      // Only 2 moves — should be skipped
      const result = room.updatePlayerMoves(0, { 0: ['Tackle', 'Ember'] });
      expect(result).toBe(true);

      const afterMoves = room.teams[0]![0].moves.map(m => m.data.name);
      expect(afterMoves).toEqual(originalMoves);
    });

    it('does not affect player 2 team when updating player 1', () => {
      const room = new Room('SERV04', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');

      const p2MovesBefore = room.teams[1]![0].moves.map(m => m.data.name);
      const species = room.teams[0]![0].species;
      const validMoves = species.movePool.slice(0, 4);
      if (validMoves.length < 4) return;

      room.updatePlayerMoves(0, { 0: validMoves });
      const p2MovesAfter = room.teams[1]![0].moves.map(m => m.data.name);
      expect(p2MovesAfter).toEqual(p2MovesBefore);
    });

    it('rebuilt Pokemon retains species identity', () => {
      const room = new Room('SERV05', 42);
      room.addPlayer('s1', 'A');
      room.addPlayer('s2', 'B');

      const originalSpeciesName = room.teams[0]![0].species.name;
      const species = room.teams[0]![0].species;
      const validMoves = species.movePool.slice(0, 4);
      if (validMoves.length < 4) return;

      room.updatePlayerMoves(0, { 0: validMoves });
      expect(room.teams[0]![0].species.name).toBe(originalSpeciesName);
      expect(room.teams[0]![0].species.id).toBe(species.id);
      expect(room.teams[0]![0].stats.hp).toBeGreaterThan(0);
    });
  });
});
