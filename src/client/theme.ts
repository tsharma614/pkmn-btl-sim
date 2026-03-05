/**
 * Dark Pokémon-themed palette, type colors, and spacing.
 */

export const colors = {
  background: '#1a1a2e',
  surface: '#16213e',
  surfaceLight: '#0f3460',
  accent: '#e94560',
  text: '#ffffff',
  textSecondary: '#a0a0b0',
  textDim: '#606070',
  hpGreen: '#4caf50',
  hpYellow: '#ff9800',
  hpRed: '#f44336',
  border: '#2a2a4e',
};

export const typeColors: Record<string, string> = {
  Normal: '#A8A77A',
  Fire: '#EE8130',
  Water: '#6390F0',
  Electric: '#F7D02C',
  Grass: '#7AC74C',
  Ice: '#96D9D6',
  Fighting: '#C22E28',
  Poison: '#A33EA1',
  Ground: '#E2BF65',
  Flying: '#A98FF3',
  Psychic: '#F95587',
  Bug: '#A6B91A',
  Rock: '#B6A136',
  Ghost: '#735797',
  Dragon: '#6F35FC',
  Dark: '#705746',
  Steel: '#B7B7CE',
  Fairy: '#D685AD',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export function getHpColor(ratio: number): string {
  if (ratio > 0.5) return colors.hpGreen;
  if (ratio > 0.2) return colors.hpYellow;
  return colors.hpRed;
}
