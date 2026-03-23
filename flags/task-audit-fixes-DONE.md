# Task: Audit Bug Fixes + Enhancements

Fix all critical and high-priority issues from the codebase audit. Run tests after each fix.

## CRITICAL — Fix Now

### 1. Shop Buy Pool Bug (BattleScreen.tsx lines 183-196)
The `new SeededRNG()` has no seed — shop items shuffle on every re-render.
- Move buy pool generation into state with a stable seed (e.g., use gym index + career state as seed)
- Use `useMemo` with stable dependencies, or generate once in a reducer action

### 2. Remove Debug Console.log (OpponentPanel.tsx lines 38-39)
Remove or gate behind `__DEV__` check.

### 3. Move POWDER_MOVES to Module Level (battle.ts line 1983)
Currently created inside `checkAbilityImmunity()` on every call. Make it a module-level `const`.

### 4. Deduplicate Bot Names
`bot.ts` line 8 and `local-battle.ts` line 34 both define CPU/BOT names. Extract to shared constant.

## HIGH PRIORITY

### 5. Deduplicate SetupScreen CPU/Online
Lines 202-427 (CPU) and 430-615 (Online) are nearly identical. Extract shared `MatchSettingsForm` component.

### 6. Replace Module-Level Dimensions.get
Files: SetupScreen.tsx:23, GymMapScreen.tsx:15, PlayerPanel.tsx:12, OpponentPanel.tsx:13
Replace with `useWindowDimensions()` hook.

### 7. Add expo-haptics
It's already a dependency but never imported. Add haptic feedback to:
- Move selection (light tap)
- Damage dealt (medium impact)
- Pokemon faint (heavy)
- Draft picks

## IMPORTANT
- Run ALL tests after changes (`npx vitest run`)
- Commit with clear message
- Do NOT deploy — just commit
