import type { Battle } from '../battle';
import type { BattlePokemon, PokemonType } from '../../types';
import type { SeededRNG } from '../../utils/rng';
import { AIFlag, type MoveScore, type ThreatAssessment } from './types';
import { getTypeEffectiveness } from '../../data/type-chart';

const MAX_SWITCHES_PER_BATTLE = 10;

// Track switch counts per battle (keyed by battle id)
const switchCounts = new Map<string, number>();

export function evaluateSwitching(
  battle: Battle,
  playerIndex: number,
  opponentIndex: number,
  flags: number,
  rng: SeededRNG,
  threat: ThreatAssessment,
  moveScores: MoveScore[]
): number | null {
  const pokemon = battle.getActivePokemon(playerIndex);
  const opponent = battle.getActivePokemon(opponentIndex);
  const switches = battle.getAvailableSwitches(playerIndex);

  if (switches.length === 0) return null;

  // Trapped check
  if (pokemon.volatileStatuses.has('trapped')) return null;

  // Switch cap
  const battleId = battle.state.id;
  const count = switchCounts.get(battleId) ?? 0;
  if (count >= MAX_SWITCHES_PER_BATTLE) return null;

  // Don't switch if stats are raised
  const hasRaisedStats = Object.values(pokemon.boosts).some(v => v > 0);

  // 1. WONDER GUARD — can't touch them
  if (opponent.ability === 'Wonder Guard') {
    const hasSeMove = moveScores.some(s => s.effectiveness > 1 && s.score > 50);
    if (!hasSeMove) {
      const switchTo = findMonWithSuperEffective(battle, playerIndex, switches, opponent);
      if (switchTo !== null && rng.chance(67)) return recordSwitch(battleId, switchTo);
    }
  }

  // 2. NATURAL CURE + SLEEP
  if (pokemon.ability === 'Natural Cure' && pokemon.status === 'sleep') {
    if (pokemon.currentHp > pokemon.maxHp * 0.5 && rng.chance(50)) {
      return recordSwitch(battleId, pickBestSwitchIn(battle, playerIndex, switches, opponent));
    }
  }

  // 3. ALL MOVES BAD — no good attacking options
  const bestMoveScore = Math.max(...moveScores.map(m => m.score));
  if (bestMoveScore <= 90) {
    const allImmune = moveScores.every(s => s.effectiveness === 0 || s.score <= 50);
    if (allImmune) {
      const switchTo = findMonWithSuperEffective(battle, playerIndex, switches, opponent);
      if (switchTo !== null && rng.chance(67)) return recordSwitch(battleId, switchTo);
    }
    const allResisted = moveScores.every(s => s.effectiveness < 1 || s.score <= 60);
    if (allResisted && !hasRaisedStats) {
      const switchTo = findMonWithSuperEffective(battle, playerIndex, switches, opponent);
      if (switchTo !== null && rng.chance(33)) return recordSwitch(battleId, switchTo);
    }
  }

  // === SMART+ SWITCHING (Flag: SWITCH_SMART) ===
  if (flags & AIFlag.SWITCH_SMART) {
    // Will be KO'd AND can't KO back — defensive switch
    if (threat.canTheyKO && !threat.canIKO && !threat.iGoFirst && !hasRaisedStats) {
      const switchTo = pickBestSwitchIn(battle, playerIndex, switches, opponent);
      if (switchTo !== null && rng.chance(70)) return recordSwitch(battleId, switchTo);
    }

    // Losing the trade badly
    if (threat.turnsToBeKOd < threat.turnsToKO - 1 &&
        pokemon.currentHp < pokemon.maxHp * 0.6 &&
        !hasRaisedStats) {
      const switchTo = pickBestSwitchIn(battle, playerIndex, switches, opponent);
      if (switchTo !== null && rng.chance(40)) return recordSwitch(battleId, switchTo);
    }

    // --- BUG 1 FIX: Proactive switching ---

    // Type disadvantage: opponent has SE STAB and outspeeds us
    if (!hasRaisedStats && !threat.iGoFirst && threat.theirBestDamagePercent > 50) {
      const opponentHasSeStab = opponent.moves.some(m => {
        if (m.data.category === 'Status' || m.currentPp <= 0) return false;
        const isStab = opponent.species.types.includes(m.data.type as PokemonType);
        const eff = getTypeEffectiveness(m.data.type as PokemonType, pokemon.species.types as PokemonType[]);
        return isStab && eff > 1;
      });
      if (opponentHasSeStab) {
        const switchTo = pickBestSwitchIn(battle, playerIndex, switches, opponent);
        if (switchTo !== null && rng.chance(65)) return recordSwitch(battleId, switchTo);
      }
    }

    // Badly poisoned with <50% HP — switch to a fresh mon
    if (pokemon.status === 'toxic' && pokemon.currentHp < pokemon.maxHp * 0.5 && !hasRaisedStats) {
      const switchTo = pickBestSwitchIn(battle, playerIndex, switches, opponent);
      if (switchTo !== null && rng.chance(55)) return recordSwitch(battleId, switchTo);
    }

    // Can't do meaningful damage (<15% of opponent HP with best move)
    if (threat.myBestDamagePercent < 15 && !hasRaisedStats) {
      const switchTo = pickBestSwitchIn(battle, playerIndex, switches, opponent);
      if (switchTo !== null && rng.chance(50)) return recordSwitch(battleId, switchTo);
    }
  }

  // Don't switch if we have a super effective move (matching pokeemerald)
  const hasSEMove = moveScores.some(s => s.effectiveness > 1 && s.score > 90);
  if (hasSEMove) return null;

  return null;
}

function recordSwitch(battleId: string, idx: number | null): number | null {
  if (idx === null) return null;
  switchCounts.set(battleId, (switchCounts.get(battleId) ?? 0) + 1);
  return idx;
}

function findMonWithSuperEffective(
  battle: Battle,
  playerIndex: number,
  switches: number[],
  opponent: BattlePokemon
): number | null {
  const player = battle.state.players[playerIndex];

  for (const idx of switches) {
    const mon = player.team[idx];
    for (const move of mon.moves) {
      if (move.data.category === 'Status') continue;
      const eff = getTypeEffectiveness(move.data.type as PokemonType, opponent.species.types as PokemonType[]);
      if (eff > 1) return idx;
    }
  }
  return null;
}

export function pickBestSwitchIn(
  battle: Battle,
  playerIndex: number,
  switches: number[],
  opponent: BattlePokemon
): number | null {
  const player = battle.state.players[playerIndex];
  let bestScore = -Infinity;
  let bestIdx: number | null = null;

  for (const idx of switches) {
    const mon = player.team[idx];
    let score = 0;

    // Defensive typing — resist opponent's STAB types (+3 per resist, -3 per weakness per task spec)
    for (const oppType of opponent.species.types) {
      const eff = getTypeEffectiveness(oppType as PokemonType, mon.species.types as PokemonType[]);
      if (eff === 0) score += 60;
      else if (eff < 1) score += 30;
      else if (eff > 1) score -= 20;
    }

    // BUG 4 FIX: Check if opponent has SE moves against this candidate (-3 per spec)
    for (const oppMove of opponent.moves) {
      if (oppMove.data.category === 'Status' || oppMove.currentPp <= 0) continue;
      const eff = getTypeEffectiveness(oppMove.data.type as PokemonType, mon.species.types as PokemonType[]);
      if (eff > 1) {
        score -= 30;
        break; // only penalize once
      }
    }

    // Resist opponent's last used move type
    if (opponent.lastMoveUsed) {
      const lastMove = opponent.moves.find(m => m.data.name === opponent.lastMoveUsed);
      if (lastMove && lastMove.data.category !== 'Status') {
        const eff = getTypeEffectiveness(lastMove.data.type as PokemonType, mon.species.types as PokemonType[]);
        if (eff === 0) score += 40;
        else if (eff < 1) score += 25;
        else if (eff > 1) score -= 15;
      }
    }

    // Offensive typing — have SE moves (+2 per spec)
    for (const move of mon.moves) {
      if (move.data.category === 'Status') continue;
      const eff = getTypeEffectiveness(move.data.type as PokemonType, opponent.species.types as PokemonType[]);
      if (eff > 1) { score += 40; break; }
    }

    // HP factor (+1 per 25% bracket per spec)
    const hpPct = mon.currentHp / mon.maxHp;
    score += Math.floor(hpPct * 4) * 10;

    // Can it outspeed? (+1 per spec)
    if (mon.stats.spe > opponent.stats.spe) score += 10;

    // Don't switch to something that will just die
    if (mon.currentHp < mon.maxHp * 0.2) score -= 50;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

// Reset switch count for a new battle
export function resetSwitchCount(battleId: string): void {
  switchCounts.delete(battleId);
}
