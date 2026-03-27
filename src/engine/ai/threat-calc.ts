import { Battle } from '../battle';
import { getTypeEffectiveness } from '../../data/type-chart';
import type { BattlePokemon, PokemonType, MoveData } from '../../types';
import { ThreatAssessment } from './types';

export function assessThreat(
  battle: Battle,
  playerIndex: number,
  opponentIndex: number
): ThreatAssessment {
  const pokemon = battle.getActivePokemon(playerIndex);
  const opponent = battle.getActivePokemon(opponentIndex);

  let myBestDamage = 0;
  let myBestDamagePercent = 0;
  for (const move of pokemon.moves) {
    if (move.data.category === 'Status' || move.currentPp <= 0) continue;
    const result = estimateDamage(pokemon, opponent, move.data, battle);
    const pct = opponent.maxHp > 0 ? (result / opponent.maxHp * 100) : 0;
    if (pct > myBestDamagePercent) {
      myBestDamage = result;
      myBestDamagePercent = pct;
    }
  }

  let theirBestDamage = 0;
  let theirBestDamagePercent = 0;
  for (const move of opponent.moves) {
    if (move.data.category === 'Status' || move.currentPp <= 0) continue;
    const result = estimateDamage(opponent, pokemon, move.data, battle);
    const pct = pokemon.maxHp > 0 ? (result / pokemon.maxHp * 100) : 0;
    if (pct > theirBestDamagePercent) {
      theirBestDamage = result;
      theirBestDamagePercent = pct;
    }
  }

  const canIKO = myBestDamage >= opponent.currentHp;
  const canTheyKO = theirBestDamage >= pokemon.currentHp;
  const iGoFirst = getEffectiveSpeed(pokemon, battle) > getEffectiveSpeed(opponent, battle);

  const turnsToKO = myBestDamage > 0
    ? Math.ceil(opponent.currentHp / myBestDamage)
    : 999;
  const turnsToBeKOd = theirBestDamage > 0
    ? Math.ceil(pokemon.currentHp / theirBestDamage)
    : 999;

  return {
    canIKO,
    canTheyKO,
    iGoFirst,
    myBestDamagePercent,
    theirBestDamagePercent,
    turnsToKO,
    turnsToBeKOd,
  };
}

export function estimateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: MoveData,
  battle: Battle
): number {
  const effectiveness = getTypeEffectiveness(
    move.type as PokemonType,
    defender.species.types as PokemonType[]
  );
  if (effectiveness === 0) return 0;

  const power = move.power ?? 0;
  if (power <= 0) return 0;

  const isPhysical = move.category === 'Physical';
  const atkStat = isPhysical ? attacker.stats.atk : attacker.stats.spa;
  const defStat = isPhysical ? defender.stats.def : defender.stats.spd;

  // Apply stat boosts
  const atkBoost = attacker.boosts[isPhysical ? 'atk' : 'spa'] ?? 0;
  const defBoost = defender.boosts[isPhysical ? 'def' : 'spd'] ?? 0;
  const atkMul = atkBoost >= 0 ? (2 + atkBoost) / 2 : 2 / (2 - atkBoost);
  const defMul = defBoost >= 0 ? (2 + defBoost) / 2 : 2 / (2 - defBoost);

  const effectiveAtk = atkStat * atkMul;
  const effectiveDef = defStat * defMul;

  const stab = attacker.species.types.includes(move.type as PokemonType) ? 1.5 : 1;
  const baseDamage = ((22 * power * effectiveAtk / effectiveDef) / 50 + 2);

  // Burn halves physical damage
  const burnMod = (attacker.status === 'burn' && isPhysical) ? 0.5 : 1;

  return Math.floor(baseDamage * stab * effectiveness * 0.925 * burnMod);
}

export function getEffectiveSpeed(pokemon: BattlePokemon, battle: Battle): number {
  let speed = pokemon.stats.spe;

  // Stat boosts
  const spdBoost = pokemon.boosts.spe ?? 0;
  const mul = spdBoost >= 0 ? (2 + spdBoost) / 2 : 2 / (2 - spdBoost);
  speed = Math.floor(speed * mul);

  if (pokemon.status === 'paralysis') speed = Math.floor(speed * 0.5);

  // Choice Scarf
  if (pokemon.item === 'Choice Scarf') speed = Math.floor(speed * 1.5);

  // Trick Room inverts
  if (battle.state.trickRoom > 0) speed = -speed;

  return speed;
}
