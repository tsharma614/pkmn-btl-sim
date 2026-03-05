import React, { useEffect, useRef, useState } from 'react';
import { Image, Animated, ImageStyle, View, Text, StyleSheet } from 'react-native';

interface Props {
  speciesId: string;
  facing: 'front' | 'back';
  size?: number;
  /** Increment to trigger attack animation */
  attackTrigger?: number;
  /** Increment to trigger damage shake animation */
  damageTrigger?: number;
  /** Increment to trigger faint animation (fade + shrink + drop) */
  faintTrigger?: number;
  /** Increment to trigger switch-out animation (slide off screen) */
  switchOutTrigger?: number;
}

/**
 * Convert our pokedex ID to Showdown sprite ID.
 * Regional forms: 'raichualola' → 'raichu-alola'
 */
function toSpriteId(id: string): string {
  const suffixes = ['alola', 'galar', 'hisui', 'paldea'];
  for (const suffix of suffixes) {
    if (id.endsWith(suffix) && id.length > suffix.length) {
      return id.slice(0, -suffix.length) + '-' + suffix;
    }
  }
  return id;
}

/**
 * Build sprite URL with fallback chain:
 * 1. ani/ (high-quality 3D animated GIF, Gen 1-7 + some Gen 8-9)
 * 2. gen5ani/ (BW-style pixel animated GIF)
 * 3. home/ (Pokemon HOME sprites — covers ALL gens including Gen 9 Paradox)
 */
function getSpriteUrls(speciesId: string, facing: 'front' | 'back'): string[] {
  const spriteId = toSpriteId(speciesId);
  const backSuffix = facing === 'back' ? '-back' : '';
  return [
    `https://play.pokemonshowdown.com/sprites/ani${backSuffix}/${spriteId}.gif`,
    `https://play.pokemonshowdown.com/sprites/gen5ani${backSuffix}/${spriteId}.gif`,
    `https://play.pokemonshowdown.com/sprites/home/${spriteId}.png`,
  ];
}

export function PokemonSprite({ speciesId, facing, size = 120, attackTrigger = 0, damageTrigger = 0, faintTrigger = 0, switchOutTrigger = 0 }: Props) {
  const urls = getSpriteUrls(speciesId, facing);

  const [urlIndex, setUrlIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const lastIdRef = useRef(speciesId);

  const uri = urls[urlIndex];

  // Reset failed state and animations when species changes (new Pokemon sent out)
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  if (speciesId !== lastIdRef.current) {
    lastIdRef.current = speciesId;
    setUrlIndex(0);
    setAllFailed(false);
    // Reset position
    translateY.setValue(0);
    translateX.setValue(0);

    // Animate in: fade + scale up for a "send out" effect
    opacity.setValue(0);
    scale.setValue(0.6);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();
  }

  const handleImageError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex(prev => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const lastAttack = useRef(0);
  const lastDamage = useRef(0);
  const lastFaint = useRef(0);
  const lastSwitchOut = useRef(0);

  // Attack: quick hop forward
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

  // Damage: shake horizontally
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

  // Faint: slow fade out, shrink, and drop — dramatic death
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

  // Switch out: quick red flash + slide sideways off screen
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

  const style: ImageStyle = { width: size, height: size };

  if (allFailed) {
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
        source={{ uri }}
        style={style}
        resizeMode="contain"
        onError={handleImageError}
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
