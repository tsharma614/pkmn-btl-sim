/** Gauntlet milestone taglines — gets more surprised the further you go */
export const GAUNTLET_TAGLINES: Record<number, string> = {
  1: "Let's see what you've got.",
  2: "Alright, round two. Don't get cocky.",
  3: "Still here? Cute.",
  5: "Five in a row? Not bad, not bad.",
  7: "Okay you're actually decent at this.",
  10: "Holy shit, you actually made it to 10.",
  15: "Fifteen?! What the fuck, who are you?",
  20: "Twenty wins. I'm honestly speechless. What the hell.",
  25: "Are you fucking kidding me? Twenty-five?!",
  30: "Thirty. You absolute psychopath. I love it.",
  40: "Forty. This is getting ridiculous. Stop.",
  50: "FIFTY?! Go outside. Touch grass. Please.",
};

/** Get the gauntlet tagline for a given battle number */
export function getGauntletTagline(battleNum: number): string {
  // Check exact milestones first
  if (GAUNTLET_TAGLINES[battleNum]) return GAUNTLET_TAGLINES[battleNum];

  // Generic taglines for non-milestone battles
  if (battleNum < 5) return "Think you can keep this up?";
  if (battleNum < 10) return "Getting tougher from here.";
  if (battleNum < 15) return "Damn, you're still going.";
  if (battleNum < 20) return "Alright, I'm impressed. Don't let it go to your head.";
  if (battleNum < 30) return "What the fuck. How are you still winning?";
  return "You're actually insane. Respect.";
}

/** Type-specific gym trash talk */
export const GYM_TAGLINES: Record<string, string[]> = {
  Normal: [
    "Nothing special about what's coming — just a straight-up ass kicking.",
    "Normal type? More like normally unbeatable, bitch.",
  ],
  Fire: [
    "Get ready to get fucking roasted.",
    "Hope you brought burn heal, because this is gonna hurt.",
  ],
  Water: [
    "You're about to get washed. Literally.",
    "Drowning in losses starts here, asshole.",
  ],
  Electric: [
    "Get ready for a shocking fucking battle.",
    "Gonna light your ass up like a Christmas tree.",
  ],
  Grass: [
    "Time to get smoked. Pun absolutely intended.",
    "You're about to get wrecked by a bunch of plants. How embarrassing.",
  ],
  Ice: [
    "Cold as fuck in here. Just like my heart when I crush you.",
    "Freeze. You're already dead.",
  ],
  Fighting: [
    "Fists up, bitch. Let's go.",
    "About to beat your ass the old-fashioned way.",
  ],
  Poison: [
    "This is gonna be toxic as hell. You've been warned.",
    "Poisoned before the first turn. That's my specialty.",
  ],
  Ground: [
    "I'll bury you six feet under.",
    "Earthquake incoming. Brace your ass.",
  ],
  Flying: [
    "Can't hit what you can't reach, ground-dweller.",
    "Get ready to eat sky-high shit.",
  ],
  Psychic: [
    "I already know you're going to lose. It's a damn gift.",
    "Mind games? Nah, I'll fuck your whole strategy up.",
  ],
  Bug: [
    "Underestimate bugs and get your ass wrecked. Your funeral.",
    "Bugs are terrifying and so am I, bitch.",
  ],
  Rock: [
    "Hard as a rock, tough as nails. You're fucked.",
    "About to stone-cold destroy your ass.",
  ],
  Ghost: [
    "Boo, bitch. Your team's about to be haunted.",
    "Can't fight what you can't see. Good damn luck.",
  ],
  Dragon: [
    "Dragons don't lose. Ever. Get ready to get your ass handed to you.",
    "Bow before the dragon master, you damn peasant.",
  ],
  Dark: [
    "Welcome to the dark side, bitch. No survivors.",
    "Playing dirty is kind of my whole damn thing.",
  ],
  Steel: [
    "Steel wall. You're not getting through, asshole.",
    "Hard as steel, cold as hell. You're done.",
  ],
  Fairy: [
    "Don't let the sparkles fool you. I'll end you.",
    "Fairy power will fuck you up. Believe it.",
  ],
};

/** Get a random gym tagline for a type */
export function getGymTagline(type: string, rng: { next: () => number }): string {
  const pool = GYM_TAGLINES[type];
  if (!pool || pool.length === 0) return "Let's battle.";
  return pool[Math.floor(rng.next() * pool.length)];
}

/** E4 non-type-specific trash talk */
export const E4_TAGLINES = [
  "You made it to the Elite Four? Enjoy it while it lasts.",
  "The gym leaders were nothing. This is where it gets real.",
  "Hope you're ready, because I don't hold back.",
  "Elite Four doesn't play nice. Let's fucking go.",
  "You've come far. Too bad it ends here.",
  "Time to find out if you're actually good or just lucky.",
];

/** Champion extra hard trash talk */
export const CHAMPION_TAGLINES = [
  "So you beat the Elite Four. Cute. Now face the Champion.",
  "I've been waiting for someone worth fighting. Don't disappoint me.",
  "This is it. The final battle. Give me everything you've got, asshole.",
  "Champion for a reason. Let's see if you can take it.",
];

export function getE4Tagline(rng: { next: () => number }): string {
  return E4_TAGLINES[Math.floor(rng.next() * E4_TAGLINES.length)];
}

export function getChampionTagline(rng: { next: () => number }): string {
  return CHAMPION_TAGLINES[Math.floor(rng.next() * CHAMPION_TAGLINES.length)];
}
