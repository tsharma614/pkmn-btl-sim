/** Random trainer names for campaign mode opponents. */
export const TRAINER_NAMES = [
  'Ace', 'Blaze', 'Cedar', 'Dahlia', 'Echo', 'Fern', 'Gale', 'Haven',
  'Iris', 'Jasper', 'Kai', 'Luna', 'Milo', 'Nova', 'Onyx', 'Pearl',
  'Quinn', 'Raven', 'Sage', 'Terra', 'Umbra', 'Violet', 'Wren', 'Xander',
  'Yuki', 'Zara', 'Aspen', 'Briar', 'Cleo', 'Drake', 'Ember', 'Flint',
  'Garnet', 'Heath', 'Indigo', 'Jade', 'Knox', 'Lyric', 'Maple', 'Nero',
  'Opal', 'Pike', 'Reed', 'Storm', 'Thorn', 'Ursa', 'Vale', 'Willow',
];

/** Random trainer sprite names (from Showdown CDN). */
export const TRAINER_SPRITES = [
  'acetrainer-gen4', 'beauty-gen4', 'blackbelt-gen4', 'bugcatcher',
  'burglar', 'channeler', 'cooltrainer', 'fisherman',
  'gentleman', 'hiker', 'juggler', 'lass',
  'pokemaniac', 'psychic', 'rocker', 'roughneck',
  'sailor', 'scientist', 'swimmer', 'youngster',
  'ranger', 'worker', 'pokefan', 'guitarist',
];

/** Pick a random trainer name not already used. */
export function pickTrainerName(rng: { next: () => number }, exclude: string[] = []): string {
  const available = TRAINER_NAMES.filter(n => !exclude.includes(n));
  const pool = available.length > 0 ? available : TRAINER_NAMES;
  return pool[Math.floor(rng.next() * pool.length)];
}

/** Pick a random trainer sprite. */
export function pickTrainerSprite(rng: { next: () => number }): string {
  return TRAINER_SPRITES[Math.floor(rng.next() * TRAINER_SPRITES.length)];
}
