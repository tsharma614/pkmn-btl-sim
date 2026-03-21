# Task: Fix Animated GIF Rendering on iOS

React Native's Image component can't animate GIFs on iOS — only shows first frame. Need to use expo-image instead.

## Fix

1. Install: `npx expo install expo-image`
2. In PokemonSprite.tsx, replace `import { Image } from 'react-native'` with `import { Image } from 'expo-image'`
3. expo-image is a drop-in replacement — same `source` and `style` props
4. It handles animated GIFs natively on both iOS and Android

## Also fix
- Player Pokemon (bottom, facing='back') should use ani-back-sprite-map GIFs
- Opponent Pokemon (top, facing='front') should use ani-sprite-map GIFs
- Verify BattleScreen passes animated={true} to both OpponentPanel and PlayerPanel sprites
- Static PNGs stay as fallback for UI screens (draft, modals, etc.)

## Also fix stat labels
- SPD and SPE labels getting truncated in PokemonDetailModal
- Make stat label column wider or use abbreviations that fit (Sp.D, Sp.A, Spe)

## DO NOT deploy. Just commit. Tanmay will say when to deploy.

## After
- `npx vitest run` — all pass
- Commit only
- Rename to TASK-GIF-FIX-DONE.md
