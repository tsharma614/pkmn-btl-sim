# Task: Fix ALL Crash-Prone Patterns + Item Sprites + Menu Background

This is a CRITICAL task. Every fix must be reviewed line by line. Run all tests after each fix.

## ALREADY DONE (in working tree, just commit):
- `src/client/item-sprite-map.ts` — new file, maps item names to sprite assets
- `assets/sprites/items/` — 24 item sprite PNGs downloaded
- `src/client/components/ItemSelectScreen.tsx` — item sprites on buttons + detail modal
- `src/engine/battle.ts` — White Herb fix (restores ALL lowered stats, not just first) + checkWhiteHerb after Intimidate
- `src/client/components/SetupScreen.tsx` — old menu background restored (21 sprites, 7x3 grid)

Just commit these as-is. Do NOT modify them.

## NEW: Fix All 8 Crash-Prone Patterns

Every fix follows the same pattern: add mounted ref guard + cleanup function. Be EXACT.

### Fix 1: MoveSelectionScreen.tsx (line ~150)
**Bug:** setTimeout called directly in render body (not in useEffect). Fires every render.
**Fix:** Move the auto-select logic into a useEffect with proper dependencies:
```typescript
useEffect(() => {
  if (!moveSelections[currentIdx] && pokemon.moves.length > 0) {
    const defaultMoves = pokemon.moves.slice(0, 4).map(m => m.name);
    const available = new Set(allMoves.map(m => m.name));
    const validDefaults = defaultMoves.filter(m => available.has(m));
    if (validDefaults.length > 0) {
      setMoveSelections(prev => ({
        ...prev,
        [currentIdx]: validDefaults.slice(0, 4),
      }));
    }
  }
}, [currentIdx]);
```
Remove the setTimeout entirely. No timer needed — useEffect handles it.

### Fix 2: battle-context.tsx (lines ~256, ~277, ~297)
**Bug:** 3 setTimeout calls in selectMove, selectSwitch, selectForceSwitch — no cleanup, no mount guard.
**Fix:** Add mountedRef check inside each setTimeout. Track timeout IDs and clear on unmount.
The file already has a mountedRef from the previous crash fix. Use it:
```typescript
const timer = setTimeout(() => {
  if (!mountedRef.current) return;
  local.submitAction({ type: 'move', index: moveIndex });
  actionPendingRef.current = false;
}, 50);
```
Add each timer to the existing timeout tracking set if one exists, or create a new ref for these.

### Fix 3: CampaignScreen.tsx (line ~37)
**Bug:** AsyncStorage.getItem().then() calls setState without mount guard.
**Fix:**
```typescript
useEffect(() => {
  let mounted = true;
  AsyncStorage.getItem(GYM_SAVE_KEY).then(raw => {
    if (!mounted) return;
    if (raw) setSave(JSON.parse(raw));
    setLoaded(true);
  });
  return () => { mounted = false; };
}, []);
```

### Fix 4: SetupScreen.tsx (line ~105)
**Bug:** getProfile().then() async chain calls setState without mount guard.
**Fix:**
```typescript
useEffect(() => {
  let mounted = true;
  getProfile().then(async (profile) => {
    if (!mounted) return;
    if (profile.trainerName && profile.trainerName !== 'Player') {
      setName(profile.trainerName);
    } else {
      const oldName = await AsyncStorage.getItem(OLD_NAME_KEY);
      if (!mounted) return;
      if (oldName) {
        setName(oldName);
        await saveProfile({ trainerName: oldName });
        if (!mounted) return;
        await AsyncStorage.removeItem(OLD_NAME_KEY);
      }
    }
  });
  return () => { mounted = false; };
}, []);
```

### Fix 5: StatsScreen.tsx (line ~63)
**Bug:** 4 parallel promises all call setState without mount guard. Highest crash probability.
**Fix:**
```typescript
useEffect(() => {
  let mounted = true;
  Promise.all([
    getProfile(),
    getOverallStats(),
    getTopPokemonByKOs(10),
    getCampaignRuns(),
  ]).then(([p, overall, topPokemon, runs]) => {
    if (!mounted) return;
    setProfile(p);
    setNameInput(p.trainerName);
    setOverall(overall);
    setTopPokemon(topPokemon);
    setCampaignRuns(runs);
  });
  return () => { mounted = false; };
}, []);
```

### Fix 6: BattleEndOverlay.tsx (line ~301)
**Bug:** earnBadge().then() calls setNewBadge without mount guard.
**Fix:** Add `let mounted = true` to the existing useEffect, add `if (!mounted) return` before setNewBadge, add cleanup `return () => { mounted = false; }`.

### Fix 7: BattleLog.tsx (line ~35)
**Bug:** setTimeout without clearTimeout in cleanup.
**Fix:**
```typescript
useEffect(() => {
  if (visible && scrollRef.current) {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }
}, [lines.length, visible]);
```

### Fix 8: BattleEndOverlay.tsx (line ~502)
**Bug:** InteractionManager.runAfterInteractions in onPress without cleanup.
**Fix:** Remove the InteractionManager wrapper. Just call onReturnToMap() directly. The InteractionManager was added as a "fix" but it actually makes things worse by delaying execution past unmount.

## IMPORTANT RULES
- Do NOT change any game logic, UI layout, or feature behavior
- ONLY add mount guards and cleanup functions
- Run `npx vitest run` after ALL fixes and verify 1206+ tests pass
- Commit everything in ONE commit with a clear message
- Do NOT deploy — just commit

## After
- All tests pass
- Rename to TASK-CRASH-AUDIT-DONE.md
