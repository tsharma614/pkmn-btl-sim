/**
 * Sequential event animation queue.
 * Processes BattleEvent[] one-by-one with delays, producing display messages.
 */

import { useState, useEffect, useRef } from 'react';
import type { BattleEvent } from '../../types';

/** A segment of styled text for rendering in the EventLog */
export interface TextSegment {
  text: string;
  bold?: boolean;
  color?: string;
  italic?: boolean;
}

export interface EventMessage {
  id: string;
  text: string;
  segments: TextSegment[];
}

export interface SpriteAnimations {
  playerAttack: number;
  playerDamage: number;
  playerFaint: number;
  playerSwitchOut: number;
  opponentAttack: number;
  opponentDamage: number;
  opponentFaint: number;
  opponentSwitchOut: number;
}

/** Damage reaction quips from the opponent based on damage percentage */

// < 8% — barely a scratch, full contempt
const CHIP_REACTIONS = [
  "...seriously?", "Was that supposed to hurt?", "Lol.", "I've sneezed harder",
  "My Magikarp hits harder", "Did you misclick?", "That's adorable",
  "Aw, it's trying", "I didn't even flinch", "Are you even trying bro",
  "That's not gonna cut it chief", "Bless your heart",
];

// 8-20% — annoying but not threatening
const LIGHT_REACTIONS = [
  "Is that all?", "Pathetic.", "My grandma hits harder", "Lmao weak",
  "That tickled, bitch", "Cute.", "Try again, dipshit", "You call that a move?",
  "I've taken worse from a Rattata", "That the best you got?", "Eh, I'll live",
  "Keep swinging, bitch", "Whatever dude", "That's a you problem not a me problem",
  "Do better", "Mid damage at best", "Poke flute hits harder",
  "I'm literally yawning", "Oh no... anyway",
];

// 20-40% — okay that actually stings
const MED_REACTIONS = [
  "Okay that stung a bit", "Not bad, asshole", "Getting pissed now",
  "Oh fuck off", "Alright that one hurt", "Shit...", "You're annoying as hell",
  "That actually hurt, dickhead", "Okay I see you", "Aight bet",
  "Now I'm mad", "You're gonna regret that", "Oh so we're doing this huh",
  "Bro thinks he's good", "Lucky hit", "I'm not even worried... yet",
  "Calm the fuck down", "You just got lucky", "Eat a dick, that hurt",
  "Starting to piss me off fr", "That was unnecessary",
];

// 40-60% — big hit, real pain
const HEAVY_REACTIONS = [
  "WHAT THE FUCK", "Jesus fucking christ", "Bro what the actual shit",
  "Holy fucking shit", "You piece of shit", "GOD DAMN",
  "That's some bullshit damage", "I'm getting destroyed holy fuck",
  "How is that legal", "What the fuck was that", "EXCUSE ME??",
  "Bro I felt that in my soul", "That's gotta be hacks",
  "I'm calling the police", "Dude CHILL", "Okay I'm actually scared now",
  "My HP said goodbye", "That's fucking disgusting", "I need an adult",
  "Bro is actually frying me", "Please stop I have a family",
  "Absolutely vile", "Who balanced this shit",
];

// 60%+ — getting nuked, existential crisis
const NUKE_REACTIONS = [
  "I'M GETTING ONE SHOT WTF", "HELLO??? THAT'S MY WHOLE HP BAR",
  "BRO JUST DELETED MY POKEMON", "I'm uninstalling", "This is actual cancer",
  "That's not even fair what the fuck", "SOMEONE NERF THIS SHIT",
  "I want to speak to the developer", "Bro sent me to the shadow realm",
  "RIP bozo... wait that's me", "GG I guess holy shit",
  "That damage is a fucking war crime", "Did I just get OHKO'd??",
  "My Pokemon didn't deserve that", "I'm filing a complaint",
  "That's literally illegal", "Bro brought a nuke to a Pokemon fight",
  "WHAT THE ACTUAL FUCK WAS THAT DAMAGE", "I'm actually shaking rn",
];

// Crits — RNG rage
const CRIT_REACTIONS = [
  "ARE YOU FUCKING KIDDING ME", "CRIT?! FUCK THIS GAME",
  "Oh FUCK OFF with that crit", "This game is fucking rigged",
  "Absolute horseshit RNG", "I'm gonna lose my shit",
  "THAT'S SO FUCKING BROKEN", "Kill me. Just kill me.",
  "OF COURSE IT'S A CRIT", "Crits shouldn't exist holy shit",
  "The RNG gods can suck my dick", "EVERY FUCKING TIME",
  "You didn't earn that hit", "That crit was so undeserved",
  "Imagine needing crits to win", "Crit merchant",
  "Skill issue? No, crit issue", "I'm having a normal one (I'm not)",
  "The crit was calculated by Satan himself", "That's it. I'm tilted.",
];

// When opponent's own move misses — opponent is frustrated
const OWN_MISS_REACTIONS = [
  "ARE YOU KIDDING ME", "HOW DID THAT MISS", "95% MY ASS",
  "This game hates me", "Bro it literally said 95%",
  "I'm going to throw my phone", "STONE MISS AGAIN",
  "I can't hit ANYTHING", "Fix your fucking game",
  "That's it I'm done", "NO FUCKING WAY THAT MISSED",
  "I want a refund", "Miss merchant simulator",
  "I swear this is rigged against me",
];

// When YOUR move misses — opponent taunts you
const ENEMY_MISS_REACTIONS = [
  "LMAOOO", "GET FUCKED", "WHIFF", "Couldn't hit water from a boat",
  "Imagine missing", "Skill issue", "You're so bad hahaha",
  "Thanks for the free turn, idiot", "Miss merchant",
  "That's embarrassing for you", "Maybe try aiming next time",
  "Down bad and missing", "Stone Miss lookin ass",
  "Nice aim dipshit", "Air ball",
];

// Hazard reactions — when opponent takes entry hazard damage
const HAZARD_REACTIONS = [
  "Spikes?? LMAO", "Should've worn boots", "Entry hazard diff",
  "Walk it off", "That's gotta sting", "Free damage babyyy",
  "Welcome to the field, bitch", "Surprise!", "Eat rocks idiot",
  "Hazard tax collected", "The floor is lava", "That's what you get for switching",
  "Step on a Lego", "Nice entrance dipshit",
];

// Faint reactions — when opponent's Pokemon faints
const FAINT_REACTIONS = [
  "LMAO BYE", "GET THAT OUTTA HERE", "REST IN PISS",
  "See ya, wouldn't wanna be ya", "Another one bites the dust",
  "Get absolutely bodied", "DOWN GOES FRAZIER",
  "That's what you get bitch", "EZ clap", "Sit the fuck down",
  "And stay down", "Deleted.", "Next victim please",
  "Should've stayed in the ball", "Return to sender",
  "Skill issue + ratio", "Couldn't be my Pokemon",
];

// Super effective reactions — when you land a SE hit on them
const SE_REACTIONS = [
  "Oh come ON", "Type advantage andy over here", "Wow so skilled picking super effective",
  "Congratulations you know the type chart", "Real original",
  "Yeah that's super effective, asshole", "I hate this matchup",
];

// Not very effective reactions — when your hit barely does anything
const NVE_REACTIONS = [
  "Nice try dumbass", "Learn your type chart", "Did you forget types exist?",
  "Resisted lol", "That was NOT it", "Read a book maybe",
  "Imagine not knowing type matchups", "Thanks for the tickle",
];

function pickReaction(reactions: string[]): string {
  return reactions[Math.floor(Math.random() * reactions.length)];
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getDamageReaction(damage: number, maxHp: number, isCritical: boolean): string | null {
  if (isCritical) return pickReaction(CRIT_REACTIONS);
  const pct = (damage / maxHp) * 100;
  if (pct >= 60) return pickReaction(NUKE_REACTIONS);
  if (pct >= 40) return pickReaction(HEAVY_REACTIONS);
  if (pct >= 20) return pickReaction(MED_REACTIONS);
  if (pct >= 8) return pickReaction(LIGHT_REACTIONS);
  if (pct >= 3) return Math.random() < 0.4 ? pickReaction(CHIP_REACTIONS) : null;
  return null;
}

export function getMissReaction(isOpponentMiss: boolean): string {
  return pickReaction(isOpponentMiss ? OWN_MISS_REACTIONS : ENEMY_MISS_REACTIONS);
}

export function getFaintReaction(): string {
  return pickReaction(FAINT_REACTIONS);
}

export function getEffectivenessReaction(type: 'super_effective' | 'not_very_effective'): string | null {
  // Only show ~40% of the time to not overwhelm
  if (Math.random() > 0.4) return null;
  return type === 'super_effective' ? pickReaction(SE_REACTIONS) : pickReaction(NVE_REACTIONS);
}

function statusText(status: string): string {
  switch (status) {
    case 'brn': case 'burn': return 'burned';
    case 'par': case 'paralysis': return 'paralyzed';
    case 'slp': case 'sleep': return 'put to sleep';
    case 'psn': case 'poison': return 'poisoned';
    case 'tox': case 'toxic': return 'badly poisoned';
    case 'frz': case 'freeze': return 'frozen solid';
    default: return status;
  }
}

/** Build a styled message with bold Pokemon names */
function styled(text: string, pokemonNames?: string[]): TextSegment[] {
  if (!pokemonNames || pokemonNames.length === 0) {
    return [{ text }];
  }

  const segments: TextSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliestIdx = remaining.length;
    let matchedName = '';

    for (const name of pokemonNames) {
      const idx = remaining.indexOf(name);
      if (idx >= 0 && idx < earliestIdx) {
        earliestIdx = idx;
        matchedName = name;
      }
    }

    if (!matchedName) {
      segments.push({ text: remaining });
      break;
    }

    if (earliestIdx > 0) {
      segments.push({ text: remaining.slice(0, earliestIdx) });
    }
    segments.push({ text: matchedName, bold: true });
    remaining = remaining.slice(earliestIdx + matchedName.length);
  }

  return segments;
}

export function formatEventMessage(event: BattleEvent): { text: string; segments: TextSegment[] } | null {
  const d = event.data;
  const names: string[] = [];
  if (d.pokemon) names.push(d.pokemon as string);
  if (d.defender) names.push(d.defender as string);
  if (d.from) names.push(d.from as string);
  if (d.to) names.push(d.to as string);
  if (d.target) names.push(d.target as string);

  let text: string | null = null;

  switch (event.type) {
    case 'use_move':
      text = pick([
        `${d.pokemon} used ${d.move}!`,
        `${d.pokemon} unleashes ${d.move}!`,
        `${d.pokemon} goes for ${d.move}!`,
        `${d.pokemon} fires off ${d.move}!`,
      ]);
      break;
    case 'damage': {
      const crit = d.isCritical ? ' Critical hit!' : '';
      text = pick([
        `${d.defender} took ${d.damage} damage!${crit}`,
        `${d.defender} takes ${d.damage} damage!${crit}`,
        `Dealt ${d.damage} to ${d.defender}!${crit}`,
      ]);
      break;
    }
    case 'super_effective':
      text = pick(["It's super effective!", "Super effective hit!"]);
      break;
    case 'not_very_effective':
      text = pick(["It's not very effective...", "Not very effective..."]);
      break;
    case 'immune':
      text = `${d.target} is completely immune!`;
      break;
    case 'miss':
      text = pick([
        `${d.pokemon}'s ${d.move} missed!`,
        `${d.move} missed ${d.pokemon}!`,
        `It missed!`,
      ]);
      break;
    case 'faint':
      text = pick([
        `${d.pokemon} fainted!`,
        `${d.pokemon} went down!`,
        `${d.pokemon} is out!`,
      ]);
      break;
    case 'switch':
      text = `${d.from} switched out for ${d.to}!`;
      break;
    case 'send_out':
      text = pick([
        `Go, ${d.pokemon}!`,
        `${d.pokemon}, I choose you!`,
        `${d.pokemon}, let's go!`,
      ]);
      break;
    case 'status':
      text = `${d.pokemon} was ${statusText(d.status as string)}!`;
      break;
    case 'status_fail':
      if (d.reason === 'type_immunity' || d.reason === 'ability_immunity') {
        text = `It doesn't affect ${d.pokemon}...`;
      } else {
        text = `${d.pokemon} is already statused!`;
      }
      break;
    case 'status_damage':
      text = `${d.pokemon} took damage from ${d.status}!`;
      break;
    case 'status_cure':
      text = `${d.pokemon} recovered from ${d.status}!`;
      break;
    case 'cant_move':
      text = `${d.pokemon} can't move! (${d.reason})`;
      break;
    case 'boost': {
      const stages = d.stages as number;
      const dir = stages > 0 ? 'rose' : 'fell';
      const sharp = Math.abs(stages) > 1 ? ' sharply' : '';
      text = `${d.pokemon}'s ${d.stat} ${dir}${sharp}!`;
      break;
    }
    case 'weather':
      text = `The weather changed to ${d.weather}!`;
      break;
    case 'weather_damage':
      text = `${d.pokemon} took damage from ${d.weather}!`;
      break;
    case 'weather_end':
      text = `The ${d.weather} subsided.`;
      break;
    case 'hazard_set':
      text = `${d.hazard} was set!`;
      break;
    case 'screen_set':
      text = `${d.screen} was set up!`;
      break;
    case 'screen_end':
      text = `${d.screen} wore off!`;
      break;
    case 'hazard_damage':
      text = `${d.pokemon} took damage from ${d.hazard}!`;
      break;
    case 'endure':
      text = `${d.pokemon} endured the hit!`;
      break;
    case 'leech_seed':
      text = `${d.pokemon}'s health was sapped by Leech Seed!`;
      break;
    case 'recoil':
      text = `${d.pokemon} took recoil damage!`;
      break;
    case 'heal':
      text = `${d.pokemon} restored HP!`;
      break;
    case 'drain':
      text = `${d.pokemon} drained HP!`;
      break;
    case 'item_heal':
      text = `${d.pokemon} restored HP with ${d.item}!`;
      break;
    case 'item_damage':
      text = `${d.pokemon} took damage from ${d.item}!`;
      break;
    case 'ability_trigger':
      text = `${d.pokemon}'s ${d.ability} activated!`;
      break;
    case 'ability_heal':
      text = `${d.pokemon} healed HP from ${d.ability}!`;
      break;
    case 'ability_damage':
      text = `${d.pokemon} took damage from ${d.ability}!`;
      break;
    case 'multi_hit':
      text = `Hit ${d.hits} times!`;
      break;
    case 'confusion_self_hit':
      text = `${d.pokemon} hurt itself in confusion!`;
      break;
    case 'protect':
    case 'protected':
      text = `${d.pokemon} protected itself!`;
      break;
    case 'substitute':
      text = `${d.pokemon} put up a Substitute!`;
      break;
    case 'substitute_hit':
      text = `The substitute took the hit for ${d.pokemon}!`;
      break;
    case 'substitute_break':
      text = `${d.pokemon}'s substitute broke!`;
      break;
    case 'item_removed':
      text = `${d.pokemon}'s ${d.item} was knocked off!`;
      break;
    case 'move_fail':
      text = 'But it failed!';
      break;
    case 'volatile_status': {
      const vs = d.status as string;
      if (vs === 'encore') text = `${d.pokemon} must keep using ${d.move}!`;
      else if (vs === 'confusion') text = `${d.pokemon} became confused!`;
      else if (vs === 'leechseed' || vs === 'leech-seed') text = `${d.pokemon} was seeded!`;
      else if (vs === 'taunt') text = `${d.pokemon} was taunted!`;
      else if (vs === 'curse') text = `${d.pokemon} was cursed!`;
      else if (vs === 'yawn') text = `${d.pokemon} grew drowsy!`;
      else if (vs === 'focusenergy') text = `${d.pokemon} is getting pumped!`;
      else if (vs === 'ingrain') text = `${d.pokemon} planted its roots!`;
      else if (vs === 'aquaring') text = `${d.pokemon} surrounded itself with a veil of water!`;
      else if (vs === 'endure') text = `${d.pokemon} braced itself!`;
      else text = `${d.pokemon} was affected by ${vs}!`;
      break;
    }
    case 'volatile_cure': {
      const vs = d.status as string;
      if (vs === 'encore') text = `${d.pokemon}'s Encore ended!`;
      else if (vs === 'confusion') text = `${d.pokemon} snapped out of confusion!`;
      else text = `${d.pokemon} recovered from ${vs}!`;
      break;
    }
    default:
      return null;
  }

  if (!text) return null;
  return { text, segments: styled(text, [...new Set(names)]) };
}

export interface DisplayedHp {
  current: number;
  max: number;
}

export interface IndicatorData {
  text: string;
  color: string;
  key: number;
  big?: boolean;
}

export interface ScreenFlash {
  color: string;
  key: number;
}

export function useEventQueue(
  events: BattleEvent[],
  onComplete: () => void,
  yourPokemonName: string | null,
  opponentPokemonName: string | null,
  initialPlayerHp?: { current: number; max: number } | null,
  initialOpponentHp?: { current: number; max: number } | null,
  yourPlayerIndex: 0 | 1 = 0,
): {
  messages: EventMessage[];
  isProcessing: boolean;
  animations: SpriteAnimations;
  damageReaction: string | null;
  playerHpOverride: DisplayedHp | null;
  opponentHpOverride: DisplayedHp | null;
  playerIndicator: IndicatorData | null;
  opponentIndicator: IndicatorData | null;
  screenFlash: ScreenFlash | null;
  opponentSpriteOverride: string | null;
  opponentNameOverride: string | null;
  playerSpriteOverride: string | null;
  playerNameOverride: string | null;
} {
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [animations, setAnimations] = useState<SpriteAnimations>({
    playerAttack: 0, playerDamage: 0, playerFaint: 0, playerSwitchOut: 0,
    opponentAttack: 0, opponentDamage: 0, opponentFaint: 0, opponentSwitchOut: 0,
  });
  const [damageReaction, setDamageReaction] = useState<string | null>(null);
  const [opponentSpriteOverride, setOpponentSpriteOverride] = useState<string | null>(null);
  const [opponentNameOverride, setOpponentNameOverride] = useState<string | null>(null);
  const [playerSpriteOverride, setPlayerSpriteOverride] = useState<string | null>(null);
  const [playerNameOverride, setPlayerNameOverride] = useState<string | null>(null);
  const [playerHpOverride, setPlayerHpOverride] = useState<DisplayedHp | null>(null);
  const [opponentHpOverride, setOpponentHpOverride] = useState<DisplayedHp | null>(null);
  const [playerIndicator, setPlayerIndicator] = useState<IndicatorData | null>(null);
  const [opponentIndicator, setOpponentIndicator] = useState<IndicatorData | null>(null);
  const [screenFlash, setScreenFlash] = useState<ScreenFlash | null>(null);
  const indicatorKeyRef = useRef(0);
  const flashKeyRef = useRef(0);
  const lastEventsRef = useRef<BattleEvent[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const yourNameRef = useRef(yourPokemonName);
  yourNameRef.current = yourPokemonName;
  const oppNameRef = useRef(opponentPokemonName);
  oppNameRef.current = opponentPokemonName;
  const initialPlayerHpRef = useRef(initialPlayerHp);
  initialPlayerHpRef.current = initialPlayerHp;
  const initialOpponentHpRef = useRef(initialOpponentHp);
  initialOpponentHpRef.current = initialOpponentHp;

  // Clear all stale state when both pokemon names become null (game reset).
  // Without this, messages and overrides from the previous game leak into the next.
  useEffect(() => {
    if (yourPokemonName === null && opponentPokemonName === null) {
      setMessages([]);
      setIsProcessing(false);
      setPlayerNameOverride(null);
      setPlayerSpriteOverride(null);
      setOpponentNameOverride(null);
      setOpponentSpriteOverride(null);
      setDamageReaction(null);
      setPlayerHpOverride(null);
      setOpponentHpOverride(null);
      setPlayerIndicator(null);
      setOpponentIndicator(null);
      lastEventsRef.current = [];
      return;
    }
    if (isProcessing) return; // don't clear mid-animation
    if (playerNameOverride && yourPokemonName && playerNameOverride !== yourPokemonName) {
      setPlayerNameOverride(null);
      setPlayerSpriteOverride(null);
    }
    if (opponentNameOverride && opponentPokemonName && opponentNameOverride !== opponentPokemonName) {
      setOpponentNameOverride(null);
      setOpponentSpriteOverride(null);
    }
  }, [yourPokemonName, opponentPokemonName, isProcessing]);

  useEffect(() => {
    if (events.length === 0 || events === lastEventsRef.current) return;
    lastEventsRef.current = events;
    setIsProcessing(true);
    setDamageReaction(null);

    // Initialize displayed HP from pre-turn state
    const runningPlayerHp = initialPlayerHpRef.current
      ? { current: initialPlayerHpRef.current.current, max: initialPlayerHpRef.current.max }
      : null;
    const runningOpponentHp = initialOpponentHpRef.current
      ? { current: initialOpponentHpRef.current.current, max: initialOpponentHpRef.current.max }
      : null;

    if (runningPlayerHp) setPlayerHpOverride({ ...runningPlayerHp });
    if (runningOpponentHp) setOpponentHpOverride({ ...runningOpponentHp });

    let i = 0;
    let cancelled = false;
    // Track who was last hit — used to contextualize SE/NVE reactions
    let lastDamageWasToOpponent = false;

    const processNext = () => {
      if (cancelled) return;
      if (i >= events.length) {
        setIsProcessing(false);
        // Clear HP overrides — real state will be applied by EVENTS_PROCESSED
        setPlayerHpOverride(null);
        setOpponentHpOverride(null);
        // Keep sprite/name overrides — prevents brief flash of fainted Pokemon
        // between event batches. They'll be naturally overridden by subsequent
        // batches or become irrelevant when real state catches up.
        setTimeout(() => {
          if (!cancelled) setDamageReaction(null);
        }, 2000);
        onCompleteRef.current();
        return;
      }

      const event = events[i];
      const result = formatEventMessage(event);
      if (result) {
        setMessages(prev => [...prev.slice(-30), { id: `${Date.now()}-${i}`, text: result.text, segments: result.segments }]);
      }

      // Trigger sprite animations based on event type
      if (event.type === 'use_move') {
        const isPlayer = event.data.player === yourPlayerIndex;
        if (isPlayer) {
          setAnimations(prev => ({ ...prev, playerAttack: prev.playerAttack + 1 }));
        } else {
          setAnimations(prev => ({ ...prev, opponentAttack: prev.opponentAttack + 1 }));
        }
      }

      if (event.type === 'damage') {
        const defenderName = event.data.defender as string;
        const dmg = event.data.damage as number;
        const isCrit = event.data.isCritical as boolean;
        const isOpponentHit = defenderName === oppNameRef.current;
        lastDamageWasToOpponent = isOpponentHit;
        indicatorKeyRef.current++;
        const dmgIndicator: IndicatorData = {
          text: `-${dmg}`,
          color: isCrit ? '#FFD700' : '#ff4444',
          key: indicatorKeyRef.current,
          big: isCrit,
        };
        if (isOpponentHit) {
          setAnimations(prev => ({ ...prev, opponentDamage: prev.opponentDamage + 1 }));
          setOpponentIndicator(dmgIndicator);
          const reaction = getDamageReaction(dmg, event.data.maxHp as number, isCrit);
          if (reaction) setDamageReaction(reaction);
          if (isCrit) {
            flashKeyRef.current++;
            setScreenFlash({ color: '#FFD700', key: flashKeyRef.current });
          }
        } else {
          setAnimations(prev => ({ ...prev, playerDamage: prev.playerDamage + 1 }));
          setPlayerIndicator(dmgIndicator);
          setDamageReaction(null);
        }
      }

      // Miss: indicator + opponent reacts
      if (event.type === 'miss') {
        const missedPokemon = event.data.pokemon as string;
        const isOpponentMiss = missedPokemon === oppNameRef.current;
        indicatorKeyRef.current++;
        if (isOpponentMiss) {
          setOpponentIndicator({ text: 'MISS!', color: '#888', key: indicatorKeyRef.current });
        } else {
          setPlayerIndicator({ text: 'MISS!', color: '#888', key: indicatorKeyRef.current });
        }
        setDamageReaction(getMissReaction(isOpponentMiss));
      }

      // Immune
      if (event.type === 'immune') {
        indicatorKeyRef.current++;
        const target = event.data.target as string;
        const isOpp = target === oppNameRef.current;
        const ind: IndicatorData = { text: 'IMMUNE', color: '#aaa', key: indicatorKeyRef.current, big: true };
        if (isOpp) setOpponentIndicator(ind);
        else setPlayerIndicator(ind);
      }

      // Effectiveness — flash + indicator only when opponent was hit
      if (event.type === 'super_effective') {
        if (lastDamageWasToOpponent) {
          flashKeyRef.current++;
          setScreenFlash({ color: '#EE8130', key: flashKeyRef.current });
          indicatorKeyRef.current++;
          setOpponentIndicator({ text: 'SUPER EFFECTIVE!', color: '#EE8130', key: indicatorKeyRef.current, big: true });
          const reaction = getEffectivenessReaction(event.type);
          if (reaction) setDamageReaction(reaction);
        }
      }
      if (event.type === 'not_very_effective') {
        if (lastDamageWasToOpponent) {
          indicatorKeyRef.current++;
          setOpponentIndicator({ text: 'Not very effective...', color: '#888', key: indicatorKeyRef.current });
          const reaction = getEffectivenessReaction(event.type);
          if (reaction) setDamageReaction(reaction);
        }
      }

      // Status applied
      if (event.type === 'status') {
        const statusName = event.data.status as string;
        const pokemon = event.data.pokemon as string;
        indicatorKeyRef.current++;
        const statusColors: Record<string, string> = {
          burn: '#EE8130', brn: '#EE8130',
          paralysis: '#F7D02C', par: '#F7D02C',
          poison: '#A33EA1', psn: '#A33EA1',
          toxic: '#A33EA1', tox: '#A33EA1',
          sleep: '#888', slp: '#888',
          freeze: '#96D9D6', frz: '#96D9D6',
        };
        const color = statusColors[statusName] || '#fff';
        const ind: IndicatorData = {
          text: statusName.toUpperCase() + '!',
          color,
          key: indicatorKeyRef.current,
          big: true,
        };
        if (pokemon === oppNameRef.current) setOpponentIndicator(ind);
        else if (pokemon === yourNameRef.current) setPlayerIndicator(ind);
      }

      // Stat boosts/drops
      if (event.type === 'boost') {
        const stages = event.data.stages as number;
        const stat = (event.data.stat as string).toUpperCase();
        const pokemon = event.data.pokemon as string;
        indicatorKeyRef.current++;
        const arrows = stages > 0 ? '▲'.repeat(Math.min(stages, 3)) : '▼'.repeat(Math.min(Math.abs(stages), 3));
        const color = stages > 0 ? '#6390F0' : '#e94560';
        const ind: IndicatorData = { text: `${arrows} ${stat}`, color, key: indicatorKeyRef.current };
        if (pokemon === oppNameRef.current) setOpponentIndicator(ind);
        else if (pokemon === yourNameRef.current) setPlayerIndicator(ind);
      }

      // Hazard damage (Spikes, Stealth Rock, Toxic Spikes)
      if (event.type === 'hazard_damage') {
        const pokemon = event.data.pokemon as string;
        const dmg = event.data.damage as number;
        const hazard = event.data.hazard as string;
        indicatorKeyRef.current++;
        const ind: IndicatorData = { text: `-${dmg} ${hazard}`, color: '#B8860B', key: indicatorKeyRef.current };
        if (pokemon === oppNameRef.current) {
          setAnimations(prev => ({ ...prev, opponentDamage: prev.opponentDamage + 1 }));
          setOpponentIndicator(ind);
          setDamageReaction(pickReaction(HAZARD_REACTIONS));
        } else if (pokemon === yourNameRef.current) {
          setAnimations(prev => ({ ...prev, playerDamage: prev.playerDamage + 1 }));
          setPlayerIndicator(ind);
        }
      }

      // Status damage (burn, poison, toxic)
      if (event.type === 'status_damage') {
        const pokemon = event.data.pokemon as string;
        const dmg = event.data.damage as number;
        indicatorKeyRef.current++;
        const ind: IndicatorData = { text: `-${dmg}`, color: '#A33EA1', key: indicatorKeyRef.current };
        if (pokemon === oppNameRef.current) {
          setAnimations(prev => ({ ...prev, opponentDamage: prev.opponentDamage + 1 }));
          setOpponentIndicator(ind);
        } else if (pokemon === yourNameRef.current) {
          setAnimations(prev => ({ ...prev, playerDamage: prev.playerDamage + 1 }));
          setPlayerIndicator(ind);
        }
      }

      // Weather damage
      if (event.type === 'weather_damage') {
        const pokemon = event.data.pokemon as string;
        const dmg = event.data.damage as number;
        indicatorKeyRef.current++;
        const ind: IndicatorData = { text: `-${dmg}`, color: '#B8860B', key: indicatorKeyRef.current };
        if (pokemon === oppNameRef.current) {
          setAnimations(prev => ({ ...prev, opponentDamage: prev.opponentDamage + 1 }));
          setOpponentIndicator(ind);
        } else if (pokemon === yourNameRef.current) {
          setAnimations(prev => ({ ...prev, playerDamage: prev.playerDamage + 1 }));
          setPlayerIndicator(ind);
        }
      }

      // Healing (heal, item_heal, ability_heal, drain)
      if (event.type === 'heal' || event.type === 'item_heal' || event.type === 'ability_heal' || event.type === 'drain') {
        const amount = (event.data.amount as number) || 0;
        if (amount > 0) {
          const pokemon = event.data.pokemon as string;
          indicatorKeyRef.current++;
          const ind: IndicatorData = { text: `+${amount}`, color: '#4caf50', key: indicatorKeyRef.current };
          if (pokemon === oppNameRef.current) setOpponentIndicator(ind);
          else if (pokemon === yourNameRef.current) setPlayerIndicator(ind);
        }
      }

      // Switch: trigger switch-out animation, then show new Pokemon
      if (event.type === 'switch') {
        const fromName = event.data.from as string;
        const toName = event.data.to as string;
        const toId = event.data.toId as string;
        const toHp = event.data.toHp as number;
        const toMaxHp = event.data.toMaxHp as number;
        if (fromName === oppNameRef.current) {
          setAnimations(prev => ({ ...prev, opponentSwitchOut: prev.opponentSwitchOut + 1 }));
          setDamageReaction(null);
          // After switch-out animation (300ms), show new Pokemon
          setTimeout(() => {
            if (cancelled) return;
            oppNameRef.current = toName;
            setOpponentSpriteOverride(toId);
            setOpponentNameOverride(toName);
            if (runningOpponentHp) {
              runningOpponentHp.current = toHp;
              runningOpponentHp.max = toMaxHp;
            }
            setOpponentHpOverride({ current: toHp, max: toMaxHp });
          }, 400);
        } else if (fromName === yourNameRef.current) {
          setAnimations(prev => ({ ...prev, playerSwitchOut: prev.playerSwitchOut + 1 }));
          setTimeout(() => {
            if (cancelled) return;
            yourNameRef.current = toName;
            setPlayerSpriteOverride(toId);
            setPlayerNameOverride(toName);
            if (runningPlayerHp) {
              runningPlayerHp.current = toHp;
              runningPlayerHp.max = toMaxHp;
            }
            setPlayerHpOverride({ current: toHp, max: toMaxHp });
          }, 400);
        }
      }

      // Send out: show new Pokemon immediately (after faint, old sprite already gone)
      if (event.type === 'send_out') {
        const player = event.data.player as number;
        const name = event.data.pokemon as string;
        const speciesId = event.data.speciesId as string;
        const hp = event.data.currentHp as number;
        const maxHp = event.data.maxHp as number;
        if (player !== yourPlayerIndex) {
          // Opponent
          oppNameRef.current = name;
          setOpponentSpriteOverride(speciesId);
          setOpponentNameOverride(name);
          if (runningOpponentHp) {
            runningOpponentHp.current = hp;
            runningOpponentHp.max = maxHp;
          }
          setOpponentHpOverride({ current: hp, max: maxHp });
        } else {
          // Player
          yourNameRef.current = name;
          setPlayerSpriteOverride(speciesId);
          setPlayerNameOverride(name);
          if (runningPlayerHp) {
            runningPlayerHp.current = hp;
            runningPlayerHp.max = maxHp;
          }
          setPlayerHpOverride({ current: hp, max: maxHp });
        }
      }

      // Faint: dramatic death + KO indicator
      if (event.type === 'faint') {
        const faintedName = event.data.pokemon as string;
        const isOpponentFaint = faintedName === oppNameRef.current;
        indicatorKeyRef.current++;
        if (isOpponentFaint) {
          setAnimations(prev => ({ ...prev, opponentFaint: prev.opponentFaint + 1 }));
          setOpponentIndicator({ text: 'KO!', color: '#e94560', key: indicatorKeyRef.current, big: true });
          setDamageReaction(getFaintReaction());
          if (runningOpponentHp) {
            runningOpponentHp.current = 0;
            setOpponentHpOverride({ ...runningOpponentHp });
          }
        } else {
          setAnimations(prev => ({ ...prev, playerFaint: prev.playerFaint + 1 }));
          setPlayerIndicator({ text: 'KO!', color: '#e94560', key: indicatorKeyRef.current, big: true });
          if (runningPlayerHp) {
            runningPlayerHp.current = 0;
            setPlayerHpOverride({ ...runningPlayerHp });
          }
        }
      }

      // Update displayed HP for all damage/heal events
      const dmgAmount = (event.data.damage as number) || 0;
      const healAmount = (event.data.amount as number) || 0;
      const eventPokemon = (event.data.pokemon as string) || '';
      const eventDefender = (event.data.defender as string) || '';

      if (dmgAmount > 0 && event.type !== 'faint') {
        const target = eventDefender || eventPokemon;
        if (target === oppNameRef.current && runningOpponentHp) {
          runningOpponentHp.current = Math.max(0, runningOpponentHp.current - dmgAmount);
          setOpponentHpOverride({ ...runningOpponentHp });
        } else if (target === yourNameRef.current && runningPlayerHp) {
          runningPlayerHp.current = Math.max(0, runningPlayerHp.current - dmgAmount);
          setPlayerHpOverride({ ...runningPlayerHp });
        }
      }

      // Heal events (drain, item_heal, ability_heal)
      if (healAmount > 0) {
        if (eventPokemon === oppNameRef.current && runningOpponentHp) {
          runningOpponentHp.current = Math.min(runningOpponentHp.max, runningOpponentHp.current + healAmount);
          setOpponentHpOverride({ ...runningOpponentHp });
        } else if (eventPokemon === yourNameRef.current && runningPlayerHp) {
          runningPlayerHp.current = Math.min(runningPlayerHp.max, runningPlayerHp.current + healAmount);
          setPlayerHpOverride({ ...runningPlayerHp });
        }
      }

      i++;
      // Timing per event type — slower overall so you can read what's happening
      let delay = 1200; // default
      if (event.type === 'faint') delay = 2200;
      else if (event.type === 'switch') delay = 1200;
      else if (event.type === 'send_out') delay = 1500;
      else if (event.type === 'super_effective' || event.type === 'not_very_effective') delay = 800;
      else if (event.type === 'use_move') delay = 1300;
      setTimeout(processNext, delay);
    };

    processNext();

    return () => {
      cancelled = true;
    };
  }, [events]);

  return {
    messages, isProcessing, animations, damageReaction,
    playerHpOverride, opponentHpOverride,
    playerIndicator, opponentIndicator, screenFlash,
    opponentSpriteOverride, opponentNameOverride,
    playerSpriteOverride, playerNameOverride,
  };
}
