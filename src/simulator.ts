/**
 * Bot vs Bot battle simulator — runs a full battle in the terminal.
 * Usage: npx tsx src/simulator.ts [seed]
 */

import { Battle } from './engine/battle';
import { generateTeam } from './engine/team-generator';
import { chooseBotAction, pickCpuName } from './engine/bot';
import { SeededRNG } from './utils/rng';
import { Player, BattleEvent } from './types';

function formatHp(pokemon: { currentHp: number; maxHp: number }): string {
  const pct = Math.round((pokemon.currentHp / pokemon.maxHp) * 100);
  return `${pokemon.currentHp}/${pokemon.maxHp} (${pct}%)`;
}

function formatTeam(team: { species: { name: string }; currentHp: number; maxHp: number; isAlive: boolean }[]): string {
  return team.map(p => {
    const status = p.isAlive ? `${Math.round((p.currentHp / p.maxHp) * 100)}%` : 'FAINTED';
    return `  ${p.species.name}: ${status}`;
  }).join('\n');
}

function printEvent(event: BattleEvent): void {
  const d = event.data;
  switch (event.type) {
    case 'use_move':
      console.log(`  ${d.pokemon} used ${d.move}!`);
      break;
    case 'damage':
      console.log(`    ${d.defender} took ${d.damage} damage! (${d.remainingHp}/${d.maxHp} HP)`);
      if (d.isCritical) console.log('    A critical hit!');
      break;
    case 'super_effective':
      console.log("    It's super effective!");
      break;
    case 'not_very_effective':
      console.log("    It's not very effective...");
      break;
    case 'immune':
      console.log(`    ${d.target} is immune! (${d.reason})`);
      break;
    case 'miss':
      console.log(`    ${d.pokemon}'s ${d.move} missed!`);
      break;
    case 'faint':
      console.log(`    ${d.pokemon} fainted!`);
      break;
    case 'switch':
      console.log(`  ${d.from} was switched out for ${d.to}!`);
      break;
    case 'send_out':
      console.log(`  Go, ${d.pokemon}!`);
      break;
    case 'status':
      console.log(`    ${d.pokemon} was ${statusText(d.status as string)}!`);
      break;
    case 'status_damage':
      console.log(`    ${d.pokemon} took ${d.damage} damage from ${d.status}!`);
      break;
    case 'status_cure':
      console.log(`    ${d.pokemon} recovered from ${d.status}!`);
      break;
    case 'cant_move':
      console.log(`    ${d.pokemon} can't move (${d.reason})!`);
      break;
    case 'boost':
      console.log(`    ${d.pokemon}'s ${d.stat} ${(d.stages as number) > 0 ? 'rose' : 'fell'}${Math.abs(d.stages as number) > 1 ? ' sharply' : ''}!`);
      break;
    case 'weather':
      console.log(`    The weather changed to ${d.weather}!`);
      break;
    case 'weather_damage':
      console.log(`    ${d.pokemon} took ${d.damage} damage from ${d.weather}!`);
      break;
    case 'weather_end':
      console.log(`    The ${d.weather} subsided.`);
      break;
    case 'hazard_set':
      console.log(`    ${d.hazard} was set!`);
      break;
    case 'hazard_damage':
      console.log(`    ${d.pokemon} took ${d.damage} damage from ${d.hazard}!`);
      break;
    case 'recoil':
      console.log(`    ${d.pokemon} took ${d.damage} recoil damage!`);
      break;
    case 'drain':
      console.log(`    ${d.pokemon} drained ${d.amount} HP!`);
      break;
    case 'item_heal':
      console.log(`    ${d.pokemon} restored HP with ${d.item}!`);
      break;
    case 'item_damage':
      console.log(`    ${d.pokemon} took ${d.damage} damage from ${d.item}!`);
      break;
    case 'ability_trigger':
      console.log(`    ${d.pokemon}'s ${d.ability} activated!`);
      break;
    case 'ability_heal':
      console.log(`    ${d.pokemon} healed ${d.amount} HP from ${d.ability}!`);
      break;
    case 'ability_damage':
      console.log(`    ${d.pokemon} took ${d.damage} damage from ${d.ability}!`);
      break;
    case 'multi_hit':
      console.log(`    Hit ${d.hits} times for ${d.totalDamage} total damage!`);
      break;
    case 'confusion_self_hit':
      console.log(`    ${d.pokemon} hurt itself in confusion for ${d.damage} damage!`);
      break;
    case 'protect':
      console.log(`    ${d.pokemon} protected itself!`);
      break;
    case 'protected':
      console.log(`    ${d.pokemon} protected itself!`);
      break;
    case 'substitute':
      console.log(`    ${d.pokemon} put up a Substitute!`);
      break;
    case 'move_fail':
      console.log(`    But it failed! (${d.reason})`);
      break;
    case 'battle_end':
      console.log(`\n  Battle ended! Winner: ${d.winner} (${d.reason})`);
      break;
  }
}

function statusText(status: string): string {
  switch (status) {
    case 'brn': case 'burn': return 'burned';
    case 'par': case 'paralysis': return 'paralyzed';
    case 'slp': case 'sleep': return 'put to sleep';
    case 'psn': case 'poison': return 'poisoned';
    case 'tox': case 'toxic': return 'badly poisoned';
    case 'frz': case 'freeze': return 'frozen';
    default: return status;
  }
}

function runBattle(seed?: number): void {
  const rng = new SeededRNG(seed);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  POKÉMON BATTLE SIMULATOR`);
  console.log(`  RNG Seed: ${rng.seed}`);
  console.log(`${'='.repeat(60)}\n`);

  // Pick names
  const name1 = pickCpuName(rng);
  const name2 = pickCpuName(rng, name1);

  // Generate teams
  console.log('Generating teams...\n');
  const team1 = generateTeam(rng, { itemMode: 'competitive' });
  const team2 = generateTeam(rng, { itemMode: 'competitive' });

  const player1: Player = {
    id: 'p1',
    name: name1,
    team: team1,
    activePokemonIndex: 0,
    itemMode: 'competitive',
    hasMegaEvolved: false,
  };

  const player2: Player = {
    id: 'p2',
    name: name2,
    team: team2,
    activePokemonIndex: 0,
    itemMode: 'competitive',
    hasMegaEvolved: false,
  };

  console.log(`${name1}'s team:`);
  for (const p of team1) {
    console.log(`  ${p.species.name} (${p.species.types.join('/')}) [${p.ability}] @ ${p.item}`);
    console.log(`    Moves: ${p.moves.map(m => m.data.name).join(', ')}`);
    console.log(`    Stats: HP:${p.stats.hp} Atk:${p.stats.atk} Def:${p.stats.def} SpA:${p.stats.spa} SpD:${p.stats.spd} Spe:${p.stats.spe}`);
  }

  console.log(`\n${name2}'s team:`);
  for (const p of team2) {
    console.log(`  ${p.species.name} (${p.species.types.join('/')}) [${p.ability}] @ ${p.item}`);
    console.log(`    Moves: ${p.moves.map(m => m.data.name).join(', ')}`);
    console.log(`    Stats: HP:${p.stats.hp} Atk:${p.stats.atk} Def:${p.stats.def} SpA:${p.stats.spa} SpD:${p.stats.spd} Spe:${p.stats.spe}`);
  }

  // Create battle
  const battle = new Battle(player1, player2, rng.seed);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Battle Start!`);
  console.log(`  ${name1}'s ${battle.getActivePokemon(0).species.name} vs ${name2}'s ${battle.getActivePokemon(1).species.name}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Battle loop
  let turnCount = 0;
  const maxTurns = 100;

  while (battle.state.status === 'active' && turnCount < maxTurns) {
    turnCount++;
    console.log(`--- Turn ${turnCount} ---`);
    console.log(`  ${name1}: ${battle.getActivePokemon(0).species.name} ${formatHp(battle.getActivePokemon(0))}`);
    console.log(`  ${name2}: ${battle.getActivePokemon(1).species.name} ${formatHp(battle.getActivePokemon(1))}`);
    console.log('');

    const action1 = chooseBotAction(battle, 0, rng);
    const action2 = chooseBotAction(battle, 1, rng);

    const events = battle.processTurn(action1, action2);

    for (const event of events) {
      printEvent(event);
    }

    // Handle forced switches after faints
    for (let i = 0; i < 2; i++) {
      if (battle.needsSwitch(i)) {
        const switches = battle.getAvailableSwitches(i);
        if (switches.length > 0) {
          const switchIdx = rng.pick(switches);
          const switchEvents = battle.processForceSwitch(i, switchIdx);
          for (const event of switchEvents) {
            printEvent(event);
          }
        }
      }
    }

    console.log('');
  }

  // --- Compute MVP stats from battle log ---
  const allEvents = battle.state.log;
  interface PokemonStats {
    name: string;
    owner: string;
    kos: number;
    damageDealt: number;
    damageTaken: number;
    movesUsed: number;
    crits: number;
    superEffectiveHits: number;
    survived: boolean;
    remainingHpPct: number;
  }

  const statsMap: Record<string, PokemonStats> = {};

  const initStats = (name: string, owner: string) => {
    if (!statsMap[`${owner}:${name}`]) {
      statsMap[`${owner}:${name}`] = {
        name, owner, kos: 0, damageDealt: 0, damageTaken: 0,
        movesUsed: 0, crits: 0, superEffectiveHits: 0,
        survived: true, remainingHpPct: 100,
      };
    }
  };

  // Init all pokemon
  for (const p of player1.team) { initStats(p.species.name, name1); }
  for (const p of player2.team) { initStats(p.species.name, name2); }

  // Track last attacker for KO attribution
  let lastAttacker: string | null = null;
  let lastAttackerOwner: string | null = null;

  for (const ev of allEvents) {
    const d = ev.data;
    switch (ev.type) {
      case 'use_move': {
        // Figure out owner from which player's active matches
        const ownerName = findOwner(d.pokemon as string, player1, player2, name1, name2);
        initStats(d.pokemon as string, ownerName);
        statsMap[`${ownerName}:${d.pokemon}`].movesUsed++;
        lastAttacker = d.pokemon as string;
        lastAttackerOwner = ownerName;
        break;
      }
      case 'damage': {
        const atkOwner = findOwner(d.attacker as string, player1, player2, name1, name2);
        const defOwner = findOwner(d.defender as string, player1, player2, name1, name2);
        initStats(d.attacker as string, atkOwner);
        initStats(d.defender as string, defOwner);
        statsMap[`${atkOwner}:${d.attacker}`].damageDealt += d.damage as number;
        statsMap[`${defOwner}:${d.defender}`].damageTaken += d.damage as number;
        if (d.isCritical) statsMap[`${atkOwner}:${d.attacker}`].crits++;
        lastAttacker = d.attacker as string;
        lastAttackerOwner = atkOwner;
        break;
      }
      case 'super_effective': {
        if (lastAttacker && lastAttackerOwner) {
          statsMap[`${lastAttackerOwner}:${lastAttacker}`].superEffectiveHits++;
        }
        break;
      }
      case 'faint': {
        const faintOwner = findOwner(d.pokemon as string, player1, player2, name1, name2);
        initStats(d.pokemon as string, faintOwner);
        statsMap[`${faintOwner}:${d.pokemon}`].survived = false;
        statsMap[`${faintOwner}:${d.pokemon}`].remainingHpPct = 0;
        // Attribute KO to last attacker (if different team)
        if (lastAttacker && lastAttackerOwner && lastAttackerOwner !== faintOwner) {
          statsMap[`${lastAttackerOwner}:${lastAttacker}`].kos++;
        }
        break;
      }
    }
  }

  // Update surviving pokemon HP%
  for (const p of player1.team) {
    const key = `${name1}:${p.species.name}`;
    if (statsMap[key] && p.isAlive) {
      statsMap[key].remainingHpPct = Math.round((p.currentHp / p.maxHp) * 100);
    }
  }
  for (const p of player2.team) {
    const key = `${name2}:${p.species.name}`;
    if (statsMap[key] && p.isAlive) {
      statsMap[key].remainingHpPct = Math.round((p.currentHp / p.maxHp) * 100);
    }
  }

  // Calculate MVP score: KOs worth most, then damage, then survival
  const mvpScore = (s: PokemonStats) =>
    s.kos * 1000 + s.damageDealt + (s.survived ? 500 : 0) + s.remainingHpPct * 2;

  const allStats = Object.values(statsMap);
  const winnerName = battle.state.winner === 'p1' ? name1 : name2;
  const loserName = battle.state.winner === 'p1' ? name2 : name1;
  const winnerStats = allStats.filter(s => s.owner === winnerName).sort((a, b) => mvpScore(b) - mvpScore(a));
  const loserStats = allStats.filter(s => s.owner === loserName).sort((a, b) => mvpScore(b) - mvpScore(a));

  const mvp = winnerStats[0];
  const biggestHit = allEvents
    .filter(e => e.type === 'damage')
    .reduce((max, e) => (e.data.damage as number) > max.dmg
      ? { dmg: e.data.damage as number, atk: e.data.attacker as string, def: e.data.defender as string, move: e.data.move as string }
      : max, { dmg: 0, atk: '', def: '', move: '' });

  // --- Print Results ---
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  BATTLE RESULTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Winner: ${winnerName}`);
  console.log(`  Turns: ${battle.state.turn}`);
  console.log(`  Seed: ${rng.seed}`);
  console.log(`\n  ${name1}'s team:`);
  console.log(formatTeam(player1.team));
  console.log(`\n  ${name2}'s team:`);
  console.log(formatTeam(player2.team));

  // MVP section
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  >>> MVP: ${mvp.name} (${mvp.owner}) <<<`);
  console.log(`  KOs: ${mvp.kos} | Damage Dealt: ${mvp.damageDealt} | Survived: ${mvp.survived ? `Yes (${mvp.remainingHpPct}% HP)` : 'No'}`);
  console.log(`${'─'.repeat(60)}`);

  // Per-pokemon stats
  const printPokeStats = (stats: PokemonStats[]) => {
    for (const s of stats) {
      const status = s.survived ? `${s.remainingHpPct}%` : 'FAINTED';
      const koStr = s.kos > 0 ? `${s.kos} KO${s.kos > 1 ? 's' : ''}` : '0 KOs';
      console.log(`    ${s.name.padEnd(18)} ${status.padEnd(8)} ${koStr.padEnd(6)} DMG: ${String(s.damageDealt).padEnd(6)} Taken: ${String(s.damageTaken).padEnd(6)}${s.crits > 0 ? ` Crits: ${s.crits}` : ''}`);
    }
  };

  console.log(`\n  ${winnerName}'s Performance:`);
  printPokeStats(winnerStats);
  console.log(`\n  ${loserName}'s Performance:`);
  printPokeStats(loserStats);

  // Highlights
  console.log(`\n  Battle Highlights:`);
  console.log(`    Biggest Hit: ${biggestHit.atk}'s ${biggestHit.move} dealt ${biggestHit.dmg} to ${biggestHit.def}`);
  const totalKos = allStats.reduce((sum, s) => sum + s.kos, 0);
  const totalDmg = allStats.reduce((sum, s) => sum + s.damageDealt, 0);
  console.log(`    Total KOs: ${totalKos} | Total Damage: ${totalDmg}`);

  // Most damage dealt by a single pokemon
  const topDamageDealer = allStats.reduce((a, b) => a.damageDealt > b.damageDealt ? a : b);
  if (topDamageDealer.name !== mvp.name) {
    console.log(`    Damage Leader: ${topDamageDealer.name} dealt ${topDamageDealer.damageDealt} total damage`);
  }

  // Tank award: most damage taken while surviving
  const tanks = allStats.filter(s => s.survived && s.damageTaken > 0);
  if (tanks.length > 0) {
    const bestTank = tanks.reduce((a, b) => a.damageTaken > b.damageTaken ? a : b);
    console.log(`    Tank: ${bestTank.name} absorbed ${bestTank.damageTaken} damage and lived (${bestTank.remainingHpPct}% HP)`);
  }

  // Glass cannon: most damage dealt but fainted
  const glassCannons = allStats.filter(s => !s.survived && s.damageDealt > 200);
  if (glassCannons.length > 0) {
    const gc = glassCannons.reduce((a, b) => a.damageDealt > b.damageDealt ? a : b);
    console.log(`    Glass Cannon: ${gc.name} dealt ${gc.damageDealt} damage before going down`);
  }

  // Crit king
  const critKing = allStats.filter(s => s.crits > 0).sort((a, b) => b.crits - a.crits)[0];
  if (critKing && critKing.crits >= 2) {
    console.log(`    Crit King: ${critKing.name} landed ${critKing.crits} critical hits`);
  }

  // Sweep detection: any pokemon with 3+ KOs
  const sweepers = allStats.filter(s => s.kos >= 3);
  for (const s of sweepers) {
    console.log(`    Rampage: ${s.name} went on a tear with ${s.kos} KOs!`);
  }

  // Wall: pokemon that took the most damage overall
  const wall = allStats.reduce((a, b) => a.damageTaken > b.damageTaken ? a : b);
  if (wall.damageTaken > 300) {
    console.log(`    Punching Bag: ${wall.name} absorbed ${wall.damageTaken} total damage`);
  }

  // Clean sweep check: winner lost 0 pokemon
  const winnerFainted = winnerStats.filter(s => !s.survived).length;
  if (winnerFainted === 0) {
    console.log(`    Perfect Victory: ${winnerName} won without losing a single Pokemon!`);
  } else if (winnerFainted >= 5) {
    console.log(`    Clutch Victory: ${winnerName} won with only 1 Pokemon standing!`);
  }

  console.log(`${'='.repeat(60)}\n`);

  // Log stats
  const logJSON = battle.logger.exportJSON();
  const logSize = (logJSON.length / 1024).toFixed(1);
  console.log(`Battle log: ${logSize} KB`);
}

function findOwner(pokemonName: string, p1: Player, p2: Player, name1: string, name2: string): string {
  if (p1.team.some(p => p.species.name === pokemonName)) return name1;
  if (p2.team.some(p => p.species.name === pokemonName)) return name2;
  return name1; // fallback
}

// Run
const seed = process.argv[2] ? parseInt(process.argv[2]) : undefined;
runBattle(seed);
