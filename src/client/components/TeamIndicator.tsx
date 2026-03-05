import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface Props {
  /** Total team size */
  total: number;
  /** Number of fainted Pokemon */
  fainted: number;
}

/**
 * Row of pokeball icons — filled for alive, hollow for fainted.
 */
export function TeamIndicator({ total, fainted }: Props) {
  const alive = total - fainted;
  const balls = [];

  for (let i = 0; i < total; i++) {
    const isAlive = i < alive;
    balls.push(
      <Text
        key={i}
        style={[styles.ball, isAlive ? styles.alive : styles.fainted]}
      >
        {'\u25CF'}
      </Text>,
    );
  }

  return <View style={styles.row}>{balls}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 3,
  },
  ball: {
    fontSize: 10,
  },
  alive: {
    color: colors.accent,
  },
  fainted: {
    color: colors.textDim,
  },
});
