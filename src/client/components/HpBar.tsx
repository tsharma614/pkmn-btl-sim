import React from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useHpAnimation } from '../hooks/use-hp-animation';
import { colors, getHpColor } from '../theme';

interface Props {
  currentHp: number;
  maxHp: number;
  width?: number;
  height?: number;
}

export function HpBar({ currentHp, maxHp, width = 120, height = 8 }: Props) {
  const ratio = useHpAnimation(currentHp, maxHp);

  const fillWidth = ratio.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
    extrapolate: 'clamp',
  });

  const backgroundColor = ratio.interpolate({
    inputRange: [0, 0.2, 0.5, 1],
    outputRange: [colors.hpRed, colors.hpRed, colors.hpYellow, colors.hpGreen],
  });

  return (
    <View style={[styles.track, { width, height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            width: fillWidth,
            height,
            borderRadius: height / 2,
            backgroundColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#333',
    overflow: 'hidden',
  },
  fill: {},
});
