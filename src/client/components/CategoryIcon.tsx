import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface Props {
  category: string;
  size?: number;
}

/**
 * Physical = starburst [*], Special = rings [O], Status = swirl [~]
 */
export function CategoryIcon({ category, size = 14 }: Props) {
  const cat = category.toLowerCase();
  let symbol: string;
  let color: string;

  if (cat === 'physical') {
    symbol = '\u2726'; // ✦ starburst
    color = '#EE8130';
  } else if (cat === 'special') {
    symbol = '\u25CE'; // ◎ rings
    color = '#6390F0';
  } else {
    symbol = '\u223C'; // ∼ swirl
    color = '#A0A0B0';
  }

  return <Text style={[styles.icon, { fontSize: size, color }]}>{symbol}</Text>;
}

const styles = StyleSheet.create({
  icon: {
    fontWeight: '700',
  },
});
