/**
 * Maps item names to their sprite assets.
 * Sprites sourced from Pokemon Showdown itemicons (24x24).
 * Items without available sprites are omitted — UI handles missing gracefully.
 */
const ITEM_SPRITE_MAP: Record<string, any> = {
  'Leftovers': require('../../assets/sprites/items/leftovers.png'),
  'Life Orb': require('../../assets/sprites/items/life-orb.png'),
  'Choice Band': require('../../assets/sprites/items/choice-band.png'),
  'Choice Specs': require('../../assets/sprites/items/choice-specs.png'),
  'Choice Scarf': require('../../assets/sprites/items/choice-scarf.png'),
  'Focus Sash': require('../../assets/sprites/items/focus-sash.png'),
  'Rocky Helmet': require('../../assets/sprites/items/rocky-helmet.png'),
  'Eviolite': require('../../assets/sprites/items/eviolite.png'),
  'Air Balloon': require('../../assets/sprites/items/air-balloon.png'),
  'Light Clay': require('../../assets/sprites/items/light-clay.png'),
  'Expert Belt': require('../../assets/sprites/items/expert-belt.png'),
  'Sitrus Berry': require('../../assets/sprites/items/sitrus-berry.png'),
  'Lum Berry': require('../../assets/sprites/items/lum-berry.png'),
  'Toxic Orb': require('../../assets/sprites/items/toxic-orb.png'),
  'Flame Orb': require('../../assets/sprites/items/flame-orb.png'),
  'Black Sludge': require('../../assets/sprites/items/black-sludge.png'),
  'Scope Lens': require('../../assets/sprites/items/scope-lens.png'),
  'Razor Claw': require('../../assets/sprites/items/razor-claw.png'),
  'Shell Bell': require('../../assets/sprites/items/shell-bell.png'),
  'White Herb': require('../../assets/sprites/items/white-herb.png'),
};

export default ITEM_SPRITE_MAP;
