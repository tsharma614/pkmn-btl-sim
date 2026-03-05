import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '../theme';
import type { EventMessage } from '../hooks/use-event-queue';

interface Props {
  messages: EventMessage[];
}

export function EventLog({ messages }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (messages.length === 0) return;
    // Flash in new message
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [messages.length]);

  if (messages.length === 0) return null;

  const lastMsg = messages[messages.length - 1];

  return (
    <Animated.View style={[styles.container, { opacity }]}>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  text: {
    color: colors.text,
    fontSize: 14,
  },
  bold: {
    fontWeight: '800',
    color: colors.accent,
  },
  italic: {
    fontStyle: 'italic',
  },
});
