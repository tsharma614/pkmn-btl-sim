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

  // Results
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  BATTLE RESULTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Winner: ${battle.state.winner === 'p1' ? name1 : name2}`);
  console.log(`  Turns: ${battle.state.turn}`);
  console.log(`  Seed: ${rng.seed}`);
  console.log(`\n  ${name1}'s team:`);
  console.log(formatTeam(player1.team));
  console.log(`\n  ${name2}'s team:`);
  console.log(formatTeam(player2.team));
  console.log(`${'='.repeat(60)}\n`);

  // Log stats
  const logJSON = battle.logger.exportJSON();
  const logSize = (logJSON.length / 1024).toFixed(1);
  console.log(`Battle log: ${logSize} KB`);
}

// Run
const seed = process.argv[2] ? parseInt(process.argv[2]) : undefined;
runBattle(seed);
