import { BattlePokemon, MoveData, Weather, PokemonType, DamageCalcResult } from '../types';
import { getTypeEffectiveness } from '../data/type-chart';
import { getStatStageMultiplier } from '../utils/stats';
import { SeededRNG } from '../utils/rng';

/**
 * Core damage calculator implementing the Gen 4+ damage formula:
 * ((2*Level/5+2) * Power * A/D) / 50 + 2) * Modifier
 */
export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: MoveData,
  weather: Weather,
  rng: SeededRNG,
  isCritical: boolean,
  additionalModifiers?: { attackMod?: number; defenseMod?: number; powerMod?: number; finalMod?: number },
  defenderTypes?: PokemonType[]
): DamageCalcResult {
  const level = attacker.level;
  let basePower = move.power ?? getVariablePower(move, attacker, defender, weather);

  if (basePower === 0) {
    return zeroDamageResult();
  }

  // Fixed-damage moves (Seismic Toss, Night Shade, Super Fang, Dragon Rage, etc.)
  // Sentinel -1 = user's level, -2 = 50% target HP, -3..-N = fixed amount (abs value)
  if (basePower < 0) {
    let fixedDmg: number;
    if (basePower === -1) {
      fixedDmg = level; // Seismic Toss, Night Shade
    } else if (basePower === -2) {
      fixedDmg = Math.max(1, Math.floor(defender.currentHp / 2)); // Super Fang
    } else {
      fixedDmg = Math.abs(basePower); // Dragon Rage (-40), Sonic Boom (-20)
    }
    return {
      damage: fixedDmg,
      basePower: 0,
      attackStat: 0,
      defenseStat: 0,
      stab: false,
      typeEffectiveness: 1,
      weatherModifier: 1,
      abilityModifier: 1,
      itemModifier: 1,
      criticalHit: false,
      randomFactor: 1,
      finalDamage: fixedDmg,
    };
  }

  // Determine attacking and defending stats
  const isPhysical = move.category === 'Physical';
  let attackStatName: 'atk' | 'spa' | 'def' = isPhysical ? 'atk' : 'spa';
  let defenseStatName: 'def' | 'spd' = isPhysical ? 'def' : 'spd';

  // Body Press: uses attacker's Defense stat instead of Attack
  if (move.name === 'Body Press') {
    attackStatName = 'def';
  }
  // Psyshock, Psystrike, Secret Sword: special moves that target physical Defense
  if (['Psyshock', 'Psystrike', 'Secret Sword'].includes(move.name)) {
    defenseStatName = 'def';
  }

  let attackStat = attacker.stats[attackStatName];
  let defenseStat = defender.stats[defenseStatName];

  // Apply stat stage boosts
  let attackBoost = attacker.boosts[attackStatName];
  let defenseBoost = defender.boosts[defenseStatName];

  // Critical hits: ignore negative attack boosts and positive defense boosts
  if (isCritical) {
    if (attackBoost < 0) attackBoost = 0;
    if (defenseBoost > 0) defenseBoost = 0;
  }

  attackStat = Math.floor(attackStat * getStatStageMultiplier(attackBoost));
  defenseStat = Math.floor(defenseStat * getStatStageMultiplier(defenseBoost));

  // Apply additional modifiers (abilities, items that modify stats)
  if (additionalModifiers?.attackMod) {
    attackStat = Math.floor(attackStat * additionalModifiers.attackMod);
  }
  if (additionalModifiers?.defenseMod) {
    defenseStat = Math.floor(defenseStat * additionalModifiers.defenseMod);
  }
  if (additionalModifiers?.powerMod) {
    basePower = Math.floor(basePower * additionalModifiers.powerMod);
  }

  // Ensure minimum values
  attackStat = Math.max(1, attackStat);
  defenseStat = Math.max(1, defenseStat);
  basePower = Math.max(1, basePower);

  // Core damage formula
  let damage = Math.floor(
    Math.floor(
      (Math.floor((2 * level) / 5 + 2) * basePower * attackStat) / defenseStat
    ) / 50 + 2
  );

  // --- Modifier chain ---
  let totalModifier = 1;

  // Weather modifier
  const weatherMod = getWeatherModifier(move.type, weather);

  // STAB
  const stab = isSTAB(attacker, move.type);
  const stabMod = stab ? 1.5 : 1;

  // Type effectiveness
  let typeEff = getTypeEffectiveness(move.type, defenderTypes ?? defender.species.types as PokemonType[]);
  // Freeze-Dry: always super effective against Water types
  if (move.name === 'Freeze-Dry') {
    const dTypes = defenderTypes ?? defender.species.types as PokemonType[];
    if (dTypes.includes('Water' as PokemonType)) {
      // Recalculate: treat Water as 2x weakness, keep other type interactions
      const nonWaterTypes = dTypes.filter(t => t !== 'Water') as PokemonType[];
      const otherEff = nonWaterTypes.length > 0 ? getTypeEffectiveness(move.type, nonWaterTypes) : 1;
      typeEff = otherEff * 2; // Water always 2x
    }
  }

  // Critical hit (1.5x in Gen 6+)
  const critMod = isCritical ? 1.5 : 1;

  // Random factor (85-100%)
  const randomFactor = rng.damageRoll();

  // Burn halves physical damage (unless Guts)
  let burnMod = 1;
  if (attacker.status === 'burn' && isPhysical && attacker.ability !== 'Guts') {
    burnMod = 0.5;
  }

  // Apply modifiers in order
  // Targets (singles = 1.0)
  damage = Math.floor(damage * weatherMod);
  damage = Math.floor(damage * critMod);
  damage = Math.floor(damage * randomFactor);
  damage = Math.floor(damage * stabMod);
  damage = Math.floor(damage * typeEff);
  damage = Math.floor(damage * burnMod);

  // Additional final modifier (from abilities/items)
  if (additionalModifiers?.finalMod) {
    damage = Math.floor(damage * additionalModifiers.finalMod);
  }

  // Minimum 1 damage if the move can hit (effectiveness > 0)
  if (typeEff > 0 && damage < 1) {
    damage = 1;
  }

  return {
    damage,
    basePower,
    attackStat,
    defenseStat,
    stab,
    typeEffectiveness: typeEff,
    weatherModifier: weatherMod,
    abilityModifier: additionalModifiers?.attackMod || 1,
    itemModifier: additionalModifiers?.finalMod || 1,
    criticalHit: isCritical,
    randomFactor,
    finalDamage: damage,
  };
}

/**
 * Roll for critical hit. Returns true if crit.
 * Stage 0: 1/24, Stage 1: 1/8, Stage 2: 1/2, Stage 3+: always
 */
export function rollCritical(rng: SeededRNG, critStage: number): boolean {
  const stage = Math.min(critStage, 3);
  switch (stage) {
    case 0: return rng.int(1, 24) === 1;
    case 1: return rng.int(1, 8) === 1;
    case 2: return rng.int(1, 2) === 1;
    default: return true; // Stage 3+
  }
}

/**
 * Check accuracy. Returns true if the move hits.
 */
export function rollAccuracy(
  rng: SeededRNG,
  moveAccuracy: number | null,
  attackerAccuracyStage: number,
  defenderEvasionStage: number,
  options?: { moveName?: string; weather?: string; attackerAbility?: string }
): boolean {
  // Null accuracy = never misses
  if (moveAccuracy === null) return true;

  // Thunder always hits in rain, 50% accuracy in sun
  if (options?.moveName === 'Thunder' || options?.moveName === 'Hurricane') {
    if (options?.weather === 'rain') return true;
    if (options?.weather === 'sun') moveAccuracy = 50;
  }
  // Blizzard always hits in hail
  if (options?.moveName === 'Blizzard' && options?.weather === 'hail') return true;

  // Compound Eyes: 1.3x accuracy
  if (options?.attackerAbility === 'Compound Eyes') {
    moveAccuracy = Math.floor(moveAccuracy * 1.3);
  }

  // Net accuracy stage
  const netStage = Math.max(-6, Math.min(6, attackerAccuracyStage - defenderEvasionStage));
  let accuracyMod: number;
  if (netStage >= 0) {
    accuracyMod = (3 + netStage) / 3;
  } else {
    accuracyMod = 3 / (3 - netStage);
  }

  const finalAccuracy = Math.floor(moveAccuracy * accuracyMod);
  return rng.int(1, 100) <= finalAccuracy;
}

function isSTAB(pokemon: BattlePokemon, moveType: PokemonType): boolean {
  return pokemon.species.types.includes(moveType);
}

function getWeatherModifier(moveType: PokemonType, weather: Weather): number {
  if (weather === 'rain') {
    if (moveType === 'Water') return 1.5;
    if (moveType === 'Fire') return 0.5;
  }
  if (weather === 'sun') {
    if (moveType === 'Fire') return 1.5;
    if (moveType === 'Water') return 0.5;
  }
  return 1;
}

/**
 * Calculate base power for variable-power moves (Heavy Slam, Low Kick, Gyro Ball, etc.)
 */
function getVariablePower(move: MoveData, attacker: BattlePokemon, defender: BattlePokemon, weather?: Weather): number {
  const moveId = move.name.toLowerCase().replace(/[^a-z0-9]/g, '');

  switch (moveId) {
    // Power based on user weight / target weight ratio
    case 'heavyslam':
    case 'heatcrash': {
      const ratio = (attacker.species.weightkg || 1) / (defender.species.weightkg || 1);
      if (ratio >= 5) return 120;
      if (ratio >= 4) return 100;
      if (ratio >= 3) return 80;
      if (ratio >= 2) return 60;
      return 40;
    }

    // Power based on target's weight
    case 'lowkick':
    case 'grassknot': {
      const weight = defender.species.weightkg || 1;
      if (weight >= 200) return 120;
      if (weight >= 100) return 100;
      if (weight >= 50) return 80;
      if (weight >= 25) return 60;
      if (weight >= 10) return 40;
      return 20;
    }

    // Power based on target speed / user speed (capped at 150)
    case 'gyroball': {
      const userSpeed = Math.max(1, attacker.stats.spe * getStatStageMultiplier(attacker.boosts.spe));
      const targetSpeed = Math.max(1, defender.stats.spe * getStatStageMultiplier(defender.boosts.spe));
      return Math.min(150, Math.floor(25 * targetSpeed / userSpeed) + 1);
    }

    // Power based on user speed / target speed (capped at 150)
    case 'electroball': {
      const userSpeed = Math.max(1, attacker.stats.spe * getStatStageMultiplier(attacker.boosts.spe));
      const targetSpeed = Math.max(1, defender.stats.spe * getStatStageMultiplier(defender.boosts.spe));
      const ratio = userSpeed / targetSpeed;
      if (ratio >= 4) return 150;
      if (ratio >= 3) return 120;
      if (ratio >= 2) return 80;
      if (ratio >= 1) return 60;
      return 40;
    }

    // Facade: doubles if burned, paralyzed, or poisoned
    case 'facade': {
      return attacker.status ? 140 : 70;
    }

    // Flail / Reversal: power based on remaining HP %
    case 'flail':
    case 'reversal': {
      const ratio = Math.floor((attacker.currentHp * 48) / attacker.maxHp);
      if (ratio <= 1) return 200;
      if (ratio <= 4) return 150;
      if (ratio <= 9) return 100;
      if (ratio <= 16) return 80;
      if (ratio <= 32) return 40;
      return 20;
    }

    // Seismic Toss / Night Shade: damage = user's level (handled as fixed damage)
    case 'seismictoss':
    case 'nightshade': {
      return -1; // Sentinel: level-based fixed damage
    }

    // Super Fang: 50% of target's current HP
    case 'superfang': {
      return -2; // Sentinel: half target HP
    }

    // Dragon Rage: fixed 40 damage
    case 'dragonrage': {
      return -40; // Sentinel: fixed damage (abs value)
    }

    // Sonic Boom: fixed 20 damage
    case 'sonicboom': {
      return -20; // Sentinel: fixed damage (abs value)
    }

    // Final Gambit: damage = user's current HP (user faints after)
    case 'finalgambit': {
      return -(attacker.currentHp); // Sentinel: fixed damage
    }

    // Endeavor: reduce target HP to user's HP
    case 'endeavor': {
      const diff = defender.currentHp - attacker.currentHp;
      return diff > 0 ? -diff : -1; // min 1 damage sentinel
    }

    // OHKO moves: instant KO (damage = target's current HP)
    case 'fissure':
    case 'horndrill':
    case 'guillotine':
    case 'sheercold': {
      return -(defender.currentHp); // Sentinel: KO damage
    }

    // Counter: return 2x physical damage taken
    case 'counter': {
      return attacker.lastDamageTaken && attacker.lastDamageTaken.physical
        ? -(attacker.lastDamageTaken.amount * 2)
        : 0; // fail if no physical hit
    }

    // Mirror Coat: return 2x special damage taken
    case 'mirrorcoat': {
      return attacker.lastDamageTaken && !attacker.lastDamageTaken.physical
        ? -(attacker.lastDamageTaken.amount * 2)
        : 0; // fail if no special hit
    }

    // Rage Fist: 50 + 50 per time user was hit (max 350)
    case 'ragefist': {
      return Math.min(350, 50 + 50 * attacker.timesHit);
    }

    // Stored Power / Power Trip: 20 + 20 per positive boost
    case 'storedpower':
    case 'powertrip': {
      let boostTotal = 0;
      for (const stat of ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'] as const) {
        const b = attacker.boosts[stat];
        if (b > 0) boostTotal += b;
      }
      return 20 + 20 * boostTotal;
    }

    // Weather Ball: 50 normally, 100 in weather
    case 'weatherball': {
      return weather ? 100 : 50;
    }

    default:
      return 0;
  }
}

function zeroDamageResult(): DamageCalcResult {
  return {
    damage: 0,
    basePower: 0,
    attackStat: 0,
    defenseStat: 0,
    stab: false,
    typeEffectiveness: 0,
    weatherModifier: 1,
    abilityModifier: 1,
    itemModifier: 1,
    criticalHit: false,
    randomFactor: 1,
    finalDamage: 0,
  };
}
