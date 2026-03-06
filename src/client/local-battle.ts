/**
 * Local battle engine adapter for offline CPU games.
 * Runs the Battle engine directly in-process — no server/sockets needed.
 *
 * Implements the same dispatch-based interface as the socket connections,
 * so the UI (battle-reducer, BattleScreen, etc.) works identically.
 */

import { Battle } from '../engine/battle';
import { generateTeam } from '../engine/team-generator';
import { SeededRNG } from '../utils/rng';
import { Player, BattlePokemon, BattleEvent, BattleAction } from '../types';
import { serializeOwnPokemon, serializeVisiblePokemon } from '../server/state-sanitizer';
import type {
  OwnPokemon,
  VisiblePokemon,
  TurnResultPayload,
  NeedsSwitchPayload,
} from '../server/types';
import type { BattleAction as ReducerAction } from './state/battle-reducer';

// Re-export the bot AI functions from socket.ts would create a circular dep,
// so we inline a simplified version here and import the shared scoring logic.
import { getTypeEffectiveness } from '../data/type-chart';
import type { PokemonType } from '../types';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

const BOT_NAMES = [
  'Jonathan', 'Nikhil', 'Trusha', 'Som', 'Meha', 'Ishan',
  'Vikram', 'Amit', 'Tejal', 'Akshay', 'Tanmay', 'Ambi',
];

interface LocalBattleOptions {
  playerName: string;
  itemMode: 'competitive' | 'casual';
  maxGen: number | null;
  difficulty: BotDifficulty;
  legendaryMode: boolean;
  dispatch: (action: ReducerAction) => void;
}

/**
 * Create and manage a local (offline) CPU battle.
 * Returns a handle with start/action/switch methods.
 */
export function createLocalBattle(options: LocalBattleOptions) {
  const { playerName, itemMode, maxGen, difficulty, legendaryMode, dispatch } = options;

  const rng = new SeededRNG();
  const botCandidates = BOT_NAMES.filter(n => n.toLowerCase() !== playerName.toLowerCase());
  const botName = botCandidates[Math.floor(Math.random() * botCandidates.length)];

  // Generate teams
  const humanTeam = generateTeam(rng, { itemMode, maxGen, legendaryMode });
  const botTeam = generateTeam(rng, { itemMode, maxGen, legendaryMode });

  const humanPlayer: Player = {
    id: 'p1',
    name: playerName,
    team: humanTeam,
    activePokemonIndex: 0,
    itemMode,
    hasMegaEvolved: false,
  };

  const botPlayer: Player = {
    id: 'p2',
    name: botName,
    team: botTeam,
    activePokemonIndex: 0,
    itemMode,
    hasMegaEvolved: false,
  };

  let battle: Battle | null = null;
  let botState: TurnResultPayload['yourState'] | null = null;
  let botOpponent: VisiblePokemon | null = null;

  // --- Serialization helpers (mirror state-sanitizer but without Room dependency) ---

  function buildTurnResult(playerIndex: 0 | 1, events: BattleEvent[]): TurnResultPayload {
    const b = battle!;
    const opponentIndex = (1 - playerIndex) as 0 | 1;
    const player = b.state.players[playerIndex];
    const opponent = b.state.players[opponentIndex];

    const activePokemon = opponent.team[opponent.activePokemonIndex];

    return {
      events,
      yourState: {
        team: player.team.map(serializeOwnPokemon),
        activePokemonIndex: player.activePokemonIndex,
        sideEffects: { ...b.getSideEffects(playerIndex) },
      },
      opponentVisible: {
        activePokemon: activePokemon.isAlive ? serializeVisiblePokemon(activePokemon) : null,
        scoutedPokemon: [], // In local mode, no scouting tracking needed
        teamSize: opponent.team.length,
        faintedCount: opponent.team.filter(p => !p.isAlive).length,
        sideEffects: { ...b.getSideEffects(opponentIndex) },
      },
      turn: b.state.turn,
      weather: b.state.weather,
    };
  }

  function buildNeedsSwitch(playerIndex: 0 | 1): NeedsSwitchPayload {
    const b = battle!;
    const availableIndices = b.getAvailableSwitches(playerIndex);
    const player = b.state.players[playerIndex];
    const isSelfSwitch = b.needsSelfSwitch(playerIndex);

    return {
      availableSwitches: availableIndices.map(idx => ({
        index: idx,
        pokemon: serializeOwnPokemon(player.team[idx]),
      })),
      reason: isSelfSwitch ? 'self_switch' : 'faint',
    };
  }

  // --- Bot AI (same logic as socket.ts but self-contained) ---

  function pickBotAction(): BattleAction {
    if (!botState) return { type: 'move', playerId: 'p2', moveIndex: 0 };

    const active = botState.team[botState.activePokemonIndex];
    const oppTypes = (botOpponent?.species.types ?? []) as PokemonType[];

    if (difficulty === 'easy') {
      return pickEasyAction(botState);
    }

    const isHard = difficulty === 'hard';
    const botTypes = active.species.types as PokemonType[];
    const hpPct = active.currentHp / active.maxHp;
    const oppHpPct = botOpponent ? botOpponent.currentHp / botOpponent.maxHp : 1;

    const switches = botState.team
      .map((p, i) => ({ alive: p.isAlive, idx: i }))
      .filter(s => s.idx !== botState!.activePokemonIndex && s.alive);

    // Choice-locked
    if (active.choiceLocked) {
      const lockedIdx = active.moves.findIndex(m => m.name === active.choiceLocked);
      if (lockedIdx >= 0 && active.moves[lockedIdx].currentPp > 0) {
        if (oppTypes.length > 0) {
          const eff = getTypeEffectiveness(active.moves[lockedIdx].type as PokemonType, oppTypes);
          if (eff === 0 && switches.length > 0) {
            return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, isHard) };
          }
        }
        return { type: 'move', playerId: 'p2', moveIndex: lockedIdx };
      }
      if (switches.length > 0) {
        return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, isHard) };
      }
    }

    const usableMoves = active.moves
      .map((m, i) => ({ ...m, idx: i }))
      .filter(m => m.currentPp > 0 && !m.disabled);

    if (usableMoves.length === 0) {
      if (switches.length > 0) {
        return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, isHard) };
      }
      return { type: 'move', playerId: 'p2', moveIndex: 0 }; // Struggle
    }

    // Estimate opponent threat
    let oppThreat = 1;
    if (isHard && oppTypes.length > 0) {
      for (const oppType of oppTypes) {
        oppThreat *= getTypeEffectiveness(oppType, botTypes);
      }
    }

    const scoredMoves = usableMoves.map(m => {
      let score = 0;
      const moveType = m.type as PokemonType;

      if (m.category !== 'Status' && m.power) {
        score = m.power;
        if (oppTypes.length > 0) {
          const eff = getTypeEffectiveness(moveType, oppTypes);
          if (eff === 0) { score = -100; } else { score *= eff; }
        }
        if (botTypes.includes(moveType)) score *= 1.5;
        if (m.category === 'Physical') score *= (1 + active.boosts.atk * 0.15);
        else score *= (1 + active.boosts.spa * 0.15);
        if (m.accuracy && m.accuracy < 100) score *= (m.accuracy / 100);
        if (isHard && m.priority > 0 && oppHpPct < 0.25 && score > 0) score *= 1.8;
        if (isHard && oppHpPct < 0.3 && score > 0) score *= 1.3;
        if (isHard && oppHpPct > 0.7 && score > 0) score *= 1 + (m.power / 500);
      } else {
        score = 35;
        const healMoves = ['Recover', 'Roost', 'Moonlight', 'Synthesis', 'Soft-Boiled',
          'Rest', 'Slack Off', 'Morning Sun', 'Milk Drink', 'Shore Up', 'Strength Sap'];
        if (healMoves.includes(m.name)) {
          if (isHard) {
            score = oppHpPct < 0.2 ? 10 : hpPct < 0.35 ? 150 : hpPct < 0.6 ? 100 : hpPct < 0.8 ? 40 : 5;
          } else {
            score = hpPct < 0.5 ? 120 : hpPct < 0.75 ? 60 : 10;
          }
        }
        const setupMoves: Record<string, { stat: string; stages: number }> = {
          'Swords Dance': { stat: 'atk', stages: 2 }, 'Nasty Plot': { stat: 'spa', stages: 2 },
          'Dragon Dance': { stat: 'atk', stages: 1 }, 'Calm Mind': { stat: 'spa', stages: 1 },
          'Bulk Up': { stat: 'atk', stages: 1 }, 'Quiver Dance': { stat: 'spa', stages: 1 },
          'Shell Smash': { stat: 'atk', stages: 2 }, 'Coil': { stat: 'atk', stages: 1 },
          'Shift Gear': { stat: 'spe', stages: 2 }, 'Tail Glow': { stat: 'spa', stages: 3 },
          'Iron Defense': { stat: 'def', stages: 2 }, 'Amnesia': { stat: 'spd', stages: 2 },
          'Agility': { stat: 'spe', stages: 2 }, 'Work Up': { stat: 'atk', stages: 1 },
          'Hone Claws': { stat: 'atk', stages: 1 }, 'Curse': { stat: 'atk', stages: 1 },
        };
        const setupInfo = setupMoves[m.name];
        if (setupInfo) {
          const currentBoost = active.boosts[setupInfo.stat as keyof typeof active.boosts] || 0;
          if (isHard) {
            if (oppThreat >= 2 && hpPct < 0.8) score = 5;
            else if (currentBoost >= 4) score = 5;
            else if (hpPct > 0.7 && oppHpPct > 0.5) score = 110 - currentBoost * 15;
            else if (hpPct > 0.5 && oppThreat <= 1) score = 60 - currentBoost * 10;
            else score = 15;
          } else {
            score = hpPct > 0.6 ? 70 : 25;
          }
        }
        if (m.name === 'Stealth Rock' || m.name === 'Spikes' || m.name === 'Toxic Spikes') {
          score = isHard ? 85 : 65;
        }
        if (['Toxic', 'Will-O-Wisp', 'Thunder Wave', 'Sleep Powder', 'Spore', 'Hypnosis', 'Stun Spore', 'Nuzzle'].includes(m.name)) {
          if (botOpponent?.status) score = 5;
          else if (isHard) {
            const isSleep = ['Sleep Powder', 'Spore', 'Hypnosis'].includes(m.name);
            score = oppHpPct < 0.2 ? 15 : isSleep ? 90 : 70;
          } else score = 60;
        }
      }

      if (!isHard) score += Math.random() * 15;
      return { ...m, score };
    });

    scoredMoves.sort((a, b) => b.score - a.score);

    const bestScore = scoredMoves[0].score;
    const switchThreshold = isHard ? 0.9 : 0.6;
    if (bestScore < 20 && switches.length > 0 && Math.random() < switchThreshold) {
      return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, isHard) };
    }
    if (isHard && switches.length > 0 && oppTypes.length > 0) {
      if (oppThreat > 1 && bestScore < 100 && Math.random() < 0.65) {
        return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, true) };
      }
      if (oppThreat >= 4 && bestScore < 150) {
        return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, true) };
      }
    }
    const lowHpSwitchChance = isHard ? 0.4 : 0.15;
    if (switches.length > 0 && hpPct < 0.25 && bestScore < 80 && Math.random() < lowHpSwitchChance) {
      return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, isHard) };
    }

    return { type: 'move', playerId: 'p2', moveIndex: scoredMoves[0].idx };
  }

  function pickEasyAction(state: TurnResultPayload['yourState']): BattleAction {
    const active = state.team[state.activePokemonIndex];
    const usableMoves = active.moves
      .map((m, i) => ({ ...m, idx: i }))
      .filter(m => m.currentPp > 0 && !m.disabled &&
        !(active.choiceLocked && m.name !== active.choiceLocked));
    if (usableMoves.length === 0) {
      const switches = state.team
        .map((p, i) => ({ alive: p.isAlive, idx: i }))
        .filter(s => s.idx !== state.activePokemonIndex && s.alive);
      if (switches.length > 0) {
        return { type: 'switch', playerId: 'p2', pokemonIndex: switches[Math.floor(Math.random() * switches.length)].idx };
      }
      return { type: 'move', playerId: 'p2', moveIndex: 0 };
    }
    return { type: 'move', playerId: 'p2', moveIndex: usableMoves[Math.floor(Math.random() * usableMoves.length)].idx };
  }

  function pickBestSwitchIdx(
    switches: { alive: boolean; idx: number }[],
    oppTypes: PokemonType[],
    isHard: boolean = false,
  ): number {
    const ranked = switches.map(s => {
      const p = botState!.team[s.idx];
      const pTypes = p.species.types as PokemonType[];
      let score = p.currentHp / p.maxHp;
      if (oppTypes.length > 0) {
        for (const move of p.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            const eff = getTypeEffectiveness(move.type as PokemonType, oppTypes);
            if (eff > 1) score += isHard ? 0.7 : 0.5;
            if (isHard && eff > 1 && pTypes.includes(move.type as PokemonType)) score += 0.3;
          }
        }
        for (const oppType of oppTypes) {
          const eff = getTypeEffectiveness(oppType, pTypes);
          if (eff < 1) score += isHard ? 0.35 : 0.2;
          if (eff === 0) score += isHard ? 0.8 : 0.5;
        }
        if (isHard) {
          for (const oppType of oppTypes) {
            const eff = getTypeEffectiveness(oppType, pTypes);
            if (eff > 1) score -= 0.3;
            if (eff >= 4) score -= 0.5;
          }
          score += (p.species.baseStats?.spe ?? 0) / 500;
        }
      }
      return { ...s, score };
    }).sort((a, b) => b.score - a.score);

    return ranked[0].idx;
  }

  function pickBotForceSwitch(): number {
    const b = battle!;
    const available = b.getAvailableSwitches(1);
    if (available.length === 0) return 0;

    const oppTypes = (botOpponent?.species.types ?? []) as PokemonType[];
    if (difficulty === 'hard' && oppTypes.length > 0 && botState) {
      const ranked = available.map(idx => {
        const p = botState!.team[idx];
        const pTypes = p.species.types as PokemonType[];
        let score = p.currentHp / p.maxHp;
        for (const move of p.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            if (getTypeEffectiveness(move.type as PokemonType, oppTypes) > 1) score += 0.5;
          }
        }
        for (const oppType of oppTypes) {
          if (getTypeEffectiveness(oppType, pTypes) < 1) score += 0.2;
        }
        return { idx, score };
      }).sort((a, b) => b.score - a.score);
      return ranked[0].idx;
    }

    // Default: pick healthiest
    let bestIdx = available[0];
    let bestHp = 0;
    for (const idx of available) {
      const p = b.state.players[1].team[idx];
      if (p.currentHp > bestHp) { bestHp = p.currentHp; bestIdx = idx; }
    }
    return bestIdx;
  }

  // --- Force switch resolution ---

  function resolveForceSwitch(playerIndex: 0 | 1, pokemonIndex: number): BattleEvent[] {
    const b = battle!;
    let events: BattleEvent[];

    if (b.needsSelfSwitch(playerIndex)) {
      const active = b.getActivePokemon(playerIndex);
      const lastMove = active.lastMoveUsed;
      const moveData = active.moves.find(m => m.data.name === lastMove);
      const isBatonPass = moveData?.data.selfSwitch === 'copyvolatile';
      events = b.processSelfSwitch(playerIndex, pokemonIndex, isBatonPass);
    } else {
      events = b.processForceSwitch(playerIndex, pokemonIndex);
    }

    return events;
  }

  // --- Public interface ---

  return {
    botName,

    start() {
      // Dispatch setup sequence mimicking socket flow
      dispatch({ type: 'ROOM_CREATED', code: 'LOCAL', botName });

      // Team preview
      dispatch({
        type: 'TEAM_PREVIEW',
        payload: {
          yourTeam: humanTeam.map(serializeOwnPokemon),
          yourPlayerIndex: 0,
        },
      });
    },

    selectLead(leadIndex: number) {
      // Set the human's lead
      humanPlayer.activePokemonIndex = leadIndex;
      // Bot always leads with index 0

      // Create the battle
      battle = new Battle(humanPlayer, botPlayer);

      // Dispatch battle start
      dispatch({
        type: 'BATTLE_START',
        payload: {
          yourTeam: humanPlayer.team.map(serializeOwnPokemon),
          yourPlayerIndex: 0,
        },
      });

      // Reveal bot's lead
      const botLead = serializeOwnPokemon(botPlayer.team[0]);
      dispatch({
        type: 'BOT_LEAD_REVEALED',
        lead: botLead,
        teamSize: botPlayer.team.length,
      });

      // Initialize bot state
      botState = {
        team: botPlayer.team.map(serializeOwnPokemon),
        activePokemonIndex: 0,
        sideEffects: battle.getSideEffects(1),
      };
    },

    submitAction(action: { type: 'move' | 'switch'; index: number }) {
      if (!battle) return;

      // Convert UI action to engine action
      const humanAction: BattleAction = action.type === 'move'
        ? { type: 'move', playerId: 'p1', moveIndex: action.index }
        : { type: 'switch', playerId: 'p1', pokemonIndex: action.index };

      // Get bot's action
      const botAction = pickBotAction();

      // Process the turn
      const events = battle.processTurn(humanAction, botAction);

      // Update bot state
      const botResult = buildTurnResult(1, events);
      botState = botResult.yourState;
      botOpponent = botResult.opponentVisible.activePokemon;

      // Dispatch turn result to human
      const humanResult = buildTurnResult(0, events);
      dispatch({ type: 'TURN_RESULT', payload: humanResult });

      // Check for battle end
      if ((battle.state.status as string) === 'finished') {
        const winnerName = battle.state.winner === 'p1' ? playerName : botName;
        dispatch({
          type: 'BATTLE_END',
          payload: {
            winner: winnerName,
            reason: 'all_fainted',
            finalState: {
              yourTeam: humanPlayer.team.map(serializeOwnPokemon),
              opponentTeam: botPlayer.team.map(serializeOwnPokemon),
              turn: battle.state.turn,
              weather: battle.state.weather,
            },
          },
        });
        return;
      }

      // Check for force switches
      const humanNeedsSwitch = battle.needsSwitch(0) || battle.needsSelfSwitch(0);
      const botNeedsSwitch = battle.needsSwitch(1) || battle.needsSelfSwitch(1);

      // Resolve bot's force switch first (silently)
      if (botNeedsSwitch) {
        const botSwitchIdx = pickBotForceSwitch();
        const switchEvents = resolveForceSwitch(1, botSwitchIdx);
        // Update bot state after switch
        const updatedBotResult = buildTurnResult(1, switchEvents);
        botState = updatedBotResult.yourState;
        botOpponent = updatedBotResult.opponentVisible.activePokemon;

        // Check for battle end after bot switch (e.g. hazard KO)
        if ((battle.state.status as string) === 'finished') {
          const winnerName = battle.state.winner === 'p1' ? playerName : botName;
          dispatch({
            type: 'BATTLE_END',
            payload: {
              winner: winnerName,
              reason: 'all_fainted',
              finalState: {
                yourTeam: humanPlayer.team.map(serializeOwnPokemon),
                opponentTeam: botPlayer.team.map(serializeOwnPokemon),
                turn: battle.state.turn,
                weather: battle.state.weather,
              },
            },
          });
          return;
        }
      }

      // Human needs to switch
      if (humanNeedsSwitch) {
        dispatch({ type: 'NEEDS_SWITCH', payload: buildNeedsSwitch(0) });
      }
    },

    submitForceSwitch(pokemonIndex: number) {
      if (!battle) return;

      const events = resolveForceSwitch(0, pokemonIndex);

      // Check if hazard KO needs another switch
      if (battle.needsSwitch(0)) {
        // Dispatch events first, then re-prompt
        const humanResult = buildTurnResult(0, events);
        dispatch({ type: 'TURN_RESULT', payload: humanResult });
        dispatch({ type: 'NEEDS_SWITCH', payload: buildNeedsSwitch(0) });
        return;
      }

      // Check for battle end
      if ((battle.state.status as string) === 'finished') {
        const winnerName = battle.state.winner === 'p1' ? playerName : botName;
        dispatch({
          type: 'BATTLE_END',
          payload: {
            winner: winnerName,
            reason: 'all_fainted',
            finalState: {
              yourTeam: humanPlayer.team.map(serializeOwnPokemon),
              opponentTeam: botPlayer.team.map(serializeOwnPokemon),
              turn: battle.state.turn,
              weather: battle.state.weather,
            },
          },
        });
        return;
      }

      // Send updated state (switch-in events, hazard damage, etc.)
      const humanResult = buildTurnResult(0, events);
      dispatch({ type: 'TURN_RESULT', payload: humanResult });
    },

    disconnect() {
      battle = null;
      botState = null;
      botOpponent = null;
    },
  };
}

export type LocalBattle = ReturnType<typeof createLocalBattle>;
