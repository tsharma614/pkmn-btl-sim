# Task: v2 Hotfix 2 — Gym Career Flow Broken

## Bug 1: Gym Career skips move selection (CRITICAL)
**Problem:** `GYM_CAREER_START` in the reducer resets state to `initialState` which has `moveSelection: false`. So when `DRAFT_COMPLETE` fires after budget draft, it sends players to `team_preview` instead of `move_selection`. Players never pick their moves.
**Fix:** In the `GYM_CAREER_START` reducer action, set `moveSelection: true` so the flow goes budget draft → move selection → item selection → gym map.

## Bug 2: Item select phase is dead code (CRITICAL)
**Problem:** `item_select` phase is declared in the reducer but has no UI rendering in BattleScreen.tsx and no dispatch triggers it. Players never pick items.
**Fix:**
- After move selection completes in gym career mode, dispatch to `item_select` phase
- In BattleScreen.tsx, add rendering for the `item_select` phase that shows ItemSelectScreen
- After item selection completes, transition to `gym_map` phase
- Wire up the full chain: budget draft → move select → item select → gym map

## Bug 3: Build number wrong
**File:** `app.json`
**Fix:** Change buildNumber from "20" to "1". This is v2.0 build 1.

## Bug 4: package.json version mismatch
**File:** `package.json`
**Fix:** Change version from "1.0.0" to "2.0.0" to match app.json.

## Cleanup (while you're at it)
- Remove dead `onAdvanceEliteFour` prop from BattleEndOverlay interface
- Remove stale TODO comment on battle-context.tsx line 308
- Remove old E4 actions from reducer that are now dead code: `E4_DRAFT_START`, `E4_ADVANCE`, `elite_four_draft`/`elite_four_intro` phases

## After fixing
- Run `npx vitest run` — all tests must pass
- Trace the FULL gym career flow through code one more time:
  Budget Draft → Move Select → Item Select → Gym Map → Battle → repeat
- Verify each transition dispatches the correct action and renders the correct screen
- Commit: "fix: gym career move/item select flow, version bump to v2.0 build 1"
