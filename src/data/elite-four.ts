/**
 * Elite Four & Champion data.
 * Unlocked as an easter egg after earning all 18 gym badges.
 * Elite Four members named after Teenage Mutant Ninja Turtles.
 */

export interface EliteFourMember {
  name: string;
  title: string;
  stage: number; // 0-3 for E4, 4 for champion
}

export const ELITE_FOUR: EliteFourMember[] = [
  { name: 'Leonardo', title: 'The Fearless Leader', stage: 0 },
  { name: 'Donatello', title: 'The Brains of the Operation', stage: 1 },
  { name: 'Raphael', title: 'The Hot-Headed Brawler', stage: 2 },
  { name: 'Michelangelo', title: 'The Party Dude', stage: 3 },
];

export const CHAMPION: EliteFourMember = {
  name: 'Professor Oak',
  title: 'The Pokemon Professor',
  stage: 4,
};

/** Total number of battles: 4 E4 + 1 Champion */
export const TOTAL_E4_STAGES = 5;

export function getEliteFourMember(stage: number): EliteFourMember | null {
  if (stage < 4) return ELITE_FOUR[stage] ?? null;
  if (stage === 4) return CHAMPION;
  return null;
}
