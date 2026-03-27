import type { BattlePokemon } from '../../types';
import type { Battle } from '../battle';
import type { SeededRNG } from '../../utils/rng';
import type { MoveScore, ThreatAssessment } from './types';
import { countAliveTeammates } from './check-bad-move';

export function checkViability(
  scores: MoveScore[],
  pokemon: BattlePokemon,
  opponent: BattlePokemon,
  battle: Battle,
  threat: ThreatAssessment,
  rng: SeededRNG
): void {
  const myHpPct = pokemon.currentHp / pokemon.maxHp * 100;
  const theirHpPct = opponent.currentHp / opponent.maxHp * 100;
  const pIdx = battle.state.players[0].team.includes(pokemon) ? 0 : 1;

  for (const entry of scores) {
    if (entry.score <= 50) continue;
    const move = pokemon.moves[entry.moveIndex];
    const moveData = move.data;

    // === HEALING MOVES ===
    if (isHealingMove(moveData)) {
      if (myHpPct > 70) entry.score -= 3;
      else if (myHpPct < 30) entry.score += 3;
      else if (myHpPct < 50) entry.score += 1;

      if (moveData.name === 'Rest') {
        if (pokemon.status === 'toxic') entry.score += 2;
      }
    }

    // === SETUP / STAT BOOST MOVES ===
    if (isSetupMove(moveData)) {
      if (myHpPct >= 80 && !threat.canTheyKO) {
        entry.score += 2;
      } else if (myHpPct < 50 || threat.canTheyKO) {
        entry.score -= 2;
      }

      const boosts = moveData.selfBoosts || {};
      for (const [stat, stages] of Object.entries(boosts)) {
        const current = pokemon.boosts[stat as keyof typeof pokemon.boosts] ?? 0;
        if (current >= 4) entry.score -= 2;
        else if (current >= 2) entry.score -= 1;
      }

      if (hasPriorityMove(pokemon) && myHpPct > 50) {
        entry.score += 1;
      }
    }

    // === SCREEN MOVES ===
    if (moveData.name === 'Reflect' || moveData.name === 'Light Screen' || moveData.name === 'Aurora Veil') {
      if (myHpPct > 50) entry.score += 1;
      if (myHpPct <= 30) entry.score -= 2;
    }

    // === STATUS MOVES ===
    if (moveData.status && moveData.category === 'Status') {
      if (moveData.status === 'paralysis') {
        if (!threat.iGoFirst) entry.score += 2;
        if (threat.iGoFirst) entry.score -= 1;
      }
      if (moveData.status === 'burn') {
        if (isPhysicalAttacker(opponent)) entry.score += 2;
        if (isSpecialAttacker(opponent)) entry.score -= 1;
      }
      if (moveData.status === 'toxic') {
        if (theirHpPct > 70) entry.score += 1;
        if (theirHpPct < 30) entry.score -= 3;
      }
      if (moveData.status === 'sleep') {
        if (theirHpPct < 25) entry.score -= 2;
      }
    }

    // === HAZARD MOVES ===
    if (isHazardMove(moveData)) {
      const oppIdx = pIdx === 0 ? 1 : 0;
      const opponentAlive = countAliveTeammates(battle, oppIdx) + 1;
      if (opponentAlive >= 3) entry.score += 2;
      if (opponentAlive === 1) entry.score -= 3;
    }

    // === PROTECT ===
    if (moveData.name === 'Protect' || moveData.name === 'Detect') {
      if (opponent.status === 'toxic' || opponent.status === 'poison') entry.score += 1;
      if (battle.state.turn <= 1) entry.score -= 2;
    }

    // === U-TURN / VOLT SWITCH ===
    if (moveData.selfSwitch && moveData.category !== 'Status') {
      if (entry.effectiveness < 1) entry.score += 2;
      if (myHpPct > 60) entry.score += 1;
    }

    // === BATON PASS ===
    if (moveData.name === 'Baton Pass') {
      const totalBoosts = Object.values(pokemon.boosts).reduce(
        (sum, v) => sum + Math.max(0, v), 0
      );
      if (totalBoosts >= 4) entry.score += 3;
      else if (totalBoosts >= 2) entry.score += 2;
      else entry.score -= 2;
      if (countAliveTeammates(battle, pIdx) === 0) entry.score -= 10;
    }

    // === EXPLOSION / SELF-DESTRUCT (viability layer) ===
    if (moveData.selfdestruct) {
      if (myHpPct > 80 && !threat.canTheyKO) entry.score -= 3;
      if (myHpPct < 30) entry.score += 1;
    }

    // === SUPER EFFECTIVE BONUS ===
    if (entry.effectiveness >= 2) entry.score += 1;
    if (entry.effectiveness >= 4) entry.score += 1;
  }
}

function isHealingMove(move: { name: string; effects?: Array<{ type: string; target?: string }> }): boolean {
  return ['Recover', 'Roost', 'Soft-Boiled', 'Moonlight', 'Morning Sun',
          'Synthesis', 'Slack Off', 'Milk Drink', 'Rest', 'Shore Up',
          'Strength Sap'].includes(move.name)
    || !!move.effects?.some(e => e.type === 'heal' && e.target === 'self');
}

function isSetupMove(move: { selfBoosts?: Record<string, number> | null }): boolean {
  return !!move.selfBoosts && Object.values(move.selfBoosts).some(v => v > 0);
}

function isHazardMove(move: { name: string }): boolean {
  return ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'].includes(move.name);
}

function hasPriorityMove(pokemon: BattlePokemon): boolean {
  return pokemon.moves.some(m => m.data.priority > 0 && m.data.category !== 'Status');
}

function isPhysicalAttacker(pokemon: BattlePokemon): boolean {
  return pokemon.stats.atk > pokemon.stats.spa;
}

function isSpecialAttacker(pokemon: BattlePokemon): boolean {
  return pokemon.stats.spa > pokemon.stats.atk;
}
