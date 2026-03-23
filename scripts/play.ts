/**
 * Interactive terminal client: Human vs Bot battle.
 * Usage: npm run play
 */

import * as readline from 'readline';
import { io as ioc } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  TeamPreviewPayload,
  BattleStartPayload,
  TurnResultPayload,
  NeedsSwitchPayload,
  BattleEndPayload,
  OwnPokemon,
} from '../src/server/types';
import type { BattleEvent } from '../src/types';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

import { BOT_NAMES } from '../src/engine/bot';

// --- Readline helper ---

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

// --- Event buffer (same pattern as server-demo) ---

interface EventItem {
  event: string;
  data: any;
}

class EventClient {
  socket: ClientSocket;
  name: string;
  state: TurnResultPayload['yourState'] | null = null;
  playerIndex: 0 | 1 = 0;
  opponentVisible: TurnResultPayload['opponentVisible'] | null = null;

  private buffer: EventItem[] = [];
  private waiter: ((item: EventItem) => void) | null = null;

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

  nextEvent(): Promise<EventItem> {
    if (this.buffer.length > 0) {
      return Promise.resolve(this.buffer.shift()!);
    }
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  drainStale(): void {
    while (this.buffer.length > 0) {
      this.buffer.shift();
    }
  }
}

// --- Event printer ---

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

// --- Bot action picker (from server-demo) ---

function pickRandomAction(state: TurnResultPayload['yourState']): { type: 'move' | 'switch'; index: number } {
  const active = state.team[state.activePokemonIndex];

  const switches = state.team
    .map((p, i) => ({ alive: p.isAlive, idx: i }))
    .filter(s => s.idx !== state.activePokemonIndex && s.alive);

  if (active.choiceLocked) {
    const lockedIdx = active.moves.findIndex(m => m.name === active.choiceLocked);
    if (lockedIdx >= 0 && active.moves[lockedIdx].currentPp > 0) {
      return { type: 'move', index: lockedIdx };
    }
    if (switches.length > 0) {
      const pick = switches[Math.floor(Math.random() * switches.length)];
      return { type: 'switch', index: pick.idx };
    }
  }

  const usableMoves = active.moves
    .map((m, i) => ({ ...m, idx: i }))
    .filter(m => m.currentPp > 0 && !m.disabled);

  if (usableMoves.length > 0 && (switches.length === 0 || Math.random() < 0.8)) {
    const pick = usableMoves[Math.floor(Math.random() * usableMoves.length)];
    return { type: 'move', index: pick.idx };
  }

  if (switches.length > 0) {
    const pick = switches[Math.floor(Math.random() * switches.length)];
    return { type: 'switch', index: pick.idx };
  }

  return { type: 'move', index: 0 };
}

// --- Display helpers ---

function hpBar(current: number, max: number, width = 10): string {
  const ratio = Math.max(0, current / max);
  const filled = Math.round(ratio * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}

function hpPercent(current: number, max: number): string {
  return `${Math.round((current / max) * 100)}%`;
}

function formatStatus(status: string | null): string {
  if (!status) return '';
  const map: Record<string, string> = {
    brn: 'BRN', burn: 'BRN',
    par: 'PAR', paralysis: 'PAR',
    slp: 'SLP', sleep: 'SLP',
    psn: 'PSN', poison: 'PSN',
    tox: 'TOX', toxic: 'TOX',
    frz: 'FRZ', freeze: 'FRZ',
  };
  return ` [${map[status] || status}]`;
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function padLeft(s: string, len: number): string {
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

function formatStat(label: string, value: number): string {
  return `${label}:${padLeft(String(value), 3)}`;
}

function printTeamPreview(team: OwnPokemon[]): void {
  console.log('\n  Your team:');
  for (let i = 0; i < team.length; i++) {
    const p = team[i];
    const types = p.species.types.join('/');
    const s = p.stats;
    const statLine = [
      formatStat('HP', p.maxHp),
      formatStat('Atk', s.atk),
      formatStat('Def', s.def),
      formatStat('SpA', s.spa),
      formatStat('SpD', s.spd),
      formatStat('Spe', s.spe),
    ].join('  ');
    console.log(`    ${i + 1}) ${padRight(p.species.name, 14)} ${padRight(types, 16)} [${p.ability}] @ ${p.item || 'none'}`);
    console.log(`       ${statLine}`);
    console.log(`       Moves: ${p.moves.map(m => m.name).join(', ')}`);
  }
}

function printTurnHeader(
  turnCount: number,
  humanActive: OwnPokemon,
  botName: string,
  opponentVisible: TurnResultPayload['opponentVisible'] | null,
  oppLeadName: string,
): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`--- Turn ${turnCount} ---`);

  // Human's active
  const hBar = hpBar(humanActive.currentHp, humanActive.maxHp);
  const hStatus = formatStatus(humanActive.status);
  console.log(`  You:  ${padRight(humanActive.species.name, 14)} ${hBar} ${humanActive.currentHp}/${humanActive.maxHp} HP${hStatus}`);

  // Opponent's active
  if (opponentVisible?.activePokemon) {
    const opp = opponentVisible.activePokemon;
    const oBar = hpBar(opp.currentHp, opp.maxHp);
    const oStatus = formatStatus(opp.status);
    console.log(`  ${padRight(botName + ':', 6)} ${padRight(opp.species.name, 14)} ${oBar} ${opp.currentHp}/${opp.maxHp} HP${oStatus}`);
  } else {
    console.log(`  ${padRight(botName + ':', 6)} ${padRight(oppLeadName, 14)} ${hpBar(1, 1)} 100%`);
  }
  console.log('');
}

function printMoveMenu(state: TurnResultPayload['yourState']): {
  choices: { label: string; action: { type: 'move' | 'switch'; index: number } }[];
  autoAction: { type: 'move' | 'switch'; index: number } | null;
} {
  const active = state.team[state.activePokemonIndex];
  const choices: { label: string; action: { type: 'move' | 'switch'; index: number } }[] = [];
  let num = 1;

  // Check which moves are usable
  const usableMoves = active.moves
    .map((m, i) => ({ move: m, idx: i }))
    .filter(({ move }) => move.currentPp > 0 && !move.disabled && !(active.choiceLocked && move.name !== active.choiceLocked));

  const switches = state.team
    .map((p, i) => ({ pokemon: p, idx: i }))
    .filter(s => s.idx !== state.activePokemonIndex && s.pokemon.isAlive);

  // No usable moves and no switches → Struggle
  if (usableMoves.length === 0 && switches.length === 0) {
    console.log('  No moves left! Using Struggle...');
    return { choices: [], autoAction: { type: 'move', index: 0 } };
  }

  // Moves section
  if (usableMoves.length > 0) {
    console.log('  Moves:');
    for (let i = 0; i < active.moves.length; i++) {
      const m = active.moves[i];
      const disabled = m.currentPp <= 0 || m.disabled;
      const choiceLocked = active.choiceLocked && m.name !== active.choiceLocked;
      if (disabled || choiceLocked) {
        console.log(`    ${num}) ${padRight(m.name, 16)} (unavailable)`);
        choices.push({ label: '', action: { type: 'move', index: i } });
      } else {
        const cat = m.category.charAt(0).toUpperCase() + m.category.slice(1);
        const powStr = m.power ? `Pow: ${padLeft(String(m.power), 3)}` : (m.category.toLowerCase() !== 'status' ? 'Pow: var.' : '');
        console.log(`    ${num}) ${padRight(m.name, 16)} (${m.type}/${cat})   PP: ${padLeft(String(m.currentPp), 2)}/${padLeft(String(m.maxPp), 2)}  ${powStr}`);
        choices.push({ label: m.name, action: { type: 'move', index: i } });
      }
      num++;
    }
  } else {
    // All moves out of PP — must switch
    console.log('  No moves left! You must switch.');
  }

  // Switches section
  if (switches.length > 0) {
    console.log('');
    console.log('  Switch:');
    for (const s of switches) {
      const hp = hpPercent(s.pokemon.currentHp, s.pokemon.maxHp);
      const st = formatStatus(s.pokemon.status);
      console.log(`    ${num}) ${padRight(s.pokemon.species.name, 14)} ${padLeft(hp, 4)} HP${st}`);
      choices.push({ label: s.pokemon.species.name, action: { type: 'switch', index: s.idx } });
      num++;
    }
  }

  return { choices, autoAction: null };
}

// --- Socket helpers ---

function waitForSocketEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    (socket as any).once(event, (data: T) => resolve(data));
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// --- Force switch handlers ---

async function handleHumanForceSwitch(human: EventClient): Promise<BattleEndPayload | null> {
  while (true) {
    const ev = await human.nextEvent();
    if (ev.event === 'battle_end') return ev.data;
    if (ev.event === 'turn_result') {
      const data = ev.data as TurnResultPayload;
      for (const e of data.events) printEvent(e);
      human.state = data.yourState;
      human.opponentVisible = data.opponentVisible;
      return null;
    }
    if (ev.event === 'needs_switch') {
      const switchData = ev.data as NeedsSwitchPayload;
      const available = switchData.availableSwitches;
      console.log('\n  Your Pokemon fainted! Choose a replacement:');
      for (let i = 0; i < available.length; i++) {
        const p = available[i].pokemon;
        const hp = hpPercent(p.currentHp, p.maxHp);
        console.log(`    ${i + 1}) ${padRight(p.species.name, 14)} ${padLeft(hp, 4)} HP${formatStatus(p.status)}`);
      }

      let pick = -1;
      while (pick < 0) {
        const input = await ask(`  Pick [1-${available.length}]: `);
        const n = parseInt(input, 10);
        if (n >= 1 && n <= available.length) {
          pick = n - 1;
        } else {
          console.log('  Invalid choice, try again.');
        }
      }

      const chosen = available[pick];
      human.socket.emit('submit_force_switch', { pokemonIndex: chosen.index });
      continue;
    }
    if (ev.event === 'error') {
      console.log(`  [error] ${ev.data.message}`);
      continue;
    }
  }
}

async function handleBotForceSwitch(bot: EventClient): Promise<BattleEndPayload | null> {
  while (true) {
    const ev = await bot.nextEvent();
    if (ev.event === 'battle_end') return ev.data;
    if (ev.event === 'turn_result') {
      const data = ev.data as TurnResultPayload;
      bot.state = data.yourState;
      return null;
    }
    if (ev.event === 'needs_switch') {
      const switchData = ev.data as NeedsSwitchPayload;
      const available = switchData.availableSwitches;
      const pick = available[Math.floor(Math.random() * available.length)];
      bot.socket.emit('submit_force_switch', { pokemonIndex: pick.index });
      continue;
    }
    if (ev.event === 'error') {
      continue;
    }
  }
}

// --- Main ---

async function main(): Promise<void> {
  // Safety timeout
  setTimeout(() => {
    console.error('\nGame timed out after 10 minutes');
    process.exit(1);
  }, 600_000).unref();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PBS — Pokemon Battle Simulator`);
  console.log(`${'='.repeat(60)}\n`);

  // Get player name
  const nameInput = await ask('  Enter your name (default: Player): ');
  const playerName = nameInput || 'Player';

  // Choose item mode
  console.log('');
  console.log('  Item sets:');
  console.log('    1) Competitive (Recommended) — optimized held items');
  console.log('    2) Casual — fun/random held items');
  let itemMode: 'competitive' | 'casual' = 'competitive';
  const itemInput = await ask('  Pick [1-2] (default: 1): ');
  if (itemInput === '2') itemMode = 'casual';

  // Pick random bot name (avoid player's name)
  const botCandidates = BOT_NAMES.filter(n => n.toLowerCase() !== playerName.toLowerCase());
  const botName = botCandidates[Math.floor(Math.random() * botCandidates.length)];

  console.log(`\n  You: ${playerName} (${itemMode})`);
  console.log(`  Opponent: ${botName}`);
  console.log('');

  // Start server (suppress noisy server logs permanently)
  process.stdout.write('  Starting server...');
  const origLog = console.log;
  console.log = () => {};
  const { httpServer } = await import('../src/server/index');
  await new Promise<void>((resolve) => {
    if (httpServer.listening) resolve();
    else httpServer.once('listening', resolve);
  });
  const port = (httpServer.address() as { port: number }).port;
  const url = `http://localhost:${port}`;
  // Restore console.log but filter server noise
  console.log = (...args: any[]) => {
    const msg = args.join(' ');
    if (msg.startsWith('[') || msg.startsWith('PBS Battle') || msg.startsWith('Health check')) return;
    origLog(...args);
  };
  origLog(' done!\n');

  // Connect two clients
  const humanSocket = ioc(url) as unknown as ClientSocket;
  const botSocket = ioc(url) as unknown as ClientSocket;
  const human = new EventClient(humanSocket, playerName);
  const bot = new EventClient(botSocket, botName);

  await Promise.all([
    new Promise<void>((r) => humanSocket.once('connect', r)),
    new Promise<void>((r) => botSocket.once('connect', r)),
  ]);

  // Create room (with human's itemMode) + bot joins
  const roomP = waitForSocketEvent<{ code: string }>(humanSocket, 'room_created');
  humanSocket.emit('create_room', { playerName, itemMode });
  const { code } = await roomP;

  // Wait for team_preview (fires after both join)
  const previewPHuman = waitForSocketEvent<TeamPreviewPayload>(humanSocket, 'team_preview');
  const previewPBot = waitForSocketEvent<TeamPreviewPayload>(botSocket, 'team_preview');
  const oppP1 = waitForSocketEvent<{ name: string }>(humanSocket, 'opponent_joined');
  const oppP2 = waitForSocketEvent<{ name: string }>(botSocket, 'opponent_joined');
  botSocket.emit('join_room', { code, playerName: botName });
  await Promise.all([oppP1, oppP2]);

  console.log(`  ${botName} wants to battle!\n`);

  const [previewHuman, previewBot] = await Promise.all([previewPHuman, previewPBot]);

  // === TEAM PREVIEW ===

  // Show human's team with stats
  printTeamPreview(previewHuman.yourTeam);

  // Prompt for lead selection
  let leadIndex = 0;
  const leadInput = await ask(`\n  Choose your lead [1-${previewHuman.yourTeam.length}] (default: 1): `);
  const leadN = parseInt(leadInput, 10);
  if (leadN >= 1 && leadN <= previewHuman.yourTeam.length) {
    leadIndex = leadN - 1;
  }

  console.log(`\n  Lead: ${previewHuman.yourTeam[leadIndex].species.name}`);

  // Both select leads → triggers battle_start
  const startPHuman = waitForSocketEvent<BattleStartPayload>(humanSocket, 'battle_start');
  const startPBot = waitForSocketEvent<BattleStartPayload>(botSocket, 'battle_start');
  humanSocket.emit('select_lead', { pokemonIndex: leadIndex, itemMode });
  botSocket.emit('select_lead', { pokemonIndex: 0, itemMode: 'competitive' });
  const [startHuman, startBot] = await Promise.all([startPHuman, startPBot]);

  human.playerIndex = startHuman.yourPlayerIndex;
  bot.playerIndex = startBot.yourPlayerIndex;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Battle Start!`);
  console.log(`  ${startHuman.yourTeam[0].species.name} vs ${startBot.yourTeam[0].species.name}`);
  console.log(`${'─'.repeat(60)}`);

  // Initialize states
  const emptySide = { stealthRock: false, spikesLayers: 0, toxicSpikesLayers: 0, reflect: 0, lightScreen: 0, tailwind: 0 };
  human.state = {
    team: startHuman.yourTeam,
    activePokemonIndex: 0,
    sideEffects: { ...emptySide },
  };
  human.opponentVisible = null;
  // Track opponent lead name for turn 1 display (before first turn_result)
  let opponentLeadName = startBot.yourTeam[0].species.name;

  bot.state = {
    team: startBot.yourTeam,
    activePokemonIndex: 0,
    sideEffects: { ...emptySide },
  };

  // === BATTLE LOOP ===

  let turnCount = 0;
  let endPayload: BattleEndPayload | null = null;

  while (turnCount < 100) {
    turnCount++;

    human.drainStale();
    bot.drainStale();

    // Print turn header
    const humanActive = human.state!.team[human.state!.activePokemonIndex];
    printTurnHeader(turnCount, humanActive, botName, human.opponentVisible, opponentLeadName);

    // Show move/switch menu
    const { choices, autoAction } = printMoveMenu(human.state!);

    // Get human input (or auto-act for Struggle)
    let humanAction: { type: 'move' | 'switch'; index: number };
    if (autoAction) {
      humanAction = autoAction;
    } else {
      const maxChoice = choices.length;
      let picked: { type: 'move' | 'switch'; index: number } | null = null;
      while (!picked) {
        const input = await ask(`\n  Pick [1-${maxChoice}]: `);
        const n = parseInt(input, 10);
        if (n >= 1 && n <= maxChoice) {
          const chosen = choices[n - 1];
          if (chosen.label === '') {
            console.log('  That move is unavailable. Pick another.');
          } else {
            picked = chosen.action;
          }
        } else {
          console.log('  Invalid choice, try again.');
        }
      }
      humanAction = picked;
    }

    // Bot picks
    const botAction = pickRandomAction(bot.state!);

    // Set up event waiters BEFORE submitting
    const evHuman = human.nextEvent();
    const evBot = bot.nextEvent();
    humanSocket.emit('submit_action', humanAction);
    botSocket.emit('submit_action', botAction);

    // Wait for results
    const [rHuman, rBot] = await withTimeout(
      Promise.all([evHuman, evBot]),
      15_000,
      `Turn ${turnCount}: timed out waiting for server response`,
    );

    // Check for battle end
    if (rHuman.event === 'battle_end' || rBot.event === 'battle_end') {
      if (rHuman.event === 'turn_result') {
        for (const ev of (rHuman.data as TurnResultPayload).events) printEvent(ev);
      }
      if (rBot.event === 'turn_result') {
        // Don't double-print from bot perspective
      }
      endPayload = rHuman.event === 'battle_end' ? rHuman.data : rBot.data;
      break;
    }

    // Process turn results
    const turnHuman = rHuman.data as TurnResultPayload;
    const turnBot = rBot.data as TurnResultPayload;

    // Print events from human's perspective
    for (const ev of turnHuman.events) {
      printEvent(ev);
    }

    human.state = turnHuman.yourState;
    human.opponentVisible = turnHuman.opponentVisible;
    if (human.opponentVisible?.activePokemon) {
      opponentLeadName = human.opponentVisible.activePokemon.species.name;
    }
    bot.state = turnBot.yourState;

    // Check for force switches
    const humanDead = !human.state.team[human.state.activePokemonIndex].isAlive;
    const botDead = !bot.state.team[bot.state.activePokemonIndex].isAlive;

    if (humanDead || botDead) {
      const switchPromises: Promise<BattleEndPayload | null>[] = [];
      switchPromises.push(handleHumanForceSwitch(human));
      switchPromises.push(handleBotForceSwitch(bot));

      const results = await Promise.all(switchPromises);
      endPayload = results.find(r => r !== null) ?? null;
      if (endPayload) break;
    }
  }

  // === RESULTS ===

  if (endPayload) {
    const isWinner = endPayload.winner === playerName;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  BATTLE RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Winner: ${endPayload.winner} ${isWinner ? '(You!)' : ''}`);
    console.log(`  Reason: ${endPayload.reason}`);
    console.log(`  Turns: ${endPayload.finalState.turn}`);

    console.log(`\n  Your team:`);
    const yourTeam = endPayload.finalState.yourTeam;
    const oppTeam = endPayload.finalState.opponentTeam;
    for (const p of yourTeam) {
      const status = p.isAlive ? `${Math.round((p.currentHp / p.maxHp) * 100)}%` : 'FAINTED';
      console.log(`    ${padRight(p.species.name, 14)} ${status}`);
    }
    console.log(`\n  ${botName}'s team:`);
    for (const p of oppTeam) {
      const status = p.isAlive ? `${Math.round((p.currentHp / p.maxHp) * 100)}%` : 'FAINTED';
      console.log(`    ${padRight(p.species.name, 14)} ${status}`);
    }
    console.log(`${'='.repeat(60)}\n`);
  } else {
    console.log('\n  Battle timed out after 100 turns.\n');
  }

  // Clean exit
  rl.close();
  humanSocket.disconnect();
  botSocket.disconnect();
  httpServer.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Game failed:', err);
  process.exit(1);
});
