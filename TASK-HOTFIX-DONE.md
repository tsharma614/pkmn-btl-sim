# Task: v2 Hotfix — 3 Blocking Bugs

Fix these 3 bugs. They break the entire Gym Career flow.

## Bug 1: Budget Draft gets empty roleOptions (BLOCKING)
**File:** `src/client/components/BattleScreen.tsx` line 152
**Problem:** `roleOptions={[]}` with a `// TODO` comment. The BudgetDraftScreen renders with nothing to pick.
**Fix:** Generate proper role options — for each of the 6 roles (Physical Sweeper, Special Sweeper, Tank, Support, Pivot, Wildcard), provide one Pokemon option from each tier (Mega, T1, T2, T3) with reasonable type diversity. Use the existing draft pool / team generation logic to populate these.

## Bug 2: GymMapScreen import mismatch (CRASH)
**File:** `src/client/components/BattleScreen.tsx`
**Problem:** `GymMapScreen` uses `export default` but BattleScreen imports it as a named import `{ GymMapScreen }`. This crashes at runtime.
**Fix:** Either change the export to named (`export function GymMapScreen`) or change the import to default (`import GymMapScreen from './GymMapScreen'`). Be consistent with the rest of the codebase.

## Bug 3: advanceEliteFour dangling reference
**File:** `src/client/components/BattleScreen.tsx` line 595
**Problem:** References `advanceEliteFour` which was removed in the E4 cleanup. Undefined at runtime.
**Fix:** Remove the reference. The E4 flow now goes through the campaign system (`advanceCampaign`), so this old reference is dead code.

## After fixing
- Run `npx vitest run` — all tests must pass
- Manually trace through the Gym Career flow in code: Campaign screen → Budget Draft (verify roleOptions populated) → Move Select → Item Select → Gym Map (verify import works) → Intro Screen → Battle → Back to Gym Map
- Commit with message: "fix: gym career blocking bugs — budget draft options, gym map import, e4 dangling ref"
