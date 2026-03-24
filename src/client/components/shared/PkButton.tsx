import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, shadows } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  subtitle?: string;
  variant?: Variant;
  size?: Size;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const sizeConfig = {
  sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 13, subSize: 10 },
  md: { paddingVertical: 14, paddingHorizontal: 24, fontSize: 16, subSize: 11 },
  lg: { paddingVertical: 18, paddingHorizontal: 32, fontSize: 20, subSize: 12 },
};

export function PkButton({
  title,
  subtitle,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  style,
  textStyle,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const sc = sizeConfig[size];

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const variantStyle = variantStyles[variant];
  const variantTextStyle = variantTextStyles[variant];
  const glowStyle = variant === 'primary' ? shadows.glow(colors.primary) : {};

  return (
    <Animated.View style={[{ transform: [{ scale }] }, glowStyle, style]}>
      <TouchableOpacity
        style={[
          styles.base,
          variantStyle,
          { paddingVertical: sc.paddingVertical, paddingHorizontal: sc.paddingHorizontal },
          disabled && styles.disabled,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <Text style={[variantTextStyle, { fontSize: sc.fontSize }, textStyle]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { fontSize: sc.subSize }]}>
            {subtitle}
          </Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '600',
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const variantTextStyles = StyleSheet.create({
  primary: {
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 2,
  },
  secondary: {
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 2,
  },
  ghost: {
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
