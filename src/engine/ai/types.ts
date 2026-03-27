export enum AIFlag {
  CHECK_BAD_MOVE   = 1 << 0,
  TRY_TO_FAINT     = 1 << 1,
  CHECK_VIABILITY  = 1 << 2,
  SETUP_FIRST_TURN = 1 << 3,
  HP_AWARE         = 1 << 4,
  SWITCH_SMART     = 1 << 5,
}

export enum AITier {
  BASIC    = 'basic',
  SMART    = 'smart',
  EXPERT   = 'expert',
  CHAMPION = 'champion',
}

export const AI_TIER_FLAGS: Record<AITier, number> = {
  [AITier.BASIC]:    AIFlag.CHECK_BAD_MOVE,
  [AITier.SMART]:    AIFlag.CHECK_BAD_MOVE | AIFlag.TRY_TO_FAINT | AIFlag.CHECK_VIABILITY,
  [AITier.EXPERT]:   AIFlag.CHECK_BAD_MOVE | AIFlag.TRY_TO_FAINT | AIFlag.CHECK_VIABILITY
                     | AIFlag.SETUP_FIRST_TURN | AIFlag.HP_AWARE,
  [AITier.CHAMPION]: AIFlag.CHECK_BAD_MOVE | AIFlag.TRY_TO_FAINT | AIFlag.CHECK_VIABILITY
                     | AIFlag.SETUP_FIRST_TURN | AIFlag.HP_AWARE | AIFlag.SWITCH_SMART,
};

export interface MoveScore {
  moveIndex: number;
  score: number;
  canKO: boolean;
  effectiveness: number;
  estimatedDamage: number;
  estimatedDamagePercent: number;
}

export interface SwitchScore {
  pokemonIndex: number;
  score: number;
  reason: string;
}

export interface ThreatAssessment {
  canIKO: boolean;
  canTheyKO: boolean;
  iGoFirst: boolean;
  myBestDamagePercent: number;
  theirBestDamagePercent: number;
  turnsToKO: number;
  turnsToBeKOd: number;
}
