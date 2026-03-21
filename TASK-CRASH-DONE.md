# Task: Fix SIGABRT Crash After Gym Win

The app crashes after winning a gym battle → viewing stats → pressing continue. Build 28, crash log attached.

## Crash Details

- Exception: EXC_CRASH (SIGABRT) on Thread 6
- Stack: ObjCTurboModule::performVoidMethodInvocation → objc_exception_rethrow → abort
- This is a React Native TurboModule bridge crash — an ObjC exception during a JS→native call

## Likely Cause

The crash happens in the campaign advance flow after a gym win. The TurboModule call is probably AsyncStorage (saving gym career state) or a notification call with bad data.

Check the full flow after a gym battle win:
1. Battle ends → BattleEndOverlay shows stats
2. Player presses continue → advanceCampaign() is called
3. advanceCampaign → GYM_BEATEN → increments shopBalance → SHOW_SHOP
4. Something in this chain is passing invalid data to a native module

## Things to check:
- Is saveGymCareer() being called with valid data? Could beatenGyms or shopBalance be undefined/null?
- Is the shop phase transition trying to access state that doesn't exist yet?
- Are there any new fields (like beatenGyms array from the resume fix) that might not be initialized for a fresh (non-resumed) game?
- Check if the crash only happens on first gym win or on any gym win
- Add defensive null checks on all AsyncStorage saves in the campaign flow

## Also fix:
- Trailblaze move doesn't boost Speed — the secondary effect (+1 Spe) isn't triggering. Check the move data and secondary effect handler.
- Item descriptions missing in ItemSelectScreen — add long press showing what each item does (effect description). Check if items.json or similar has descriptions.

## After
- `npx vitest run` — all pass
- Commit
- Rename to TASK-CRASH-DONE.md
