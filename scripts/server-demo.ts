/**
 * Server demo: starts the PBS server, connects two bot clients,
 * and plays a full networked battle with formatted output.
 * Usage: npm run demo
 */

import { io as ioc } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  BattleStartPayload,
  TurnResultPayload,
  NeedsSwitchPayload,
  BattleEndPayload,
  OwnPokemon,
} from '../src/server/types';
import type { BattleEvent } from '../src/types';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

import { BOT_NAMES } from '../src/engine/bot';

// --- BotClient: wraps a socket with a unified event buffer ---

interface BotEventItem {
  event: string;
  data: any;
}

class BotClient {
  socket: ClientSocket;
  name: string;
  state: TurnResultPayload['yourState'] | null = null;
  playerIndex: 0 | 1 = 0;

  private buffer: BotEventItem[] = [];
  private waiter: ((item: BotEventItem) => void) | null = null;

  constructor(socket: ClientSocket, name: string) {
    this.socket = socket;
    this.name = name;
    const tracked = ['turn_result', 'needs_switch', 'battle_end', 'error'] as const;
    for (const event of tracked) {
      (socket as any).on(event, (data: any) => {
        if (this.waiter) {
          const resolve = this.waiter;
          this.waiter = null;
          resolve({ event, data });
        } else {
          this.buffer.push({ event, data });
        }
      });
    }
  }

  /** Wait for the next event in the buffer (or the next to arrive). */
  nextEvent(): Promise<BotEventItem> {
    if (this.buffer.length > 0) {
      return Promise.resolve(this.buffer.shift()!);
    }
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  /** Drain any stale events from the buffer, logging them. */
  drainStale(): void {
    while (this.buffer.length > 0) {
      const item = this.buffer.shift()!;
      console.log(`  [stale:${this.name}] ${item.event}`);
    }
  }
}

// --- Event printer (from simulator.ts) ---

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

// --- Action picker ---

function pickRandomAction(state: TurnResultPayload['yourState']): { type: 'move' | 'switch'; index: number } {
  const active = state.team[state.activePokemonIndex];

  const switches = state.team
    .map((p, i) => ({ alive: p.isAlive, idx: i }))
    .filter(s => s.idx !== state.activePokemonIndex && s.alive);

  // If choice-locked, only use the locked move (or switch if out of PP)
  if (active.choiceLocked) {
    const lockedIdx = active.moves.findIndex(m => m.name === active.choiceLocked);
    if (lockedIdx >= 0 && active.moves[lockedIdx].currentPp > 0) {
      return { type: 'move', index: lockedIdx };
    }
    // Out of PP on locked move → must switch
    if (switches.length > 0) {
      const pick = switches[Math.floor(Math.random() * switches.length)];
      return { type: 'switch', index: pick.idx };
    }
  }

  const usableMoves = active.moves
    .map((m, i) => ({ ...m, idx: i }))
    .filter(m => m.currentPp > 0 && !m.disabled);

  // 80% move, 20% switch (if both available)
  if (usableMoves.length > 0 && (switches.length === 0 || Math.random() < 0.8)) {
    const pick = usableMoves[Math.floor(Math.random() * usableMoves.length)];
    return { type: 'move', index: pick.idx };
  }

  if (switches.length > 0) {
    const pick = switches[Math.floor(Math.random() * switches.length)];
    return { type: 'switch', index: pick.idx };
  }

  // Struggle fallback
  return { type: 'move', index: 0 };
}

/** Wraps a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// --- Helpers ---

function pickTwoNames(): [string, string] {
  const i = Math.floor(Math.random() * BOT_NAMES.length);
  let j = Math.floor(Math.random() * (BOT_NAMES.length - 1));
  if (j >= i) j++;
  return [BOT_NAMES[i], BOT_NAMES[j]];
}

function waitForSocketEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    (socket as any).once(event, (data: T) => resolve(data));
  });
}

function printTeam(name: string, team: OwnPokemon[]): void {
  console.log(`${name}'s team:`);
  for (const p of team) {
    console.log(`  ${p.species.name} (${p.species.types.join('/')}) [${p.ability}] @ ${p.item || 'none'}`);
    console.log(`    Moves: ${p.moves.map(m => m.name).join(', ')}`);
  }
}

/**
 * Handle force-switch loop for a single bot.
 * Consumes needs_switch events, submits switches, until it gets
 * turn_result (switches resolved) or battle_end.
 */
async function handleBotForceSwitch(
  bot: BotClient,
  isPrinter: boolean,
): Promise<BattleEndPayload | null> {
  while (true) {
    const ev = await bot.nextEvent();
    if (ev.event === 'battle_end') return ev.data;
    if (ev.event === 'turn_result') {
      const data = ev.data as TurnResultPayload;
      if (isPrinter && data.events.length > 0) {
        for (const e of data.events) printEvent(e);
      }
      bot.state = data.yourState;
      return null;
    }
    if (ev.event === 'needs_switch') {
      const switchData = ev.data as NeedsSwitchPayload;
      const available = switchData.availableSwitches;
      const pick = available[Math.floor(Math.random() * available.length)];
      console.log(`  ${bot.name} sends out ${pick.pokemon.species.name}!`);
      bot.socket.emit('submit_force_switch', { pokemonIndex: pick.index });
      continue;
    }
    if (ev.event === 'error') {
      console.log(`  [error:${bot.name}] ${ev.data.message}`);
      continue;
    }
  }
}

// --- Main ---

async function main(): Promise<void> {
  // Safety timeout
  setTimeout(() => {
    console.error('\nDemo timed out after 2 minutes');
    process.exit(1);
  }, 120_000).unref();

  const [name1, name2] = pickTwoNames();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PBS SERVER DEMO — Networked Battle`);
  console.log(`${'='.repeat(60)}\n`);

  // Start the server (import triggers httpServer.listen)
  console.log('Starting server...');
  const { httpServer } = await import('../src/server/index');
  await new Promise<void>((resolve) => {
    if (httpServer.listening) resolve();
    else httpServer.once('listening', resolve);
  });
  const port = (httpServer.address() as { port: number }).port;
  const url = `http://localhost:${port}`;
  console.log(`Server ready on ${url}\n`);

  // Connect two bot clients
  const rawSocket1 = ioc(url) as unknown as ClientSocket;
  const rawSocket2 = ioc(url) as unknown as ClientSocket;
  const bot1 = new BotClient(rawSocket1, name1);
  const bot2 = new BotClient(rawSocket2, name2);

  await Promise.all([
    new Promise<void>((r) => rawSocket1.once('connect', r)),
    new Promise<void>((r) => rawSocket2.once('connect', r)),
  ]);
  console.log(`${name1} connected (bot 1)`);
  console.log(`${name2} connected (bot 2)\n`);

  // === ROOM SETUP ===

  const roomP = waitForSocketEvent<{ code: string }>(rawSocket1, 'room_created');
  rawSocket1.emit('create_room', { playerName: name1 });
  const { code } = await roomP;
  console.log(`${name1} created room: ${code}`);

  const oppP1 = waitForSocketEvent<{ name: string }>(rawSocket1, 'opponent_joined');
  const oppP2 = waitForSocketEvent<{ name: string }>(rawSocket2, 'opponent_joined');
  rawSocket2.emit('join_room', { code, playerName: name2 });
  await Promise.all([oppP1, oppP2]);
  console.log(`${name2} joined room: ${code}\n`);

  // === LEAD SELECTION ===

  const startP1 = waitForSocketEvent<BattleStartPayload>(rawSocket1, 'battle_start');
  const startP2 = waitForSocketEvent<BattleStartPayload>(rawSocket2, 'battle_start');
  rawSocket1.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
  rawSocket2.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
  const [start1, start2] = await Promise.all([startP1, startP2]);

  bot1.playerIndex = start1.yourPlayerIndex;
  bot2.playerIndex = start2.yourPlayerIndex;

  printTeam(name1, start1.yourTeam);
  console.log('');
  printTeam(name2, start2.yourTeam);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Battle Start!`);
  console.log(`  ${start1.yourTeam[0].species.name} vs ${start2.yourTeam[0].species.name}`);
  console.log(`${'─'.repeat(60)}\n`);

  // Initialize bot states from battle_start
  bot1.state = {
    team: start1.yourTeam,
    activePokemonIndex: 0,
    sideEffects: { stealthRock: false, spikesLayers: 0, toxicSpikesLayers: 0, reflect: 0, lightScreen: 0, tailwind: 0 },
  };
  bot2.state = {
    team: start2.yourTeam,
    activePokemonIndex: 0,
    sideEffects: { stealthRock: false, spikesLayers: 0, toxicSpikesLayers: 0, reflect: 0, lightScreen: 0, tailwind: 0 },
  };

  // === BATTLE LOOP ===

  let turnCount = 0;
  let endPayload: BattleEndPayload | null = null;

  while (turnCount < 100) {
    turnCount++;

    // Drain any stale events (shouldn't happen, but safety net)
    bot1.drainStale();
    bot2.drainStale();

    // Print turn header
    const a1 = bot1.state!.team[bot1.state!.activePokemonIndex];
    const a2 = bot2.state!.team[bot2.state!.activePokemonIndex];
    console.log(`--- Turn ${turnCount} ---`);
    console.log(`  ${name1}: ${a1.species.name} (${a1.currentHp}/${a1.maxHp} HP)`);
    console.log(`  ${name2}: ${a2.species.name} (${a2.currentHp}/${a2.maxHp} HP)`);
    console.log('');

    // Both bots pick and submit actions
    const action1 = pickRandomAction(bot1.state!);
    const action2 = pickRandomAction(bot2.state!);

    // Set up event waiters BEFORE submitting (avoids race)
    const ev1 = bot1.nextEvent();
    const ev2 = bot2.nextEvent();
    rawSocket1.emit('submit_action', action1);
    rawSocket2.emit('submit_action', action2);

    // Wait for first event from each bot (turn_result or battle_end), with timeout
    const [r1, r2] = await withTimeout(
      Promise.all([ev1, ev2]),
      15_000,
      `Turn ${turnCount}: timed out waiting for server response`,
    );

    // Check for battle end
    if (r1.event === 'battle_end' || r2.event === 'battle_end') {
      if (r1.event === 'turn_result') {
        for (const ev of (r1.data as TurnResultPayload).events) printEvent(ev);
      }
      if (r2.event === 'turn_result') {
        for (const ev of (r2.data as TurnResultPayload).events) printEvent(ev);
      }
      endPayload = r1.event === 'battle_end' ? r1.data : r2.data;
      break;
    }

    // Both should be turn_result — print events from bot1's perspective
    const turn1 = r1.data as TurnResultPayload;
    const turn2 = r2.data as TurnResultPayload;
    for (const ev of turn1.events) {
      printEvent(ev);
    }
    bot1.state = turn1.yourState;
    bot2.state = turn2.yourState;

    // Check for force switches by examining state (reliable, no race conditions)
    const bot1Dead = !bot1.state.team[bot1.state.activePokemonIndex].isAlive;
    const bot2Dead = !bot2.state.team[bot2.state.activePokemonIndex].isAlive;

    if (bot1Dead || bot2Dead) {
      // Handle force switches concurrently — both switching bots AND non-switching
      // bots need to consume the post-switch turn_result from the server
      const switchPromises: Promise<BattleEndPayload | null>[] = [];

      // Bot1: either handle switch loop, or wait for post-switch turn_result
      switchPromises.push(handleBotForceSwitch(bot1, true));

      // Bot2: same
      switchPromises.push(handleBotForceSwitch(bot2, false));

      const results = await Promise.all(switchPromises);
      endPayload = results.find(r => r !== null) ?? null;
      if (endPayload) break;
    }

    console.log('');
  }

  // === RESULTS ===

  if (endPayload) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  BATTLE RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Winner: ${endPayload.winner}`);
    console.log(`  Reason: ${endPayload.reason}`);
    console.log(`  Turns: ${endPayload.finalState.turn}`);

    console.log(`\n  ${name1}'s team:`);
    const team1 = bot1.playerIndex === 0 ? endPayload.finalState.yourTeam : endPayload.finalState.opponentTeam;
    const team2 = bot1.playerIndex === 0 ? endPayload.finalState.opponentTeam : endPayload.finalState.yourTeam;
    for (const p of team1) {
      const status = p.isAlive ? `${Math.round((p.currentHp / p.maxHp) * 100)}%` : 'FAINTED';
      console.log(`    ${p.species.name}: ${status}`);
    }
    console.log(`\n  ${name2}'s team:`);
    for (const p of team2) {
      const status = p.isAlive ? `${Math.round((p.currentHp / p.maxHp) * 100)}%` : 'FAINTED';
      console.log(`    ${p.species.name}: ${status}`);
    }
    console.log(`${'='.repeat(60)}\n`);
  } else {
    console.log('\n  Battle timed out after 100 turns.\n');
  }

  // Clean exit
  rawSocket1.disconnect();
  rawSocket2.disconnect();
  httpServer.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
