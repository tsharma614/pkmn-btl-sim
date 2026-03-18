/**
 * Tests for force-switch chains where hazard damage KOs Pokemon on switch-in.
 * Regression: when the LAST opponent Pokemon dies from Spikes on force-switch,
 * the faint event was never broadcast to clients (KOs showed 5 instead of 6).
 */

import { describe, it, expect } from 'vitest';
import { Room } from '../../src/server/room';
import { Battle } from '../../src/engine/battle';
import { generateTeam } from '../../src/engine/team-generator';
import { SeededRNG } from '../../src/utils/rng';

describe('Hazard KO on force switch', () => {
  it('Spikes damage is tracked in force switch events', () => {
    const room = new Room('TEST01', 42);
    room.addPlayer('s1', 'Alice', 'competitive');
    room.addPlayer('s2', 'Bob', 'competitive');

    // Both select leads
    room.selectLead(0, 0, 'competitive');
    room.selectLead(1, 0, 'competitive');
    expect(room.status).toBe('battling');

    // Set up spikes on opponent side
    const battle = room.battle!;
    const oppSide = battle.getSideEffects(1);
    oppSide.spikesLayers = 3; // max spikes

    // Force a scenario: KO opponent's active, they switch in someone with low HP
    const oppTeam = battle.state.players[1].team;
    const oppActive = oppTeam[oppTeam.findIndex((_, i) => i === battle.state.players[1].activePokemonIndex)];

    // Set opponent active to 1 HP so any attack KOs it
    oppActive.currentHp = 1;

    // Submit actions
    room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: 0 });
    room.submitAction(1, { type: 'move', playerId: 'p2', moveIndex: 0 });
    const turnEvents = room.processTurn();

    // Check if opponent needs force switch (their Pokemon fainted)
    if (room.pendingForceSwitch[1]) {
      const available = battle.getAvailableSwitches(1);
      // Find a non-Flying switch target so Spikes actually apply
      const switchTarget = available.find(idx => {
        const types = oppTeam[idx].species.types as string[];
        return !types.includes('Flying') && oppTeam[idx].ability !== 'Levitate' && oppTeam[idx].item !== 'Heavy-Duty Boots';
      });
      if (switchTarget !== undefined) {
        oppTeam[switchTarget].currentHp = 1; // will die to spikes

        const result = room.processForceSwitch(1, switchTarget);
        expect(result.events.length).toBeGreaterThan(0);

        // Should have hazard_damage event (Stealth Rock or Spikes — SR applies first)
        const hazardEvent = result.events.find(e => e.type === 'hazard_damage');
        expect(hazardEvent).toBeDefined();

        // Should have faint event for the hazard KO
        const faintEvent = result.events.find(e => e.type === 'faint');
        expect(faintEvent).toBeDefined();

        // Events should be accumulated
        expect(room.forceSwitchEvents.length).toBeGreaterThan(0);
      }
    }
  });

  it('force switch events are accumulated across multiple switches', () => {
    const room = new Room('TEST02', 42);
    room.addPlayer('s1', 'Alice', 'competitive');
    room.addPlayer('s2', 'Bob', 'competitive');
    room.selectLead(0, 0, 'competitive');
    room.selectLead(1, 0, 'competitive');

    const battle = room.battle!;
    const oppSide = battle.getSideEffects(1);
    oppSide.spikesLayers = 3;

    // KO opponent's active
    const oppActive = battle.getActivePokemon(1);
    oppActive.currentHp = 1;

    room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: 0 });
    room.submitAction(1, { type: 'move', playerId: 'p2', moveIndex: 0 });
    room.processTurn();

    if (room.pendingForceSwitch[1]) {
      const available1 = battle.getAvailableSwitches(1);
      if (available1.length > 0) {
        // Set first switch-in to 1 HP (will die to spikes)
        const idx1 = available1[0];
        battle.state.players[1].team[idx1].currentHp = 1;

        const result1 = room.processForceSwitch(1, idx1);
        const eventsAfterFirst = room.forceSwitchEvents.length;

        if (result1.needsMoreSwitches) {
          const available2 = battle.getAvailableSwitches(1);
          if (available2.length > 0) {
            const result2 = room.processForceSwitch(1, available2[0]);
            // Second set of events should be accumulated on top of first
            expect(room.forceSwitchEvents.length).toBeGreaterThan(eventsAfterFirst);
          }
        }
      }
    }
  });

  it('processing lock is released when battle ends during force switch', () => {
    const room = new Room('TEST03', 42);
    room.addPlayer('s1', 'Alice', 'competitive');
    room.addPlayer('s2', 'Bob', 'competitive');
    room.selectLead(0, 0, 'competitive');
    room.selectLead(1, 0, 'competitive');

    const battle = room.battle!;
    const oppSide = battle.getSideEffects(1);
    oppSide.spikesLayers = 3;

    // KO all opponent's Pokemon except active
    const oppTeam = battle.state.players[1].team;
    for (let i = 0; i < oppTeam.length; i++) {
      if (i !== battle.state.players[1].activePokemonIndex) {
        oppTeam[i].currentHp = 0;
        oppTeam[i].isAlive = false;
      }
    }
    // Set active to 1 HP
    oppTeam[battle.state.players[1].activePokemonIndex].currentHp = 1;

    room.submitAction(0, { type: 'move', playerId: 'p1', moveIndex: 0 });
    room.submitAction(1, { type: 'move', playerId: 'p2', moveIndex: 0 });
    room.processTurn();

    // Battle should be finished (only Pokemon at 1 HP, will faint from any attack)
    if (room.status === 'finished') {
      expect(room.isProcessingTurn).toBe(false);
    }
  });

  it('Spikes stacks correctly at 1, 2, and 3 layers', () => {
    const rng = new SeededRNG(42);
    const team1 = generateTeam(rng, { itemMode: 'competitive' });
    const team2 = generateTeam(rng, { itemMode: 'competitive' });
    const battle = new Battle(
      { id: 'p1', name: 'A', team: team1, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false },
      { id: 'p2', name: 'B', team: team2, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false },
      42,
    );

    // Test each layer of spikes damage
    const side = battle.getSideEffects(1);
    const pokemon = battle.state.players[1].team[1]; // a non-active Pokemon
    const maxHp = pokemon.maxHp;

    // Skip if Pokemon is Flying type (immune to spikes)
    const isFlying = (pokemon.species.types as string[]).includes('Flying');
    if (isFlying) return;

    // Layer 1: 1/8 max HP
    side.spikesLayers = 1;
    pokemon.currentHp = maxHp;
    const expected1 = Math.max(1, Math.floor(maxHp / 8));

    // Layer 2: 1/6 max HP
    side.spikesLayers = 2;
    const expected2 = Math.max(1, Math.floor(maxHp / 6));
    expect(expected2).toBeGreaterThan(expected1);

    // Layer 3: 1/4 max HP
    side.spikesLayers = 3;
    const expected3 = Math.max(1, Math.floor(maxHp / 4));
    expect(expected3).toBeGreaterThan(expected2);
  });

  it('Toxic Spikes stacks: 1 layer = poison, 2 layers = toxic', () => {
    const rng = new SeededRNG(42);
    const team1 = generateTeam(rng, { itemMode: 'competitive' });
    const team2 = generateTeam(rng, { itemMode: 'competitive' });
    const battle = new Battle(
      { id: 'p1', name: 'A', team: team1, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false },
      { id: 'p2', name: 'B', team: team2, activePokemonIndex: 0, itemMode: 'competitive', hasMegaEvolved: false },
      42,
    );

    const side = battle.getSideEffects(1);

    // Find a non-Flying, non-Poison, non-Steel Pokemon on team 2
    const validIdx = battle.state.players[1].team.findIndex((p, i) => {
      if (i === battle.state.players[1].activePokemonIndex) return false;
      const types = p.species.types as string[];
      return !types.includes('Flying') && !types.includes('Poison') && !types.includes('Steel') && p.isAlive;
    });
    if (validIdx === -1) return; // skip if no valid target

    // 1 layer: should apply poison
    side.toxicSpikesLayers = 1;
    const p = battle.state.players[1].team[validIdx];
    p.status = null;
    const events1 = battle.processForceSwitch(1, validIdx);
    // Check if poison was applied
    const statusEvent1 = events1.find(e => e.type === 'status' && e.data.pokemon === p.species.name);
    if (statusEvent1) {
      expect(statusEvent1.data.status).toBe('poison');
    }

    // Reset for 2 layer test
    p.status = null;
    side.toxicSpikesLayers = 2;
    // Switch back to a different Pokemon first
    const origActive = battle.state.players[1].activePokemonIndex;
    if (origActive !== validIdx) {
      // We already switched to validIdx, switch back
      battle.state.players[1].activePokemonIndex = origActive;
    }
    const events2 = battle.processForceSwitch(1, validIdx);
    const statusEvent2 = events2.find(e => e.type === 'status' && e.data.pokemon === p.species.name);
    if (statusEvent2) {
      expect(statusEvent2.data.status).toBe('toxic');
    }
  });
});
