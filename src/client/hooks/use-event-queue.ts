/**
 * Sequential event animation queue.
 * Processes BattleEvent[] one-by-one with delays, producing display messages.
 */

import { useState, useEffect, useRef } from 'react';
import type { BattleEvent } from '../../types';
import { mediumImpact, heavyImpact } from '../utils/haptics';

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

// --- Opponent lands a hit on YOU (they gloat) ---

// Big hit on you (40%+ damage)
const GLOAT_BIG_HIT = [
  "GET FUCKED LMAOOO", "Did that hurt? GOOD.", "Sit DOWN",
  "That's what I thought", "You felt that one huh",
  "EAT THAT", "How's that taste bitch", "I'm built different",
  "You're so cooked it's not even funny", "Where's your HP going? Oh right. GONE.",
  "That's called damage sweetheart", "I barely even tried",
  "You should forfeit honestly", "My Pokemon said sit the fuck down",
  "BOOM. You felt that in your soul.", "That was personal.",
  "Your HP bar is crying", "I'm not even warmed up yet",
];

// Crit on you — opponent gloats about RNG blessing
const GLOAT_CRIT = [
  "CRIT BABY LET'S GOOO", "The RNG gods love me",
  "CALCULATED CRIT", "I manifested that crit", "Crits are a skill issue",
  "That crit was EARNED", "Thank you RNG, very cool",
  "Imagine getting crit on", "That's karma bitch",
  "The game WANTS me to win", "Crit merchant and PROUD",
];

// Crits — RNG rage (opponent gets crit on THEIR mon)
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

// Hazard reactions — opponent takes entry hazard damage (they're pissed)
const HAZARD_OWN_REACTIONS = [
  "FUCK YOUR SPIKES", "I hate entry hazards so much",
  "Where are my Heavy-Duty Boots", "God damn rocks",
  "Stealth Rock is a war crime", "Great, free damage. Cool. Love it.",
  "Can you NOT set hazards for five seconds", "I'm losing HP for breathing",
  "Oh nice, more chip damage, just what I needed", "Hazard stacking piece of shit",
  "My Pokemon shouldn't have to deal with this", "Entry hazard andy over here",
  "I swear if I lose because of hazards", "That's coming out of my HP bar asshole",
  "THE ROCKS. THE FUCKING ROCKS.", "I'm switching and dying. Great.",
];

// Hazard reactions — YOUR Pokemon takes entry hazard damage (opponent gloats)
const HAZARD_ENEMY_REACTIONS = [
  "Spikes?? LMAO", "Should've worn boots", "Entry hazard diff",
  "Walk it off", "That's gotta sting", "Free damage babyyy",
  "Welcome to the field, bitch", "Surprise!", "Eat rocks idiot",
  "Hazard tax collected", "The floor is lava", "That's what you get for switching",
  "Step on a Lego", "Nice entrance dipshit",
  "I set those just for you", "How's the ground feel, bitch?",
];

// Faint reactions — opponent's Pokemon faints (they're devastated)
const OWN_FAINT_REACTIONS = [
  "WHAT THE FUCK NO", "Are you KIDDING me right now",
  "I literally just lost my best Pokemon", "NOOOOO NOT THAT ONE",
  "This is actually over for me", "I'm going to be sick",
  "That was my sweeper you piece of shit", "HOW DID THAT DIE",
  "I'm down bad. I'm actually down bad.", "RIP to a real one holy shit",
  "You're going to pay for that", "I swear to GOD",
  "My whole game plan just died", "I needed that Pokemon alive",
  "Fuck fuck fuck fuck fuck", "That's it I'm tilted",
  "You got lucky with that kill", "I hate everything about this",
  "This is the worst day of my life", "BRO THAT WAS MY CARRY",
];

// Faint reactions — YOUR Pokemon faints (opponent gloats)
const ENEMY_FAINT_REACTIONS = [
  "LMAO BYE", "GET THAT OUTTA HERE", "REST IN PISS",
  "See ya, wouldn't wanna be ya", "Another one bites the dust",
  "Get absolutely bodied", "DOWN GOES FRAZIER",
  "That's what you get bitch", "EZ clap", "Sit the fuck down",
  "And stay down", "Deleted.", "Next victim please",
  "Should've stayed in the ball", "Return to sender",
  "Skill issue + ratio", "Couldn't be my Pokemon",
  "Pack your bags", "Shipped to the shadow realm",
  "Tell your friends", "That one's going in the montage",
  "BODIEDDDD", "Gone. Reduced to atoms.", "Not even close babyyy",
  "Send in the next one so I can kill that too", "Obituary incoming",
  "Get that weak shit out of my face", "Go back to the daycare",
  "Your Pokemon just ragequit", "That KO was free as fuck",
];

// Super effective reactions — when you land a SE hit on them
const SE_REACTIONS = [
  "Oh come ON", "Type advantage andy over here", "Wow so skilled picking super effective",
  "Congratulations you know the type chart", "Real original",
  "Yeah that's super effective, asshole", "I hate this matchup",
  "No shit it's super effective", "Wow you can read a type chart, want a medal?",
  "Matchup fishing ass player", "You literally picked that move just to piss me off",
  "Super effective deez nuts", "That's not skill that's just types",
  "My grandmother knows the type chart too", "Ground into Water wow revolutionary",
];

// Not very effective reactions — when your hit barely does anything
const NVE_REACTIONS = [
  "Nice try dumbass", "Learn your type chart", "Did you forget types exist?",
  "Resisted lol", "That was NOT it", "Read a book maybe",
  "Imagine not knowing type matchups", "Thanks for the tickle",
  "Bro really just clicked that huh", "RESISTED. Sit down.",
  "My Pokemon literally yawned", "Did you even look at my typing?",
  "That was embarrassing for both of us", "I could tank that in my sleep",
  "Bro tried to Ice Beam my Water type", "Google type chart challenge (IMPOSSIBLE)",
];

// --- Item trigger reactions ---

// Focus Sash saved OPPONENT's Pokemon (they're gloating)
const FOCUS_SASH_OWN_REACTIONS = [
  "FOCUS SASH BABY LET'S GOOO", "You thought you had me LMAOOO",
  "Sash diff, stay mad", "NOT TODAY BITCH", "1 HP AND A DREAM",
  "Imagine not running Sash", "CLUTCH SASH LETS FUCKING GO",
  "Did you really think that was gonna kill me?", "Sash gaming",
  "I LIVE BITCH", "You literally can't kill me right now",
  "That's what Focus Sash is for, dipshit", "Hold this 1 HP",
  "Nice try but I built different", "SASH ACTIVATED GET FUCKED",
  "You just wasted your move lmaooo", "I paid good money for this sash",
  "1 HP is all I need to end you", "Surviving on pure spite and a sash",
];

// Focus Sash saved YOUR Pokemon (opponent is furious)
const FOCUS_SASH_ENEMY_REACTIONS = [
  "FUCK YOUR FOCUS SASH", "ARE YOU SERIOUS RIGHT NOW",
  "That should have been a kill what the FUCK", "I hate Focus Sash so much",
  "Oh COME ON that's such bullshit", "Die already holy shit",
  "1 HP?? FUCKING ONE???", "Focus Sash is the most degenerate item in this game",
  "I swear to god if you set up on me", "Great now I have to hit you AGAIN",
  "Just die already you cockroach", "SASH?? IN THIS ECONOMY??",
  "That's the most annoying shit I've ever seen", "WHO GAVE YOU A FOCUS SASH",
  "I'm going to lose my mind", "You and your bullshit sash can go to hell",
  "BRO JUST FUCKING DIE", "That kill was MINE and you know it",
];

// Air Balloon popped on OPPONENT's Pokemon (they're annoyed)
const BALLOON_OWN_REACTIONS = [
  "Shit there goes my balloon", "Well that's fucking great",
  "RIP Air Balloon, you served well", "I needed that balloon you asshole",
  "Whatever, it was gonna pop eventually", "My poor balloon...",
  "You just HAD to pop it didn't you", "Fuck, no more Ground immunity",
  "Great, now I'm grounded. Happy?", "That balloon cost me everything",
  "Pop my balloon one more time I dare you", "So much for flying",
];

// Air Balloon popped on YOUR Pokemon (opponent is happy)
const BALLOON_ENEMY_REACTIONS = [
  "POP goes the balloon bitch", "LMAO bye bye balloon",
  "No more floating for you dipshit", "Get grounded loser",
  "Should've brought a better item", "Air Balloon? More like Air Gone",
  "Time to eat some Earthquakes", "Welcome back to the ground, bitch",
  "That balloon was living on borrowed time", "POP POP motherfucker",
  "Imagine thinking a balloon would save you", "Back to earth, idiot",
];

// Weakness Policy activated on OPPONENT's Pokemon (they're hyped — you powered them up)
const WP_OWN_REACTIONS = [
  "WEAKNESS POLICY LETS FUCKING GOOO", "THANKS FOR THE BOOST IDIOT",
  "You just made me STRONGER dumbass", "LMAOOO +2/+2 BABY",
  "I literally baited you into that", "YOU ACTIVATED MY TRAP CARD",
  "Thanks for the free boosts dipshit", "Oh you're SO dead now",
  "I was WAITING for you to do that", "Big mistake. HUGE mistake.",
  "You just signed your own death warrant", "Weakness Policy diff",
  "That super effective was a gift. For ME.", "+2 attack and you can't take it back",
  "I'm about to sweep your whole team thanks to you", "All according to plan",
  "Keep hitting me with super effective see what happens",
];

// Weakness Policy activated on YOUR Pokemon (opponent is scared)
const WP_ENEMY_REACTIONS = [
  "Oh fuck. Weakness Policy.", "SHIT SHIT SHIT SHIT",
  "I just boosted them didn't I... fuck", "Oh no oh fuck oh god",
  "WHY DOES EVERYTHING HAVE WEAKNESS POLICY", "I'm actually so dead",
  "Wait no go back I take it back", "That was a mistake I KNOW it was a mistake",
  "Please don't sweep me please don't sweep me", "+2 is fine. This is fine. I'm fine.",
  "I literally handed them the game on a silver platter", "Well I'm fucked",
  "I should have just clicked something else", "WEAKNESS POLICY?? REALLY??",
  "Great I just lost the game", "I'm going to be sick",
];

// Toxic Orb activated on OPPONENT's Pokemon (they're scheming — Guts/Poison Heal user)
const TOXIC_ORB_OWN_REACTIONS = [
  "All part of the plan", "Toxic Orb gaming let's go",
  "Yeah I poisoned myself. Problem?", "This is big brain you wouldn't understand",
  "Trust the process", "Poison makes me STRONGER bitch",
  "You see toxic, I see a power spike", "Calculated.",
  "Status is a feature not a bug", "You have no idea what's about to happen",
  "Guts go BRRRR", "I'm built different, literally",
];

// Toxic Orb activated on YOUR Pokemon (opponent is confused/mocking)
const TOXIC_ORB_ENEMY_REACTIONS = [
  "Bro just poisoned himself LMAOOO", "You good bro??",
  "Sir your Pokemon is killing itself", "Self-sabotage speedrun any%",
  "Oh great a Guts user, fuck me sideways", "Not the Toxic Orb tech",
  "Imagine willingly poisoning yourself", "This dude is built different and not in a good way",
  "I hope you know what you're doing", "Self-harm is not the answer",
  "Great, now I gotta deal with Guts", "Oh so we're doing THAT kind of set",
];

// Flame Orb activated on OPPONENT's Pokemon (they're scheming)
const FLAME_ORB_OWN_REACTIONS = [
  "Flame Orb activated. You're fucked.", "Guts boost incoming bitch",
  "Yeah I burned myself. And?", "Trust me bro this is a good thing",
  "Fire gives me strength", "Calculated self-immolation",
  "The burn is a BUFF where I come from", "My pain is your problem now",
  "Flame Orb is peak game design", "Watch what happens next",
  "I am literally on fire and I've never been stronger",
];

// Flame Orb activated on YOUR Pokemon (opponent is wary/mocking)
const FLAME_ORB_ENEMY_REACTIONS = [
  "Oh GREAT a Flame Orb Guts set", "Bro really just set himself on fire",
  "Is your Pokemon okay??", "Self-burn any% world record",
  "Oh so you're one of THOSE players", "This is about to hurt isn't it",
  "Why would you do that to your own Pokemon", "Sir that's arson",
  "Great now everything's gonna hit like a truck", "I already hate this",
  "Flame Orb players are a different breed of psychopath",
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

export function getFaintReaction(isOwnFaint: boolean): string {
  return pickReaction(isOwnFaint ? OWN_FAINT_REACTIONS : ENEMY_FAINT_REACTIONS);
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
      const hitLabel = d.hit ? ` (hit ${d.hit})` : '';
      text = pick([
        `${d.defender} took ${d.damage} damage!${hitLabel}${crit}`,
        `${d.defender} takes ${d.damage} damage!${hitLabel}${crit}`,
        `Dealt ${d.damage} to ${d.defender}!${hitLabel}${crit}`,
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
    case 'recoil': {
      const recoilQuips = [
        'Worth it.',
        'Pain is temporary, KOs are forever.',
        'Built different.',
        'No pain no gain, bitch.',
        'That\'s gonna leave a mark... on both of us.',
        'Didn\'t even flinch. (Okay, maybe a little.)',
        'Self-destruction is an art form.',
        'Talk shit, get hit. ...By yourself.',
        'Violence was always the answer.',
        'Hurts so good.',
        'My body, my choice to wreck it.',
        'Calculated. (The damage to myself was not.)',
        'Blood for blood.',
        'If I\'m going down, I\'m taking you with me.',
        'Just a flesh wound.',
      ];
      const quip = recoilQuips[Math.floor(Math.random() * recoilQuips.length)];
      text = `${d.pokemon} took recoil damage! "${quip}"`;
      break;
    }
    case 'heal':
      text = d.source === 'Wish'
        ? `${d.pokemon}'s wish came true!`
        : `${d.pokemon} restored HP!`;
      break;
    case 'wish_start':
      text = `${d.pokemon} made a wish!`;
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
    case 'item_trigger': {
      const item = d.item as string;
      if (d.message === 'popped') {
        text = `${d.pokemon}'s ${item} popped!`;
      } else {
        text = `${d.pokemon}'s ${item} activated!`;
      }
      break;
    }
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
    case 'boost_steal':
      text = `${d.attacker} stole ${d.defender}'s stat boosts!`;
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
  // Track last override values so subsequent event batches don't snap HP back
  const lastPlayerHpRef = useRef<DisplayedHp | null>(null);
  const lastOpponentHpRef = useRef<DisplayedHp | null>(null);

  // Safety net: when event processing finishes and real state has been applied
  // (via EVENTS_PROCESSED in the reducer), sync HP overrides to the real values
  // then clear them. This ensures any drift between running HP and real HP
  // is corrected, preventing the HP bar from showing stale values.
  const wasProcessingRef = useRef(false);
  useEffect(() => {
    if (isProcessing) {
      wasProcessingRef.current = true;
      return;
    }
    // Only clear when transitioning from processing → not processing
    if (!wasProcessingRef.current) return;
    wasProcessingRef.current = false;
    // Wait briefly for EVENTS_PROCESSED to flush deferred state into real props
    const timer = setTimeout(() => {
      lastPlayerHpRef.current = null;
      lastOpponentHpRef.current = null;
      setPlayerHpOverride(null);
      setOpponentHpOverride(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [isProcessing]);

  // Clear all stale state when both pokemon names become null (game reset).
  // Without this, messages and overrides from the previous game leak into the next.
  useEffect(() => {
    if (yourPokemonName === null && opponentPokemonName === null) {
      setMessages([]);
      setIsProcessing(false);
      setAnimations({
        playerAttack: 0, playerDamage: 0, playerFaint: 0, playerSwitchOut: 0,
        opponentAttack: 0, opponentDamage: 0, opponentFaint: 0, opponentSwitchOut: 0,
      });
      setPlayerNameOverride(null);
      setPlayerSpriteOverride(null);
      setOpponentNameOverride(null);
      setOpponentSpriteOverride(null);
      setDamageReaction(null);
      setPlayerHpOverride(null);
      setOpponentHpOverride(null);
      setPlayerIndicator(null);
      setOpponentIndicator(null);
      setScreenFlash(null);
      lastPlayerHpRef.current = null;
      lastOpponentHpRef.current = null;
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

    // Initialize displayed HP: prefer last tracked override (from previous batch)
    // over the initial prop (which may have jumped to the engine's post-turn value)
    const runningPlayerHp = lastPlayerHpRef.current
      ? { ...lastPlayerHpRef.current }
      : initialPlayerHpRef.current
        ? { current: initialPlayerHpRef.current.current, max: initialPlayerHpRef.current.max }
        : null;
    const runningOpponentHp = lastOpponentHpRef.current
      ? { ...lastOpponentHpRef.current }
      : initialOpponentHpRef.current
        ? { current: initialOpponentHpRef.current.current, max: initialOpponentHpRef.current.max }
        : null;

    if (runningPlayerHp) setPlayerHpOverride({ ...runningPlayerHp });
    if (runningOpponentHp) setOpponentHpOverride({ ...runningOpponentHp });

    let i = 0;
    let cancelled = false;
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
    const safeTimeout = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        if (cancelled) return;
        fn();
      }, delay);
      pendingTimeouts.push(id);
      return id;
    };
    // Track who was last hit — used to contextualize SE/NVE reactions
    let lastDamageWasToOpponent = false;
    // Cooldown: avoid rapid-fire speech bubbles (e.g. multi-hit moves)
    let lastReactionTime = 0;
    const REACTION_COOLDOWN = 1800; // ms between low-priority reactions

    /** Set a reaction with cooldown. High-priority always fires; low-priority respects cooldown. */
    const tryReaction = (text: string | null, priority: 'high' | 'low' = 'low') => {
      if (!text) return;
      const now = Date.now();
      if (priority === 'high' || now - lastReactionTime >= REACTION_COOLDOWN) {
        setDamageReaction(text);
        lastReactionTime = now;
      }
    };

    const processNext = () => {
      if (cancelled) return;
      if (i >= events.length) {
        setIsProcessing(false);
        // Save running HP temporarily — if there are queued event batches,
        // these refs let the next batch continue from where we left off.
        // They'll be cleared by the isProcessing useEffect once ALL batches
        // are done, so the real state takes over.
        lastPlayerHpRef.current = runningPlayerHp ? { ...runningPlayerHp } : null;
        lastOpponentHpRef.current = runningOpponentHp ? { ...runningOpponentHp } : null;
        // Keep sprite/name overrides — prevents brief flash of fainted Pokemon
        // between event batches. They'll be naturally overridden by subsequent
        // batches or become irrelevant when real state catches up.
        safeTimeout(() => {
          setDamageReaction(null);
        }, 2000);
        // Fire onComplete which triggers EVENTS_PROCESSED in the reducer.
        // The isProcessing useEffect will clear HP overrides after a short
        // delay, letting the real state (applied by EVENTS_PROCESSED) take over.
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
        const dmg = event.data.damage as number;
        const isCrit = event.data.isCritical as boolean;
        // Use player index when available (reliable), fall back to name matching
        const defenderPlayer = event.data.defenderPlayer as number | undefined;
        const isOpponentHit = defenderPlayer !== undefined
          ? defenderPlayer !== yourPlayerIndex
          : (event.data.defender as string) === oppNameRef.current;
        lastDamageWasToOpponent = isOpponentHit;
        indicatorKeyRef.current++;
        const dmgIndicator: IndicatorData = {
          text: `-${dmg}`,
          color: isCrit ? '#FFD700' : '#ff4444',
          key: indicatorKeyRef.current,
          big: isCrit,
        };
        if (isOpponentHit) {
          mediumImpact();
          setAnimations(prev => ({ ...prev, opponentDamage: prev.opponentDamage + 1 }));
          setOpponentIndicator(dmgIndicator);
          const reaction = getDamageReaction(dmg, event.data.maxHp as number, isCrit);
          if (reaction) tryReaction(reaction, isCrit ? 'high' : 'low');
          if (isCrit) {
            flashKeyRef.current++;
            setScreenFlash({ color: '#FFD700', key: flashKeyRef.current });
          }
        } else {
          mediumImpact();
          setAnimations(prev => ({ ...prev, playerDamage: prev.playerDamage + 1 }));
          setPlayerIndicator(dmgIndicator);
          // Opponent gloats when they land a big hit or crit on you
          if (isCrit) {
            tryReaction(pickReaction(GLOAT_CRIT), 'high');
          } else {
            const pct = (dmg / (event.data.maxHp as number)) * 100;
            if (pct >= 40) {
              tryReaction(pickReaction(GLOAT_BIG_HIT), 'low');
            }
            // small hits: don't clear — let previous reaction linger
          }
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
        tryReaction(getMissReaction(isOpponentMiss), 'high');
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
          if (reaction) tryReaction(reaction, 'low');
        }
      }
      if (event.type === 'not_very_effective') {
        if (lastDamageWasToOpponent) {
          indicatorKeyRef.current++;
          setOpponentIndicator({ text: 'Not very effective...', color: '#888', key: indicatorKeyRef.current });
          const reaction = getEffectivenessReaction(event.type);
          if (reaction) tryReaction(reaction, 'low');
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
          tryReaction(pickReaction(HAZARD_OWN_REACTIONS), 'low'); // their mon took hazards — they're mad
        } else if (pokemon === yourNameRef.current) {
          setAnimations(prev => ({ ...prev, playerDamage: prev.playerDamage + 1 }));
          setPlayerIndicator(ind);
          tryReaction(pickReaction(HAZARD_ENEMY_REACTIONS), 'low'); // your mon took hazards — they gloat
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

      // Item triggers — opponent reacts with item-specific quips
      if (event.type === 'item_trigger') {
        const item = event.data.item as string;
        const pokemon = event.data.pokemon as string;
        const isOpponentItem = pokemon === oppNameRef.current;

        if (item === 'Focus Sash') {
          tryReaction(pickReaction(isOpponentItem ? FOCUS_SASH_OWN_REACTIONS : FOCUS_SASH_ENEMY_REACTIONS), 'high');
        } else if (item === 'Air Balloon') {
          tryReaction(pickReaction(isOpponentItem ? BALLOON_OWN_REACTIONS : BALLOON_ENEMY_REACTIONS), 'high');
        } else if (item === 'Weakness Policy') {
          tryReaction(pickReaction(isOpponentItem ? WP_OWN_REACTIONS : WP_ENEMY_REACTIONS), 'high');
        } else if (item === 'Toxic Orb') {
          tryReaction(pickReaction(isOpponentItem ? TOXIC_ORB_OWN_REACTIONS : TOXIC_ORB_ENEMY_REACTIONS), 'high');
        } else if (item === 'Flame Orb') {
          tryReaction(pickReaction(isOpponentItem ? FLAME_ORB_OWN_REACTIONS : FLAME_ORB_ENEMY_REACTIONS), 'high');
        }
      }

      // Switch: trigger switch-out animation, then show new Pokemon
      if (event.type === 'switch') {
        const toName = event.data.to as string;
        const toId = event.data.toId as string;
        const toHp = event.data.toHp as number;
        const toMaxHp = event.data.toMaxHp as number;
        // Use player index (reliable) to determine which side switched
        const switchPlayer = event.data.player as number;
        const isOpponentSwitch = switchPlayer !== yourPlayerIndex;
        console.log(`[event-queue] SWITCH: player=${switchPlayer}, → ${toName} (id: ${toId}), isOpponent: ${isOpponentSwitch}`);
        if (isOpponentSwitch) {
          setAnimations(prev => ({ ...prev, opponentSwitchOut: prev.opponentSwitchOut + 1 }));
          setDamageReaction(null);
          // After switch-out animation (300ms), show new Pokemon
          safeTimeout(() => {
            oppNameRef.current = toName;
            setOpponentSpriteOverride(toId);
            setOpponentNameOverride(toName);
            if (runningOpponentHp) {
              runningOpponentHp.current = toHp;
              runningOpponentHp.max = toMaxHp;
            }
            setOpponentHpOverride({ current: toHp, max: toMaxHp });
          }, 400);
        } else {
          setAnimations(prev => ({ ...prev, playerSwitchOut: prev.playerSwitchOut + 1 }));
          safeTimeout(() => {
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
        console.log(`[event-queue] SEND_OUT: player=${player}, name=${name}, id=${speciesId}, yourPlayerIndex=${yourPlayerIndex}`);
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
        console.log(`[event-queue] FAINT: ${event.data.pokemon}, player=${event.data.player}, oppRef=${oppNameRef.current}, yourRef=${yourNameRef.current}`);
        // Use player index when available (reliable), fall back to name matching
        const faintPlayer = event.data.player as number | undefined;
        const isOpponentFaint = faintPlayer !== undefined
          ? faintPlayer !== yourPlayerIndex
          : (event.data.pokemon as string) === oppNameRef.current;
        indicatorKeyRef.current++;
        if (isOpponentFaint) {
          heavyImpact();
          setAnimations(prev => ({ ...prev, opponentFaint: prev.opponentFaint + 1 }));
          setOpponentIndicator({ text: 'KO!', color: '#e94560', key: indicatorKeyRef.current, big: true });
          tryReaction(getFaintReaction(true), 'high'); // their mon died — they're upset
          if (runningOpponentHp) {
            runningOpponentHp.current = 0;
            setOpponentHpOverride({ ...runningOpponentHp });
          }
        } else {
          heavyImpact();
          setAnimations(prev => ({ ...prev, playerFaint: prev.playerFaint + 1 }));
          setPlayerIndicator({ text: 'KO!', color: '#e94560', key: indicatorKeyRef.current, big: true });
          tryReaction(getFaintReaction(false), 'high'); // your mon died — they gloat
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
      else if (event.type === 'damage' && event.data.hit) delay = 500; // multi-hit: fast per-hit
      else if (event.type === 'multi_hit') delay = 600; // summary after multi-hit
      safeTimeout(processNext, delay);
    };

    processNext();

    return () => {
      cancelled = true;
      pendingTimeouts.forEach(clearTimeout);
      pendingTimeouts.length = 0;
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
