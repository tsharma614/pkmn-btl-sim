import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typeColors } from '../theme';

interface Props {
  type: string;
  small?: boolean;
}

export function TypeBadge({ type, small }: Props) {
  const bg = typeColors[type] || '#888';
  return (
    <View style={[styles.badge, small && styles.small, { backgroundColor: bg }]}>
      <Text style={[styles.text, small && styles.smallText]}>
        {type.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 4,
  },
  small: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  smallText: {
    fontSize: 9,
  },
});
