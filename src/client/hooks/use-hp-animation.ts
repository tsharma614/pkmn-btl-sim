import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Returns an Animated.Value that smoothly transitions to the current HP ratio.
 */
export function useHpAnimation(currentHp: number, maxHp: number): Animated.Value {
  const ratio = maxHp > 0 ? currentHp / maxHp : 0;
  const animatedValue = useRef(new Animated.Value(ratio)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: maxHp > 0 ? currentHp / maxHp : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [currentHp, maxHp, animatedValue]);

  return animatedValue;
}
