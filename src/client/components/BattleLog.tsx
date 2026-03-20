import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { colors, spacing } from '../theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const LOG_HEIGHT = SCREEN_HEIGHT * 0.55;

interface Props {
  visible: boolean;
  lines: string[];
  onClose: () => void;
}

export function BattleLog({ visible, lines, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Auto-scroll to bottom when new lines appear
  useEffect(() => {
    if (visible && scrollRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [lines.length, visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LOG_HEIGHT, 0],
  });

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Battle Log</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          {lines.length === 0 ? (
            <Text style={styles.empty}>No events yet.</Text>
          ) : (
            lines.map((line, i) => {
              const isTurnHeader = line.startsWith('---');
              const isIndented = line.startsWith('  ');
              return (
                <Text
                  key={i}
                  style={[
                    styles.line,
                    isTurnHeader && styles.turnHeader,
                    isIndented && styles.indentedLine,
                  ]}
                >
                  {line}
                </Text>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    height: LOG_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    color: colors.textDim,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
  empty: {
    color: colors.textDim,
    fontSize: 13,
    fontStyle: 'italic',
  },
  line: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  turnHeader: {
    color: colors.accent,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 2,
  },
  indentedLine: {
    color: colors.textSecondary,
  },
});
