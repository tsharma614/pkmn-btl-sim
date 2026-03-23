/**
 * Local battle engine adapter for offline CPU games.
 * Runs the Battle engine directly in-process — no server/sockets needed.
 *
 * Implements the same dispatch-based interface as the socket connections,
 * so the UI (battle-reducer, BattleScreen, etc.) works identically.
 */

import { Battle } from '../engine/battle';
import { generateTeam, generateEliteFourCpuTeam, generateChampionCpuTeam } from '../engine/team-generator';
import { generateDraftPool, generateGymLeaderPool, pickBotDraftPick, pickGymLeaderDraftPick, buildTeamFromDraftPicks, SNAKE_ORDER } from '../engine/draft-pool';
import type { DraftPoolEntry, DraftType, RoleDraftPoolEntry, DraftRole } from '../engine/draft-pool';
import { generateRoleDraftPool, DRAFT_ROLES } from '../engine/draft-pool';
import { getGymLeader } from '../data/gym-leaders';
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
import { BOT_NAMES } from '../engine/bot';
import type { PokemonType } from '../types';

export type BotDifficulty = 'easy' | 'normal' | 'hard';


interface LocalBattleOptions {
  playerName: string;
  itemMode: 'competitive' | 'casual';
  maxGen: number | null;
  difficulty: BotDifficulty;
  legendaryMode: boolean;
  draftMode: boolean;
  draftType: DraftType;
  monotype: string | null;
  poolSize: number;
  megaMode: boolean;
  dispatch: (action: ReducerAction) => void;
  // Elite Four options
  eliteFourStage?: number;
  eliteFourPlayerTeam?: BattlePokemon[];
  eliteFourOpponentName?: string;
  // Campaign options (pre-built teams)
  campaignPlayerTeam?: BattlePokemon[];
  campaignOpponentTeam?: BattlePokemon[];
  campaignOpponentName?: string;
}

/**
 * Create and manage a local (offline) CPU battle.
 * Returns a handle with start/action/switch methods.
 */
export function createLocalBattle(options: LocalBattleOptions) {
  const { playerName, itemMode, maxGen, difficulty, legendaryMode, draftMode, draftType, monotype, poolSize, megaMode, dispatch } = options;
  const isCampaign = !!(options.campaignPlayerTeam && options.campaignOpponentTeam);
  const isEliteFour = !isCampaign && options.eliteFourStage != null;

  // Gym leader challenge: legendary + draft + hard + monotype = gym leader mode
  const isGymLeaderChallenge = !isEliteFour && !isCampaign && draftMode && draftType !== 'role' && monotype && difficulty === 'hard' && legendaryMode;
  const gymLeader = isGymLeaderChallenge ? getGymLeader(monotype) : null;

  const rng = new SeededRNG();
  const botCandidates = BOT_NAMES.filter(n => n.toLowerCase() !== playerName.toLowerCase());
  const botName = isCampaign ? (options.campaignOpponentName ?? 'Opponent')
    : isEliteFour ? (options.eliteFourOpponentName ?? 'Elite Four')
    : gymLeader ? gymLeader.name
    : botCandidates[Math.floor(Math.random() * botCandidates.length)];

  // Draft state
  let draftPool: DraftPoolEntry[] = [];
  let draftHumanPicks: number[] = [];
  let draftBotPicks: number[] = [];
  let draftCurrentPick = 0;
  let draftBotTimer: ReturnType<typeof setTimeout> | null = null;
  // Randomize who picks first: 0 = human first, 1 = bot first
  const draftHumanSlot: 0 | 1 = rng.next() < 0.5 ? 0 : 1;
  const draftBotSlot: 0 | 1 = (1 - draftHumanSlot) as 0 | 1;

  // Role draft state
  let roleOrder: DraftRole[] = [...DRAFT_ROLES];

  // Teams — generated immediately in normal mode, after draft in draft mode
  let humanTeam: BattlePokemon[] = [];
  let botTeam: BattlePokemon[] = [];

  if (isCampaign) {
    // Campaign mode: both teams pre-built by battle-context
    humanTeam = options.campaignPlayerTeam!;
    botTeam = options.campaignOpponentTeam!;
  } else if (isEliteFour) {
    // Elite Four: player team provided, CPU team generated based on stage
    humanTeam = options.eliteFourPlayerTeam ?? [];
    const stage = options.eliteFourStage!;
    if (stage === 4) {
      // Champion: 6 megas
      botTeam = generateChampionCpuTeam(rng, itemMode);
    } else {
      // Elite Four member: 1 mega + 5 T1
      botTeam = generateEliteFourCpuTeam(rng, itemMode);
    }
  } else if (!draftMode) {
    humanTeam = generateTeam(rng, { itemMode, maxGen, legendaryMode, megaMode });
    botTeam = generateTeam(rng, { itemMode, maxGen, legendaryMode, megaMode });
  }

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
  let oppSideEffects: import('../types').SideEffects | null = null;

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

    // Estimate opponent threat (includes stat boosts)
    let oppThreat = 1;
    if (isHard && oppTypes.length > 0) {
      for (const oppType of oppTypes) {
        oppThreat *= getTypeEffectiveness(oppType, botTypes);
      }
      // Factor in opponent's offensive boosts — a +2 Gyarados is much scarier
      if (botOpponent?.boosts) {
        const oppAtkBoost = Math.max(botOpponent.boosts.atk ?? 0, botOpponent.boosts.spa ?? 0);
        if (oppAtkBoost >= 2) oppThreat *= 1.8;
        else if (oppAtkBoost >= 1) oppThreat *= 1.3;
        // Speed boosts mean they'll outrun us
        const oppSpeBoost = botOpponent.boosts.spe ?? 0;
        if (oppSpeBoost >= 1) oppThreat *= 1.2;
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
        if (isHard && m.priority > 0 && oppHpPct < 0.25 && score > 0) score *= 2.0;
        if (isHard && oppHpPct < 0.3 && score > 0) score *= 1.5;
        if (isHard && oppHpPct > 0.7 && score > 0) score *= 1 + (m.power / 400);
        // Hard: stat-based damage estimation
        if (isHard && m.power && score > 0) {
          const atkStat = m.category === 'Physical' ? (active.species.baseStats?.atk ?? 100) : (active.species.baseStats?.spa ?? 100);
          const defStat = botOpponent?.species.baseStats
            ? (m.category === 'Physical' ? botOpponent.species.baseStats.def : botOpponent.species.baseStats.spd)
            : 100;
          score *= (atkStat / Math.max(defStat, 50));
        }
        // Hard: prefer multi-hit moves for breaking sashes/substitutes
        if (isHard && m.name && ['Bullet Seed', 'Rock Blast', 'Icicle Spear', 'Pin Missile', 'Scale Shot', 'Tail Slap', 'Population Bomb', 'Bone Rush', 'Water Shuriken'].includes(m.name)) {
          score *= 1.15;
        }
        // Hard: endgame — avoid setup when opponent has 1 Pokemon left
        if (isHard && botOpponent) {
          const botAlive = botState!.team.filter(p => p.isAlive).length;
          if (botAlive <= 2) {
            // Pure offense mode — slightly boost all attacking moves
            score *= 1.1;
          }
        }
      } else {
        score = 35;
        const healMoves = ['Recover', 'Roost', 'Moonlight', 'Synthesis', 'Soft-Boiled',
          'Rest', 'Slack Off', 'Morning Sun', 'Milk Drink', 'Shore Up', 'Strength Sap'];
        if (healMoves.includes(m.name)) {
          if (isHard) {
            score = oppHpPct < 0.2 ? 10 : hpPct < 0.35 ? 160 : hpPct < 0.5 ? 120 : hpPct < 0.7 ? 80 : hpPct < 0.85 ? 30 : 5;
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
            // Endgame: no setup with few Pokemon left
            const botAlive = botState!.team.filter(p => p.isAlive).length;
            if (botAlive <= 2 && oppHpPct < 0.4) score = 5;
            else if (oppThreat >= 2 && hpPct < 0.8) score = 5;
            else if (currentBoost >= 4) score = 5;
            else if (hpPct > 0.8 && oppHpPct > 0.5) score = 130 - currentBoost * 20;
            else if (hpPct > 0.6 && oppThreat <= 1) score = 80 - currentBoost * 15;
            else score = 15;
          } else {
            score = hpPct > 0.6 ? 70 : 25;
          }
        }
        if (m.name === 'Stealth Rock' || m.name === 'Spikes' || m.name === 'Toxic Spikes' || m.name === 'Sticky Web') {
          if (isHard && oppSideEffects) {
            // Don't use hazards that are already set on the opponent's side
            if (m.name === 'Stealth Rock' && oppSideEffects.stealthRock) score = 0;
            else if (m.name === 'Spikes' && oppSideEffects.spikesLayers >= 3) score = 0;
            else if (m.name === 'Toxic Spikes' && oppSideEffects.toxicSpikesLayers >= 2) score = 0;
            else if (m.name === 'Sticky Web' && oppSideEffects.stickyWeb) score = 0;
            else score = 90;
          } else {
            score = isHard ? 90 : 65;
          }
        }
        if (['Toxic', 'Will-O-Wisp', 'Thunder Wave', 'Sleep Powder', 'Spore', 'Hypnosis', 'Stun Spore', 'Nuzzle'].includes(m.name)) {
          if (botOpponent?.status) score = 5;
          else if (isHard) {
            // Type immunity awareness for status moves
            if (m.name === 'Toxic' && oppTypes.some(t => t === 'Poison' || t === 'Steel')) { score = 0; }
            else if (m.name === 'Will-O-Wisp' && oppTypes.includes('Fire' as PokemonType)) { score = 0; }
            else if (m.name === 'Thunder Wave' && oppTypes.some(t => t === 'Ground' || t === 'Electric')) { score = 0; }
            else if (['Stun Spore', 'Sleep Powder', 'Spore'].includes(m.name) && oppTypes.includes('Grass' as PokemonType)) { score = 0; }
            else {
              const isSleep = ['Sleep Powder', 'Spore', 'Hypnosis'].includes(m.name);
              score = oppHpPct < 0.2 ? 15 : isSleep ? 100 : 75;
              // Prefer Will-O-Wisp vs physical attackers, Thunder Wave vs fast special
              if (m.name === 'Will-O-Wisp' && botOpponent) {
                const oppAtk = botOpponent.species.baseStats?.atk ?? 0;
                const oppSpa = botOpponent.species.baseStats?.spa ?? 0;
                if (oppAtk > oppSpa) score += 15;
              }
              if (m.name === 'Thunder Wave' && botOpponent) {
                const oppSpe = botOpponent.species.baseStats?.spe ?? 0;
                if (oppSpe >= 100) score += 15;
              }
            }
          } else score = 60;
        }
        // Hard: Trick/Switcheroo with choice items is powerful
        if (isHard && ['Trick', 'Switcheroo'].includes(m.name) && active.item && ['Choice Band', 'Choice Specs', 'Choice Scarf'].includes(active.item)) {
          score = 85;
        }
      }

      if (!isHard) score += Math.random() * 15;
      return { ...m, score };
    });

    scoredMoves.sort((a, b) => b.score - a.score);

    const bestScore = scoredMoves[0].score;

    // Only switch on all-NVE/immune if a teammate actually has a better matchup
    if (switches.length > 0 && oppTypes.length > 0 && bestScore <= 0) {
      const hasBetterSwitch = switches.some(s => {
        const p = botState!.team[s.idx];
        return p.moves.some(m =>
          m.category !== 'Status' && m.power && m.currentPp > 0 &&
          getTypeEffectiveness(m.type as PokemonType, oppTypes) >= 1
        );
      });
      if (hasBetterSwitch) {
        return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, isHard) };
      }
    }

    // Only switch when truly necessary — prefer attacking
    if (isHard && switches.length > 0 && oppTypes.length > 0) {
      // 4x weakness + weak best move — get out
      if (oppThreat >= 4 && bestScore < 100) {
        return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, true) };
      }
    } else if (!isHard && switches.length > 0 && bestScore < 15 && Math.random() < 0.4) {
      return { type: 'switch', playerId: 'p2', pokemonIndex: pickBestSwitchIdx(switches, oppTypes, false) };
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
      const hpRatio = p.currentHp / p.maxHp;
      let score = hpRatio;

      // Never switch to nearly-dead Pokemon
      if (hpRatio < 0.05) score -= 3.0;
      else if (hpRatio < 0.15) score -= 1.5;
      else if (hpRatio < 0.3) score -= 0.5;

      if (oppTypes.length > 0) {
        let bestMoveEff = 0;
        for (const move of p.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            const eff = getTypeEffectiveness(move.type as PokemonType, oppTypes);
            if (eff > bestMoveEff) bestMoveEff = eff;
            if (eff > 1) score += isHard ? 0.8 : 0.5;
            if (isHard && eff > 1 && pTypes.includes(move.type as PokemonType)) score += 0.4;
          }
        }
        // Defensive matchup: how much damage will we take?
        const totalDefEff = oppTypes.reduce((acc, oppType) => {
          return acc * getTypeEffectiveness(oppType, pTypes);
        }, 1);
        if (totalDefEff < 1) score += isHard ? 1.0 : 0.4;
        if (totalDefEff === 0) score += isHard ? 2.0 : 1.0;
        // Heavy penalty for being weak — never switch INTO a bad matchup
        if (totalDefEff > 1) score -= isHard ? 2.0 : 1.0;
        if (totalDefEff >= 4) score -= isHard ? 3.0 : 1.5;

        if (isHard) {
          score += (p.species.baseStats?.spe ?? 0) / 400;
          if (bestMoveEff > 1) score += 0.3;
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
    if ((difficulty === 'hard' || difficulty === 'normal') && oppTypes.length > 0 && botState) {
      const isHard = difficulty === 'hard';

      // Estimate how dangerous the opponent is (including boosts)
      let oppBoosted = false;
      if (isHard && botOpponent?.boosts) {
        const oppAtkBoost = Math.max(botOpponent.boosts.atk ?? 0, botOpponent.boosts.spa ?? 0);
        const oppSpeBoost = botOpponent.boosts.spe ?? 0;
        oppBoosted = oppAtkBoost >= 1 || oppSpeBoost >= 1;
      }

      const ranked = available.map(idx => {
        const p = botState!.team[idx];
        const pTypes = p.species.types as PokemonType[];
        const hpRatio = p.currentHp / p.maxHp;
        let score = hpRatio;

        // Heavily penalize nearly-dead Pokemon — never send in a 1 HP mon
        if (hpRatio < 0.05) score -= 3.0;
        else if (hpRatio < 0.15) score -= 1.5;
        else if (hpRatio < 0.3) score -= 0.5;

        // Offensive advantage: super-effective moves
        for (const move of p.moves) {
          if (move.category !== 'Status' && move.power && move.currentPp > 0) {
            const eff = getTypeEffectiveness(move.type as PokemonType, oppTypes);
            if (eff > 1) score += isHard ? 0.8 : 0.4;
            if (isHard && eff > 1 && pTypes.includes(move.type as PokemonType)) score += 0.4;
          }
        }

        // Defensive advantage: resist/immune to opponent's types
        const totalDefEff = oppTypes.reduce((acc, oppType) => {
          return acc * getTypeEffectiveness(oppType, pTypes);
        }, 1);
        if (totalDefEff < 1) score += isHard ? 1.0 : 0.4;
        if (totalDefEff === 0) score += isHard ? 2.0 : 1.0;
        // Heavy penalty for weakness — avoid sending in Pokemon that'll get wrecked
        if (totalDefEff > 1) score -= isHard ? 2.0 : 1.0;
        if (totalDefEff >= 4) score -= isHard ? 3.0 : 1.5;

        if (isHard) {
          score += (p.species.baseStats?.spe ?? 0) / 400;
          // Against a boosted opponent, heavily prioritize defensive matchups
          if (oppBoosted) {
            // Extra penalty for being weak, extra bonus for resisting
            for (const oppType of oppTypes) {
              const eff = getTypeEffectiveness(oppType, pTypes);
              if (eff > 1) score -= 0.5;
              if (eff < 1) score += 0.3;
              if (eff === 0) score += 0.8;
            }
            // Prioritize bulk when opponent is boosted
            const bulkScore = ((p.species.baseStats?.hp ?? 0) + (p.species.baseStats?.def ?? 0) + (p.species.baseStats?.spd ?? 0)) / 600;
            score += bulkScore * 0.5;
          }
        }
        return { idx, score };
      }).sort((a, b) => b.score - a.score);
      return ranked[0].idx;
    }

    // Default (easy): pick healthiest
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

  // --- Draft helpers ---

  /** Get the current role for role draft based on pick number. */
  function getCurrentRole(): DraftRole | null {
    if (draftType !== 'role') return null;
    const round = Math.floor(draftCurrentPick / 2);
    return round < roleOrder.length ? roleOrder[round] : null;
  }

  /** Get valid pool indices for the current role round. */
  function getRoleIndices(role: DraftRole): number[] {
    const picked = new Set([...draftHumanPicks, ...draftBotPicks]);
    return draftPool
      .map((entry, i) => ({ entry: entry as RoleDraftPoolEntry, index: i }))
      .filter(({ entry, index }) => !picked.has(index) && entry.role === role)
      .map(({ index }) => index);
  }

  function scheduleBotDraftPicks() {
    if (draftCurrentPick >= SNAKE_ORDER.length) return;
    if (SNAKE_ORDER[draftCurrentPick] !== draftBotSlot) return; // not bot's turn

    draftBotTimer = setTimeout(() => {
      draftBotTimer = null;
      if (draftCurrentPick >= SNAKE_ORDER.length) return;

      let pickIdx: number;
      if (draftType === 'role') {
        // Role draft: bot must pick from the current role's pool
        const role = getCurrentRole();
        const validIndices = role ? getRoleIndices(role) : [];
        if (validIndices.length > 0) {
          // Use normal draft AI but filtered to valid indices
          const fullPick = pickBotDraftPick(draftPool, draftBotPicks, draftHumanPicks, difficulty, rng);
          pickIdx = validIndices.includes(fullPick) ? fullPick : rng.pick(validIndices);
        } else {
          pickIdx = pickBotDraftPick(draftPool, draftBotPicks, draftHumanPicks, difficulty, rng);
        }
      } else if (gymLeader && monotype) {
        pickIdx = pickGymLeaderDraftPick(draftPool, draftBotPicks, draftHumanPicks, monotype, rng);
      } else {
        pickIdx = pickBotDraftPick(draftPool, draftBotPicks, draftHumanPicks, difficulty, rng);
      }

      draftBotPicks.push(pickIdx);
      dispatch({ type: 'DRAFT_PICK', playerIndex: draftBotSlot, poolIndex: pickIdx });
      draftCurrentPick++;

      if (draftCurrentPick >= SNAKE_ORDER.length) {
        finalizeDraft();
        return;
      }

      // Bot may have consecutive picks (snake draft)
      if (SNAKE_ORDER[draftCurrentPick] === draftBotSlot) {
        scheduleBotDraftPicks();
      }
    }, 1200);
  }

  function finalizeDraft() {
    const humanSpecies = draftHumanPicks.map(i => draftPool[i].species);
    const botSpecies = draftBotPicks.map(i => draftPool[i].species);

    humanTeam = buildTeamFromDraftPicks(humanSpecies, rng, { itemMode, maxGen });
    botTeam = buildTeamFromDraftPicks(botSpecies, rng, { itemMode, maxGen });

    humanPlayer.team = humanTeam;
    botPlayer.team = botTeam;

    dispatch({
      type: 'DRAFT_COMPLETE',
      yourTeam: humanTeam.map(serializeOwnPokemon),
    });
  }

  // --- Public interface ---

  return {
    botName,

    /** Update the human player's team (used by move selection). */
    updateHumanTeam(newTeam: BattlePokemon[]) {
      humanTeam = newTeam;
      humanPlayer.team = newTeam;
    },

    start() {
      // Dispatch setup sequence mimicking socket flow
      dispatch({ type: 'ROOM_CREATED', code: 'LOCAL', botName });

      if (isCampaign || isEliteFour) {
        // Campaign/E4 mode: skip draft, go straight to team preview
        dispatch({
          type: 'TEAM_PREVIEW',
          payload: {
            yourTeam: humanTeam.map(serializeOwnPokemon),
            yourPlayerIndex: 0,
          },
        });
        return;
      }

      if (draftMode) {
        // Generate draft pool instead of teams
        console.log(`[local-battle] Draft mode start — generating pool (maxGen: ${maxGen}, legendary: ${legendaryMode}, gym: ${gymLeader?.name ?? 'none'}), humanSlot: ${draftHumanSlot}`);
        if (draftType === 'role') {
          draftPool = generateRoleDraftPool(rng, { maxGen, legendaryMode, itemMode });
          rng.shuffle(roleOrder);
        } else if (gymLeader && monotype) {
          draftPool = generateGymLeaderPool(rng, monotype, { maxGen, legendaryMode, itemMode, poolSize, megaMode });
        } else {
          draftPool = generateDraftPool(rng, { maxGen, legendaryMode, itemMode, monotype, poolSize, megaMode });
        }
        draftHumanPicks = [];
        draftBotPicks = [];
        draftCurrentPick = 0;

        dispatch({
          type: 'DRAFT_START',
          pool: draftPool,
          yourPlayerIndex: draftHumanSlot,
          draftType,
          roleOrder: draftType === 'role' ? roleOrder : undefined,
        });

        // If bot picks first (SNAKE_ORDER[0] matches bot's slot)
        if (SNAKE_ORDER[0] === draftBotSlot) {
          scheduleBotDraftPicks();
        }
      } else {
        // Normal flow: team preview
        dispatch({
          type: 'TEAM_PREVIEW',
          payload: {
            yourTeam: humanTeam.map(serializeOwnPokemon),
            yourPlayerIndex: 0,
          },
        });
      }
    },

    submitDraftPick(poolIndex: number) {
      if (!draftMode || draftCurrentPick >= SNAKE_ORDER.length) return;
      if (SNAKE_ORDER[draftCurrentPick] !== draftHumanSlot) return; // not human's turn
      const picked = new Set([...draftHumanPicks, ...draftBotPicks]);
      if (picked.has(poolIndex)) return; // already picked

      // Role check: must pick from current role's pool
      if (draftType === 'role') {
        const role = getCurrentRole();
        if (role) {
          const validIndices = getRoleIndices(role);
          if (!validIndices.includes(poolIndex)) return;
        }
      }

      // Record human pick
      draftHumanPicks.push(poolIndex);
      dispatch({ type: 'DRAFT_PICK', playerIndex: draftHumanSlot, poolIndex });
      draftCurrentPick++;

      // Check if draft is complete
      if (draftCurrentPick >= SNAKE_ORDER.length) {
        finalizeDraft();
        return;
      }

      // Schedule bot picks if it's bot's turn
      if (SNAKE_ORDER[draftCurrentPick] === draftBotSlot) {
        scheduleBotDraftPicks();
      }
    },

    rerollDraftPool() {
      if (!draftMode) return;
      // Cancel any pending bot pick timer
      if (draftBotTimer) {
        clearTimeout(draftBotTimer);
        draftBotTimer = null;
      }
      console.log(`[local-battle] Rerolling draft pool`);
      if (draftType === 'role') {
        draftPool = generateRoleDraftPool(rng, { maxGen, legendaryMode, itemMode });
        rng.shuffle(roleOrder);
      } else if (gymLeader && monotype) {
        draftPool = generateGymLeaderPool(rng, monotype, { maxGen, legendaryMode, itemMode, poolSize, megaMode });
      } else {
        draftPool = generateDraftPool(rng, { maxGen, legendaryMode, itemMode, monotype, poolSize, megaMode });
      }
      draftHumanPicks = [];
      draftBotPicks = [];
      draftCurrentPick = 0;

      dispatch({
        type: 'DRAFT_START',
        pool: draftPool,
        yourPlayerIndex: draftHumanSlot,
        draftType,
        roleOrder: draftType === 'role' ? roleOrder : undefined,
      });

      // If bot picks first
      if (SNAKE_ORDER[0] === draftBotSlot) {
        scheduleBotDraftPicks();
      }
    },

    selectLead(leadIndex: number) {
      // Guard: prevent calling selectLead twice on the same battle
      if (battle) {
        console.warn(`[local-battle] selectLead called but battle already exists — ignoring`);
        return;
      }

      // Swap chosen lead to front (mirrors server Room.selectLead)
      if (leadIndex !== 0) {
        const temp = humanPlayer.team[leadIndex];
        humanPlayer.team[leadIndex] = humanPlayer.team[0];
        humanPlayer.team[0] = temp;
      }
      humanPlayer.activePokemonIndex = 0;

      // Hard mode: intelligent bot lead selection
      if (difficulty === 'hard' && botPlayer.team.length > 1) {
        const leadScores = botPlayer.team.map((p, i) => {
          let score = p.species.baseStats.spe / 2; // Speed matters for leads
          for (const m of p.moves) {
            if (['Stealth Rock', 'Spikes', 'Sticky Web'].includes(m.data.name)) score += 20;
            if (['Swords Dance', 'Nasty Plot', 'Dragon Dance', 'Shell Smash', 'Quiver Dance'].includes(m.data.name)) score += 10;
          }
          // BST matters
          const bst = Object.values(p.species.baseStats).reduce((a: number, b: number) => a + b, 0);
          score += bst / 60;
          return { i, score };
        });
        leadScores.sort((a, b) => b.score - a.score);
        const bestLeadIdx = leadScores[0].i;
        if (bestLeadIdx !== 0) {
          const temp = botPlayer.team[bestLeadIdx];
          botPlayer.team[bestLeadIdx] = botPlayer.team[0];
          botPlayer.team[0] = temp;
        }
      }

      // Create the battle
      battle = new Battle(humanPlayer, botPlayer);

      // Serialize bot lead for opponent display
      const botLeadPokemon = botPlayer.team[0];
      const botLeadVisible = serializeVisiblePokemon(botLeadPokemon);
      console.log(`[local-battle] selectLead(${leadIndex}) — lead: ${humanPlayer.team[0].species.name}, bot lead: ${botLeadPokemon.species.name} (${botLeadPokemon.species.id})`);

      // Dispatch battle start with opponent lead included to avoid "???" flash
      dispatch({
        type: 'BATTLE_START',
        payload: {
          yourTeam: humanPlayer.team.map(serializeOwnPokemon),
          yourPlayerIndex: 0,
          activePokemonIndex: 0,
          opponentLead: botLeadVisible,
          opponentName: botName,
        },
      });

      // Also dispatch BOT_LEAD_REVEALED for compatibility
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

      try {
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
        oppSideEffects = botResult.opponentVisible.sideEffects;

        // Dispatch turn result to human
        const humanResult = buildTurnResult(0, events);
        console.log(`[local-battle] TURN_RESULT — opponent active: ${humanResult.opponentVisible.activePokemon?.species.name ?? 'NULL'}, fainted: ${humanResult.opponentVisible.faintedCount}, events: ${events.length}`);
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

        // Resolve bot's force switch and dispatch events so UI shows the new opponent
        if (botNeedsSwitch) {
          const botSwitchIdx = pickBotForceSwitch();
          console.log(`[local-battle] Bot force switch to index ${botSwitchIdx} (${botPlayer.team[botSwitchIdx]?.species.name})`);
          const switchEvents = resolveForceSwitch(1, botSwitchIdx);
          console.log(`[local-battle] Switch events:`, switchEvents.map(e => `${e.type}:${JSON.stringify(e.data)}`));
          // Update bot state after switch
          const updatedBotResult = buildTurnResult(1, switchEvents);
          botState = updatedBotResult.yourState;
          botOpponent = updatedBotResult.opponentVisible.activePokemon;
          oppSideEffects = updatedBotResult.opponentVisible.sideEffects;

          // Dispatch the switch events so the UI shows the new opponent Pokemon
          const humanSwitchResult = buildTurnResult(0, switchEvents);
          console.log(`[local-battle] Dispatching bot switch TURN_RESULT — opponent active: ${humanSwitchResult.opponentVisible.activePokemon?.species.name ?? 'NULL'}, events: ${switchEvents.length}`);
          dispatch({ type: 'TURN_RESULT', payload: humanSwitchResult });

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
      } catch (err) {
        console.error(`[local-battle] submitAction CRASHED:`, err);
        // Recover: dispatch an empty turn result to unstick from waiting_for_turn
        const recoveryResult = buildTurnResult(0, []);
        dispatch({ type: 'TURN_RESULT', payload: recoveryResult });
      }
    },

    submitForceSwitch(pokemonIndex: number) {
      if (!battle) return;

      try {
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
      } catch (err) {
        console.error(`[local-battle] submitForceSwitch CRASHED:`, err);
        const recoveryResult = buildTurnResult(0, []);
        dispatch({ type: 'TURN_RESULT', payload: recoveryResult });
      }
    },

    disconnect() {
      if (draftBotTimer) {
        clearTimeout(draftBotTimer);
        draftBotTimer = null;
      }
      battle = null;
      botState = null;
      botOpponent = null;
    },
  };
}

export type LocalBattle = ReturnType<typeof createLocalBattle>;
