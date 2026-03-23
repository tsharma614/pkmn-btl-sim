# Fix Gym Career Mode Silent Crash

## Bug
Starting gym career mode causes a silent crash (app closes, no crash log).

## Root Cause
6 calls to `saveGymCareer()` in `src/client/state/battle-context.tsx` are NOT awaited. `saveGymCareer` is async (writes to AsyncStorage). Without await, any storage error becomes an unhandled Promise rejection = silent SIGABRT.

## Fixes Required

### battle-context.tsx — Add await + try-catch to all 6 saveGymCareer calls:

1. `itemSelectComplete` (lines ~787-796) — PRIMARY CRASH PATH
2. `shopDone` (lines ~847-856)
3. `saveAndQuit` (lines ~863-868)
4. `returnToMapAfterLoss` (lines ~946-954)
5. `beginCampaignBattle` gym win path (lines ~536-554)
6. `beginCampaignBattle` E4 win path (lines ~564-581)

For each: wrap in try-catch, await the call, log errors with console.error.

Example fix pattern:
```typescript
// BEFORE (crashes silently):
saveGymCareer(saveData);
dispatch({ type: 'SHOW_GYM_MAP' });

// AFTER (safe):
try {
  await saveGymCareer(saveData);
} catch (e) {
  console.error('Failed to save gym career:', e);
}
dispatch({ type: 'SHOW_GYM_MAP' });
```

Make sure the containing functions are marked `async` if they aren't already.

### CampaignScreen.tsx — Wrap JSON.parse in try-catch:

Line ~40:
```typescript
// BEFORE:
if (raw) setSave(JSON.parse(raw));

// AFTER:
if (raw) {
  try {
    setSave(JSON.parse(raw));
  } catch (e) {
    console.error('Corrupted gym save, resetting:', e);
    await AsyncStorage.removeItem(GYM_SAVE_KEY);
  }
}
```

### battle-context.tsx — Add try-catch around gymCareerDraftComplete throw:

Line ~739: Wrap the `throw new Error` in a try-catch or handle gracefully.

## After Fix
- Commit with message: "fix: await saveGymCareer calls to prevent silent crash"
- Do NOT deploy — just commit. We'll deploy after testing.
