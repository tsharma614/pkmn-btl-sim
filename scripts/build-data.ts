/**
 * Data assembly script — uses @pkmn/dex (built from Showdown data, MIT licensed)
 * and randbats JSON to build our game data.
 *
 * Outputs:
 *   src/data/pokedex.json   — final evolutions + single-stage (~400-500 Pokémon)
 *   src/data/moves.json     — all moves
 *
 * Usage: npx tsx scripts/build-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { Dex } from '@pkmn/dex';

const RANDBATS_BASE = 'https://pkmn.github.io/randbats/data';

interface RandbatsEntry {
  level: number;
  abilities: string[];
  items: string[];
  moves?: string[];
  roles?: Record<string, {
    abilities: string[];
    items: string[];
    moves: string[];
    teraTypes?: string[];
    evs?: Record<string, number>;
    ivs?: Record<string, number>;
  }>;
  evs?: Record<string, number>;
  ivs?: Record<string, number>;
}

// --- Tier assignment ---

const TIER_1_POKEMON = new Set([
  'Dragonite', 'Tyranitar', 'Salamence', 'Metagross', 'Garchomp', 'Hydreigon',
  'Goodra', 'Kommo-o', 'Dragapult', 'Baxcalibur',
  'Mewtwo', 'Lugia', 'Ho-Oh', 'Kyogre', 'Groudon', 'Rayquaza',
  'Dialga', 'Palkia', 'Giratina', 'Reshiram', 'Zekrom', 'Kyurem',
  'Xerneas', 'Yveltal', 'Zygarde', 'Solgaleo', 'Lunala', 'Necrozma',
  'Zacian', 'Zamazenta', 'Eternatus', 'Calyrex',
  'Koraidon', 'Miraidon',
  'Blaziken', 'Lucario', 'Excadrill', 'Volcarona', 'Aegislash',
  'Greninja', 'Landorus', 'Heatran', 'Ferrothorn',
]);

const TIER_2_POKEMON = new Set([
  'Zapdos', 'Moltres', 'Articuno', 'Raikou', 'Entei', 'Suicune',
  'Latias', 'Latios', 'Regice', 'Registeel', 'Regirock',
  'Azelf', 'Uxie', 'Mesprit', 'Cresselia',
  'Cobalion', 'Terrakion', 'Virizion', 'Tornadus', 'Thundurus',
  'Tapu Koko', 'Tapu Lele', 'Tapu Bulu', 'Tapu Fini',
  'Gengar', 'Scizor', 'Togekiss', 'Rotom-Wash', 'Rotom-Heat',
  'Skarmory', 'Blissey', 'Chansey', 'Clefable', 'Gliscor',
  'Starmie', 'Alakazam', 'Gyarados', 'Infernape', 'Magnezone',
  'Jirachi', 'Celebi', 'Manaphy', 'Shaymin', 'Victini',
  'Weavile', 'Mamoswine', 'Breloom', 'Conkeldurr', 'Reuniclus',
  'Hippowdon', 'Jellicent', 'Mienshao', 'Chandelure',
  'Kingdra', 'Milotic', 'Swampert', 'Sceptile',
  'Porygon2', 'Porygon-Z', 'Toxapex', 'Corviknight',
  'Cinderace', 'Rillaboom', 'Urshifu',
  'Arcanine', 'Ninetales', 'Slowbro', 'Slowking',
  'Espeon', 'Umbreon', 'Heracross', 'Bisharp',
  'Darmanitan', 'Krookodile', 'Zoroark',
]);

const TIER_4_POKEMON = new Set([
  'Sunflora', 'Delibird', 'Luvdisc', "Farfetch'd", 'Unown',
  'Spinda', 'Kricketune', 'Ledian', 'Beautifly', 'Dustox',
  'Mothim', 'Wormadam', 'Pachirisu', 'Cherrim', 'Castform',
  'Plusle', 'Minun', 'Volbeat', 'Illumise', 'Chimecho',
  'Carnivine', 'Corsola', 'Delcatty', 'Furret',
  'Raticate', 'Ariados', 'Noctowl', 'Wigglytuff', 'Granbull',
  'Girafarig', 'Dunsparce', 'Qwilfish', 'Magcargo',
  'Swalot', 'Mawile', 'Tropius', 'Chatot', 'Lumineon',
  'Phione', 'Bibarel', 'Purugly', 'Seaking',
  'Parasect', 'Butterfree', 'Beedrill', 'Pidgeot', 'Fearow',
  'Persian', 'Hypno', 'Dewgong', 'Electrode',
]);

function assignTier(name: string, bst: number): 1 | 2 | 3 | 4 {
  if (TIER_1_POKEMON.has(name)) return 1;
  if (TIER_2_POKEMON.has(name)) return 2;
  if (TIER_4_POKEMON.has(name)) return 4;
  if (bst >= 600) return 1;
  if (bst >= 500) return 2;
  if (bst >= 420) return 3;
  return 4;
}

// --- Best ability overrides ---

const BEST_ABILITY: Record<string, string> = {
  'Gyarados': 'Intimidate', 'Salamence': 'Intimidate', 'Dragonite': 'Multiscale',
  'Garchomp': 'Rough Skin', 'Tyranitar': 'Sand Stream', 'Metagross': 'Clear Body',
  'Gengar': 'Cursed Body', 'Alakazam': 'Magic Guard', 'Clefable': 'Magic Guard',
  'Breloom': 'Technician', 'Scizor': 'Technician', 'Blaziken': 'Speed Boost',
  'Gliscor': 'Poison Heal', 'Slowbro': 'Regenerator', 'Slowking': 'Regenerator',
  'Conkeldurr': 'Guts', 'Excadrill': 'Sand Rush', 'Volcarona': 'Flame Body',
  'Togekiss': 'Serene Grace', 'Chandelure': 'Flash Fire', 'Infernape': 'Iron Fist',
  'Weavile': 'Pressure', 'Mamoswine': 'Thick Fat', 'Hippowdon': 'Sand Stream',
  'Magnezone': 'Magnet Pull', 'Heracross': 'Guts', 'Kingdra': 'Swift Swim',
  'Starmie': 'Natural Cure', 'Milotic': 'Marvel Scale', 'Swampert': 'Torrent',
  'Arcanine': 'Intimidate', 'Ninetales': 'Drought', 'Politoed': 'Drizzle',
  'Abomasnow': 'Snow Warning', 'Pelipper': 'Drizzle', 'Torkoal': 'Drought',
};

function determineBestAbility(name: string, abilities: string[]): string {
  if (BEST_ABILITY[name] && abilities.includes(BEST_ABILITY[name])) {
    return BEST_ABILITY[name];
  }
  return abilities[0];
}

// --- Helpers ---

function getGenFromDexNum(num: number): number {
  if (num <= 151) return 1;
  if (num <= 251) return 2;
  if (num <= 386) return 3;
  if (num <= 493) return 4;
  if (num <= 649) return 5;
  if (num <= 721) return 6;
  if (num <= 809) return 7;
  if (num <= 905) return 8;
  return 9;
}

function getNatureForRole(role: string, atk: number, spa: number, def_: number, spd: number): string {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('bulky') || roleLower.includes('support') || roleLower.includes('stall')) {
    return def_ >= spd ? 'Bold' : 'Calm';
  }
  if (roleLower.includes('sweeper') || roleLower.includes('attacker') || roleLower.includes('wallbreaker')) {
    return atk >= spa ? 'Adamant' : 'Modest';
  }
  if (roleLower.includes('fast') || roleLower.includes('speed')) {
    return atk >= spa ? 'Jolly' : 'Timid';
  }
  return atk >= spa ? 'Adamant' : 'Modest';
}

function getDefaultEVs(atk: number, spa: number, role: string): Record<string, number> {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('bulky') || roleLower.includes('support') || roleLower.includes('stall')) {
    return { hp: 252, def: 128, spd: 128 };
  }
  return atk >= spa ? { atk: 252, spe: 252, hp: 4 } : { spa: 252, spe: 252, hp: 4 };
}

// --- Main ---

async function main() {
  console.log('Building Pokémon data using @pkmn/dex...');

  // Fetch randbats data
  let randbatsData: Record<string, RandbatsEntry> = {};
  try {
    console.log('Fetching randbats data...');
    const res = await fetch(`${RANDBATS_BASE}/gen9randombattle.json`);
    if (res.ok) {
      randbatsData = await res.json() as Record<string, RandbatsEntry>;
      console.log(`  Loaded ${Object.keys(randbatsData).length} randbats entries (gen9)`);
    }
  } catch {
    console.warn('  gen9 randbats failed, trying gen8...');
    try {
      const res = await fetch(`${RANDBATS_BASE}/gen8randombattle.json`);
      if (res.ok) {
        randbatsData = await res.json() as Record<string, RandbatsEntry>;
        console.log(`  Loaded ${Object.keys(randbatsData).length} randbats entries (gen8)`);
      }
    } catch {
      console.warn('  Could not fetch randbats data, using fallbacks');
    }
  }

  // Build a learnset cache (async)
  console.log('Building learnset cache...');
  const learnsetCache: Record<string, string[]> = {};
  const allSpecies = Dex.species.all();
  for (const species of allSpecies) {
    try {
      const learnset = await Dex.learnsets.get(species.id);
      if (learnset && learnset.learnset) {
        learnsetCache[species.name] = Object.keys(learnset.learnset).map(id => {
          const move = Dex.moves.get(id);
          return move ? move.name : id;
        });
      }
    } catch {
      // Skip if no learnset
    }
  }
  console.log(`  Cached ${Object.keys(learnsetCache).length} learnsets`);

  // --- Build Pokédex ---
  console.log('Processing species...');
  const pokedex: Record<string, any> = {};

  for (const species of Dex.species.all()) {
    // Skip non-standard
    if (species.isNonstandard && species.isNonstandard !== 'Past') continue;
    // Skip megas, primals, G-Max formes, battle-only formes
    if (species.isMega || species.isPrimal) continue;
    if (species.battleOnly) continue;
    if (species.name.endsWith('-Gmax')) continue;
    // Skip alternate formes except regional variants
    if (species.forme && !['Alola', 'Galar', 'Hisui', 'Paldea'].includes(species.forme)) continue;
    // Skip NFE
    if (species.nfe) continue;
    // Skip CAP
    if (species.num <= 0) continue;

    const bst = species.baseStats.hp + species.baseStats.atk + species.baseStats.def +
                species.baseStats.spa + species.baseStats.spd + species.baseStats.spe;
    const tier = assignTier(species.name, bst);

    // Build ability list
    const abilities: string[] = [];
    if (species.abilities['0']) abilities.push(species.abilities['0']);
    if (species.abilities['1']) abilities.push(species.abilities['1']);
    if (species.abilities['H']) abilities.push(species.abilities['H']);
    const bestAbility = determineBestAbility(species.name, abilities);

    // Get randbats sets, with learnset fallback
    const randbats = randbatsData[species.name];
    const learnset = learnsetCache[species.name] || [];
    const sets = buildSets(species.baseStats, randbats, bestAbility, species.types, learnset);
    const movePool = getMovesFromRandbats(randbats) || learnset.slice(0, 20);

    const id = species.id; // lowercase, no special chars

    pokedex[id] = {
      id,
      name: species.name,
      dexNum: species.num,
      types: species.types,
      baseStats: { ...species.baseStats },
      abilities,
      bestAbility,
      tier,
      generation: species.gen || getGenFromDexNum(species.num),
      movePool,
      sets,
      bst,
      weightkg: species.weightkg,
    };
  }

  console.log(`  Found ${Object.keys(pokedex).length} final evolution Pokémon`);
  const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of Object.values(pokedex)) {
    tierCounts[(p as any).tier as 1 | 2 | 3 | 4]++;
  }
  console.log(`  Tier distribution: T1=${tierCounts[1]}, T2=${tierCounts[2]}, T3=${tierCounts[3]}, T4=${tierCounts[4]}`);

  // --- Build Moves ---
  console.log('Processing moves...');
  const moves: Record<string, any> = {};

  for (const move of Dex.moves.all()) {
    if (move.isNonstandard && move.isNonstandard !== 'Past') continue;
    if (move.isZ) continue;
    if (move.isMax) continue;

    moves[move.id] = {
      id: move.id,
      name: move.name,
      type: move.type,
      category: move.category,
      power: move.basePower || null,
      accuracy: move.accuracy === true ? null : move.accuracy,
      pp: move.pp,
      priority: move.priority,
      target: move.target,
      flags: {
        contact: !!(move.flags as any)?.contact,
        sound: !!(move.flags as any)?.sound,
        bullet: !!(move.flags as any)?.bullet,
        punch: !!(move.flags as any)?.punch,
        bite: !!(move.flags as any)?.bite,
        pulse: !!(move.flags as any)?.pulse,
        protect: !!(move.flags as any)?.protect,
        mirror: !!(move.flags as any)?.mirror,
        defrost: !!(move.flags as any)?.defrost,
        charge: !!(move.flags as any)?.charge,
        recoil: move.recoil ? move.recoil[0] / move.recoil[1] : undefined,
        drain: move.drain ? move.drain[0] / move.drain[1] : undefined,
        multiHit: move.multihit
          ? (Array.isArray(move.multihit) ? move.multihit : [move.multihit, move.multihit])
          : undefined,
      },
      effects: buildMoveEffects(move),
      description: move.shortDesc || move.desc || '',
      critRatio: move.critRatio,
      willCrit: move.willCrit || false,
      forceSwitch: move.forceSwitch || false,
      selfSwitch: move.selfSwitch || false,
      status: move.status || null,
      volatileStatus: move.volatileStatus || null,
      weather: (move as any).weather || null,
      sideCondition: (move as any).sideCondition || null,
      boosts: move.boosts || null,
      selfBoosts: move.self?.boosts || null,
    };
  }

  console.log(`  Processed ${Object.keys(moves).length} moves`);

  // --- Write files ---
  const outDir = path.join(import.meta.dirname || __dirname, '..', 'src', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'pokedex.json'), JSON.stringify(pokedex, null, 2));
  console.log('  Wrote pokedex.json');

  fs.writeFileSync(path.join(outDir, 'moves.json'), JSON.stringify(moves, null, 2));
  console.log('  Wrote moves.json');

  console.log('Done!');
}

function getMovesFromRandbats(entry: RandbatsEntry | undefined): string[] {
  if (!entry) return [];
  if (entry.moves) return entry.moves;
  if (entry.roles) {
    const all = new Set<string>();
    for (const role of Object.values(entry.roles)) {
      for (const m of role.moves) all.add(m);
    }
    return Array.from(all);
  }
  return [];
}

function buildSets(
  baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number },
  randbats: RandbatsEntry | undefined,
  bestAbility: string,
  types: string[] = [],
  learnset: string[] = []
): any[] {
  if (!randbats) {
    const physical = baseStats.atk >= baseStats.spa;
    // Build a fallback moveset from learnset
    const fallbackMoves = pickFallbackMoves(learnset, types, physical);
    return [{
      moves: fallbackMoves,
      ability: bestAbility,
      item: 'Leftovers',
      nature: physical ? 'Adamant' : 'Modest',
      evs: physical ? { atk: 252, spe: 252, hp: 4 } : { spa: 252, spe: 252, hp: 4 },
    }];
  }

  const sets: any[] = [];

  if (randbats.roles) {
    for (const [roleName, role] of Object.entries(randbats.roles)) {
      if (!role) continue;
      sets.push({
        moves: (role.moves || []).slice(0, 8),
        ability: role.abilities?.[0] || bestAbility,
        item: role.items?.[0] || 'Leftovers',
        nature: getNatureForRole(roleName, baseStats.atk, baseStats.spa, baseStats.def, baseStats.spd),
        evs: role.evs || getDefaultEVs(baseStats.atk, baseStats.spa, roleName),
      });
    }
  } else if (randbats.moves) {
    const physical = baseStats.atk >= baseStats.spa;
    sets.push({
      moves: (randbats.moves || []).slice(0, 8),
      ability: randbats.abilities?.[0] || bestAbility,
      item: randbats.items?.[0] || 'Leftovers',
      nature: physical ? 'Adamant' : 'Modest',
      evs: randbats.evs || (physical ? { atk: 252, spe: 252, hp: 4 } : { spa: 252, spe: 252, hp: 4 }),
    });
  }

  if (sets.length === 0) {
    const physical = baseStats.atk >= baseStats.spa;
    const fallbackMoves = pickFallbackMoves(learnset, types, physical);
    sets.push({
      moves: fallbackMoves,
      ability: bestAbility,
      item: 'Leftovers',
      nature: physical ? 'Adamant' : 'Modest',
      evs: physical ? { atk: 252, spe: 252, hp: 4 } : { spa: 252, spe: 252, hp: 4 },
    });
  }

  return sets;
}

/**
 * Pick reasonable fallback moves from a learnset when no randbats data exists.
 * Prioritizes STAB moves and coverage.
 */
function pickFallbackMoves(learnset: string[], types: string[], physical: boolean): string[] {
  if (learnset.length === 0) return ['Tackle', 'Growl', 'Leer', 'Scratch'];

  const selected: string[] = [];
  const targetCategory = physical ? 'Physical' : 'Special';

  // Good generic moves to look for
  const goodMoves = [
    'Earthquake', 'Ice Beam', 'Thunderbolt', 'Flamethrower', 'Surf',
    'Psychic', 'Shadow Ball', 'Dark Pulse', 'Flash Cannon', 'Dazzling Gleam',
    'Stone Edge', 'Close Combat', 'X-Scissor', 'Poison Jab', 'Dragon Claw',
    'U-turn', 'Volt Switch', 'Stealth Rock', 'Toxic', 'Will-O-Wisp',
    'Swords Dance', 'Nasty Plot', 'Calm Mind', 'Dragon Dance',
    'Recover', 'Roost', 'Slack Off', 'Moonlight', 'Wish',
    'Body Slam', 'Return', 'Hyper Voice', 'Rapid Spin',
    'Knock Off', 'Brave Bird', 'Iron Head', 'Play Rough',
    'Energy Ball', 'Air Slash', 'Scald', 'Fire Blast',
    'Thunder', 'Blizzard', 'Hydro Pump', 'Focus Blast',
  ];

  // First: try to find STAB moves
  for (const move of goodMoves) {
    if (selected.length >= 2) break;
    if (learnset.includes(move) && !selected.includes(move)) {
      selected.push(move);
    }
  }

  // Fill remaining from learnset
  for (const move of learnset) {
    if (selected.length >= 8) break;
    if (!selected.includes(move)) {
      selected.push(move);
    }
  }

  return selected.slice(0, 8);
}

function buildMoveEffects(move: any): any[] {
  const effects: any[] = [];

  if (move.status) {
    effects.push({ type: 'status', status: move.status, chance: 100, target: 'target' });
  }
  if (move.secondary) {
    if (move.secondary.status) {
      effects.push({ type: 'status', status: move.secondary.status, chance: move.secondary.chance || 100, target: 'target' });
    }
    if (move.secondary.boosts) {
      for (const [stat, stages] of Object.entries(move.secondary.boosts)) {
        effects.push({ type: 'boost', stat, stages, chance: move.secondary.chance || 100, target: 'target' });
      }
    }
    if (move.secondary.volatileStatus === 'flinch') {
      effects.push({ type: 'flinch', chance: move.secondary.chance || 100 });
    }
  }
  if (move.boosts) {
    for (const [stat, stages] of Object.entries(move.boosts)) {
      effects.push({ type: 'boost', stat, stages, chance: 100, target: 'target' });
    }
  }
  if (move.self?.boosts) {
    for (const [stat, stages] of Object.entries(move.self.boosts)) {
      effects.push({ type: 'boost', stat, stages, chance: 100, target: 'self' });
    }
  }
  if ((move as any).weather) {
    effects.push({ type: 'weather', weather: (move as any).weather, chance: 100 });
  }
  if ((move as any).sideCondition) {
    effects.push({ type: 'hazard', hazard: (move as any).sideCondition, chance: 100 });
  }
  if (move.forceSwitch) {
    effects.push({ type: 'custom', handler: 'forceSwitch', chance: 100 });
  }

  return effects;
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
