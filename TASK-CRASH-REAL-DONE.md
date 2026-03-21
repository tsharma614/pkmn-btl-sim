# Task: FIX THE GYM WIN CRASH — THIRD ATTEMPT

The app crashes EVERY TIME after winning a gym battle. This has persisted through builds 28, 29, and 30. Previous "fixes" did not work.

THIS IS THE #1 PRIORITY. NOTHING ELSE MATTERS UNTIL THIS IS FIXED.

## Crash Details

- Exception: EXC_BAD_ACCESS (SIGSEGV) — null pointer dereference
- Thread: Hermes JS runtime thread (Thread 2)
- Stack: drainMicrotasks → RuntimeScheduler → runEventLoop
- Trigger: immediately after gym battle win, during screen transition

This is a React Native JS execution crash. NOT an AsyncStorage bug, NOT a gesture recognizer bug. The JS thread is hitting a null reference during the battle end → campaign advance → screen transition.

## What's happening

After a gym battle win:
1. BattleEndOverlay shows stats
2. Player presses "Continue"
3. advanceCampaign() is called
4. This dispatches GYM_BEATEN, updates state, saves gym career
5. Then dispatches SHOW_SHOP (or SHOW_GYM_MAP if shop is skipped)
6. BattleScreen renders the new phase (ShopScreen or GymMapScreen)
7. **CRASH** — something in step 4-6 creates a null reference that the JS engine hits

## Root cause investigation

The crash is in the Hermes JS engine's microtask queue. This means a Promise or async callback is firing with stale/null state. Likely causes:

1. **advanceCampaign dispatches multiple actions rapidly** — GYM_BEATEN + saveGymCareer + SHOW_SHOP in quick succession. React batching may cause intermediate renders with inconsistent state.

2. **A component tries to read state that was cleared** — e.g., BattleScreen tries to access battle state that's been reset by advanceCampaign

3. **An async callback (setTimeout, animation, Promise) fires after the component unmounts** — the battle animations may still have pending callbacks when the screen transitions

## Fix approach

DO NOT just add a setTimeout delay. That doesn't fix the root cause.

1. Find every `dispatch` call in `advanceCampaign()` — are there multiple dispatches? Batch them into a SINGLE dispatch with a combined action type.

2. Check if BattleEndOverlay or BattleScreen has any useEffect cleanup that's missing. Every setTimeout, setInterval, Animated.timing, and Promise should be cleaned up on unmount.

3. Check if the phase transition causes a render of BattleScreen with phase='shop' while battle state (opponent team, battle events, etc.) has been cleared. The shop/gym map components may try to read cleared data.

4. Add null checks EVERYWHERE in the render path during transitions — especially in components that read from stateRef.current, campaignPlayerTeamRef, or battle state.

5. Test by playing a full gym battle → winning → pressing Continue at least 5 times. It must not crash even once.

## Verification

- Play gym career, win a gym battle, press Continue
- Must NOT crash
- Do this 5 times to confirm reliability
- `npx vitest run` — all tests pass
- Then deploy to TestFlight

## ALSO FIX: Screenshots from playtest that were ignored

### Stat bars too small/unclear
The base stat bars in PokemonDetailModal are hard to read. Make them taller, wider, with clearer number labels. The current bars are thin and the numbers blend in.

### Item details still not showing during item select
The item select screen was supposed to show item descriptions on long press. Verify this actually works on device — previous "fix" may not have shipped correctly. Every item needs a description visible.

### Move details page needs ability description
On the PICK MOVES screen, the ability name shows (e.g. "Protean") but there's no description of what it does. This was supposedly fixed but the screenshot shows it's still just the name with no explanation. Add the shortDesc inline, visible without long press.

### Left/right cycling arrows
The cycling arrows in PokemonDetailModal were supposedly added but are NOT visible on device. Verify they render, are tappable, and work on every screen.

## After
- Commit
- Deploy following standard deploy steps (prebuild, archive, export with API key)
- Email sharma.tanmay2000@gmail.com with what was wrong and how it was fixed
- Rename to TASK-CRASH-REAL-DONE.md
