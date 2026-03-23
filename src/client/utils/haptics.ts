import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS !== 'web';

export function lightTap() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function mediumImpact() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function heavyImpact() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}
