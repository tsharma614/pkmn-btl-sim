/** Final evolution starters from all regions, used as Gauntlet starter picks. */
export const GAUNTLET_STARTERS = [
  // Gen 1
  'venusaur', 'charizard', 'blastoise',
  // Gen 2
  'meganium', 'typhlosion', 'feraligatr',
  // Gen 3
  'sceptile', 'blaziken', 'swampert',
  // Gen 4
  'torterra', 'infernape', 'empoleon',
  // Gen 5
  'serperior', 'emboar', 'samurott',
  // Gen 6
  'chesnaught', 'delphox', 'greninja',
  // Gen 7
  'decidueye', 'incineroar', 'primarina',
  // Gen 8
  'rillaboom', 'cinderace', 'inteleon',
] as const;

export type GauntletStarter = typeof GAUNTLET_STARTERS[number];
