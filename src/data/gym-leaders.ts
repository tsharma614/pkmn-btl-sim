/**
 * Gym Leader data for the Gym Leader Challenge.
 * Each type has a themed gym leader with a name, title, and badge name.
 */

export interface GymLeader {
  type: string;
  name: string;
  title: string;
  badgeName: string;
}

export const GYM_LEADERS: Record<string, GymLeader> = {
  Normal:   { type: 'Normal',   name: 'Whitney',   title: 'The Incredibly Pretty Girl',   badgeName: 'Plain Badge' },
  Fire:     { type: 'Fire',     name: 'Blaine',    title: 'The Hotheaded Quiz Master',    badgeName: 'Volcano Badge' },
  Water:    { type: 'Water',    name: 'Misty',     title: 'The Tomboyish Mermaid',        badgeName: 'Cascade Badge' },
  Electric: { type: 'Electric', name: 'Lt. Surge', title: 'The Lightning American',       badgeName: 'Thunder Badge' },
  Grass:    { type: 'Grass',    name: 'Erika',     title: 'The Nature-Loving Princess',   badgeName: 'Rainbow Badge' },
  Ice:      { type: 'Ice',      name: 'Pryce',     title: 'The Teacher of Winter',        badgeName: 'Glacier Badge' },
  Fighting: { type: 'Fighting', name: 'Bruno',     title: 'The Rock-Hard Fighter',        badgeName: 'Fist Badge' },
  Poison:   { type: 'Poison',   name: 'Koga',      title: 'The Poisonous Ninja Master',   badgeName: 'Soul Badge' },
  Ground:   { type: 'Ground',   name: 'Giovanni',  title: 'The Self-Proclaimed Strongest',badgeName: 'Earth Badge' },
  Flying:   { type: 'Flying',   name: 'Falkner',   title: 'The Elegant Master of Birds',  badgeName: 'Zephyr Badge' },
  Psychic:  { type: 'Psychic',  name: 'Sabrina',   title: 'The Master of Psychic Pokemon',badgeName: 'Marsh Badge' },
  Bug:      { type: 'Bug',      name: 'Bugsy',     title: 'The Walking Bug Pokemon Encyclopedia', badgeName: 'Hive Badge' },
  Rock:     { type: 'Rock',     name: 'Brock',     title: 'The Rock-Solid Pokemon Trainer',badgeName: 'Boulder Badge' },
  Ghost:    { type: 'Ghost',    name: 'Morty',     title: 'The Mystic Seer of the Future',badgeName: 'Fog Badge' },
  Dragon:   { type: 'Dragon',   name: 'Clair',     title: 'The Blessed User of Dragon Pokemon', badgeName: 'Rising Badge' },
  Dark:     { type: 'Dark',     name: 'Karen',     title: 'The Dark-Type Devotee',        badgeName: 'Shadow Badge' },
  Steel:    { type: 'Steel',    name: 'Jasmine',   title: 'The Steel-Clad Defense Girl',  badgeName: 'Mineral Badge' },
  Fairy:    { type: 'Fairy',    name: 'Valerie',   title: 'The Pokemon Fashion Designer', badgeName: 'Fairy Badge' },
};

/** Get the gym leader for a type, or null if not found. */
export function getGymLeader(type: string): GymLeader | null {
  return GYM_LEADERS[type] ?? null;
}
