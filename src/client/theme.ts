import { StyleSheet } from 'react-native';

export const colors = {
  // Primary
  primary: '#E3350D',
  primaryDark: '#B82A0A',
  primaryLight: '#FF4D2A',

  // Backgrounds
  background: '#1B1B3A',
  surface: '#2D2D5E',
  surfaceLight: '#3D3D7E',

  // Neutrals
  white: '#FFFFFF',
  offWhite: '#F5F5F5',
  grey: '#9CA3AF',
  greyLight: '#D1D5DB',
  greyDark: '#4B5563',

  // Text
  text: '#FFFFFF',
  textSecondary: '#B0B8C8',
  textDim: '#6B7280',

  // Status (HP)
  hpGreen: '#22C55E',
  hpYellow: '#EAB308',
  hpRed: '#EF4444',

  // Accent
  accent: '#E3350D',
  accentGold: '#F59E0B',

  // Border
  border: '#3D3D7E',
  borderLight: '#4D4D8E',
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

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  }),
};

export const sharedStyles = StyleSheet.create({
  buttonBase: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.surfaceLight,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonSm: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  buttonMd: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonLg: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonTextPrimary: {
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  buttonTextSecondary: {
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  buttonTextGhost: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardCompact: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    width: '88%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalBody: {
    padding: spacing.lg,
  },
});
