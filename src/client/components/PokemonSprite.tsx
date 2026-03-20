import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import SPRITE_MAP from '../sprite-map';
import ANI_SPRITE_MAP from '../ani-sprite-map';
import ANI_BACK_SPRITE_MAP from '../ani-back-sprite-map';

interface Props {
  speciesId: string;
  facing: 'front' | 'back';
  size?: number;
  /** Use animated GIF sprite (for battle screen) */
  animated?: boolean;
  attackTrigger?: number;
  damageTrigger?: number;
  faintTrigger?: number;
  switchOutTrigger?: number;
}

export function PokemonSprite(props: Props) {
  return <PokemonSpriteInner key={props.speciesId} {...props} />;
}

function PokemonSpriteInner({ speciesId, facing, size = 120, animated = false, attackTrigger = 0, damageTrigger = 0, faintTrigger = 0, switchOutTrigger = 0 }: Props) {
  const aniMap = facing === 'back' ? ANI_BACK_SPRITE_MAP : ANI_SPRITE_MAP;
  const useAnimated = animated && aniMap[speciesId];
  const source = useAnimated ? aniMap[speciesId] : SPRITE_MAP[speciesId];

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const lastAttack = useRef(attackTrigger);
  const lastDamage = useRef(damageTrigger);
  const lastFaint = useRef(faintTrigger);
  const lastSwitchOut = useRef(switchOutTrigger);

  useEffect(() => {
    if (attackTrigger > 0 && attackTrigger !== lastAttack.current) {
      lastAttack.current = attackTrigger;
      const jumpDist = facing === 'back' ? -12 : 12;
      Animated.sequence([
        Animated.timing(translateY, { toValue: -18, duration: 100, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: jumpDist, duration: 80, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [attackTrigger]);

  useEffect(() => {
    if (damageTrigger > 0 && damageTrigger !== lastDamage.current) {
      lastDamage.current = damageTrigger;
      Animated.sequence([
        Animated.timing(translateX, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [damageTrigger]);

  useEffect(() => {
    if (faintTrigger > 0 && faintTrigger !== lastFaint.current) {
      lastFaint.current = faintTrigger;
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 60, duration: 1600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.2, duration: 1600, useNativeDriver: true }),
      ]).start();
    }
  }, [faintTrigger]);

  useEffect(() => {
    if (switchOutTrigger > 0 && switchOutTrigger !== lastSwitchOut.current) {
      lastSwitchOut.current = switchOutTrigger;
      const slideDir = facing === 'front' ? 150 : -150;
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: slideDir, duration: 300, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [switchOutTrigger]);

  const style = { width: size, height: size };

  if (!source) {
    return (
      <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }, { scale }] }}>
        <View style={[styles.placeholder, { width: size, height: size }]}>
          <Text style={styles.placeholderText}>?</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }, { translateY }, { scale }] }}>
      <Image
        source={source}
        style={style}
        contentFit="contain"
        autoplay={true}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
  },
  placeholderText: {
    fontSize: 40,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '700',
  },
});
