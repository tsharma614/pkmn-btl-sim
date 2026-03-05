/**
 * Floating text indicator that animates upward and fades out.
 * Used for damage numbers, heal amounts, stat changes, "MISS!", etc.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export interface IndicatorData {
  text: string;
  color: string;
  key: number; // increment to retrigger
  big?: boolean; // larger text for emphasis (crits, SE, etc.)
}

interface Props {
  data: IndicatorData | null;
}

export function FloatingIndicator({ data }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const lastKey = useRef(0);

  useEffect(() => {
    if (!data || data.key === lastKey.current) return;
    lastKey.current = data.key;

    // Reset
    opacity.setValue(1);
    translateY.setValue(0);
    scale.setValue(data.big ? 1.3 : 0.8);

    Animated.parallel([
      // Float upward
      Animated.timing(translateY, {
        toValue: -50,
        duration: 1200,
        useNativeDriver: true,
      }),
      // Pop in then fade out
      Animated.sequence([
        Animated.spring(scale, {
          toValue: data.big ? 1.5 : 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.delay(400),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [data?.key]);

  if (!data) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: data.color },
          data.big && styles.bigText,
        ]}
      >
        {data.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    zIndex: 10,
  },
  text: {
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
  },
  bigText: {
    fontSize: 26,
  },
});
