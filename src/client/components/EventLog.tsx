import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, shadows } from '../theme';
import type { EventMessage } from '../hooks/use-event-queue';

interface Props {
  messages: EventMessage[];
}

export function EventLog({ messages }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (messages.length === 0) return;
    // Fade-in + slide-up on new message
    opacity.setValue(0);
    translateY.setValue(6);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [messages.length]);

  if (messages.length === 0) return null;

  const lastMsg = messages[messages.length - 1];

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.inner}>
        <Text style={styles.text} numberOfLines={2}>
          {lastMsg.segments.map((seg, i) => (
            <Text
              key={i}
              style={[
                seg.bold && styles.bold,
                seg.italic && styles.italic,
                seg.color ? { color: seg.color } : undefined,
              ]}
            >
              {seg.text}
            </Text>
          ))}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  inner: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    ...shadows.sm,
  },
  text: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '800',
    color: colors.white,
  },
  italic: {
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
});
