import { Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export function lightTap() {
  try {
    if (Platform.OS !== 'web') {
      ReactNativeHapticFeedback.trigger('impactLight', options);
    }
  } catch (_) {
    // Never crash the app for haptics
  }
}

export function mediumImpact() {
  try {
    if (Platform.OS !== 'web') {
      ReactNativeHapticFeedback.trigger('impactMedium', options);
    }
  } catch (_) {
    // Never crash the app for haptics
  }
}

export function heavyImpact() {
  try {
    if (Platform.OS !== 'web') {
      ReactNativeHapticFeedback.trigger('impactHeavy', options);
    }
  } catch (_) {
    // Never crash the app for haptics
  }
}
