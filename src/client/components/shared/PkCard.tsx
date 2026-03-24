import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, shadows } from '../../theme';

type Padding = 'none' | 'compact' | 'normal' | 'spacious';

interface Props {
  children: React.ReactNode;
  accentColor?: string;
  padding?: Padding;
  style?: ViewStyle;
}

const paddingMap: Record<Padding, number> = {
  none: 0,
  compact: spacing.sm,
  normal: spacing.lg,
  spacious: spacing.xl,
};

export function PkCard({
  children,
  accentColor,
  padding = 'normal',
  style,
}: Props) {
  return (
    <View style={[styles.card, shadows.md, { padding: paddingMap[padding] }, style]}>
      {accentColor ? (
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
});
