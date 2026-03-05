import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BattleProvider } from './src/client/state/battle-context';
import { BattleScreen } from './src/client/components/BattleScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <BattleProvider>
        <StatusBar style="light" />
        <BattleScreen />
      </BattleProvider>
    </SafeAreaProvider>
  );
}
