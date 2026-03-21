# Task: v2 Critical Fixes — Must ship for TestFlight

The v2 build was reviewed and has critical issues. Fix ALL of these before anything else. This must be TestFlight-ready when done.

Do NOT touch battle screen or online play logic.

---

## CRITICAL FIXES

### 1. Budget Role Draft (NEW SCREEN NEEDED)
The gym career currently reuses the E4 draft screen. This is wrong. Build a new BudgetDraftScreen:
- 6 roles: Physical Sweeper, Special Sweeper, Tank, Support, Pivot, Wildcard
- For each role, show ONE option from each tier: Mega, T1, T2, T3
- Ensure reasonable type diversity across options offered
- Point system: Mega=4, T1=3, T2=2, T3=0 (free)
- Total budget: 15 points
- Display remaining budget clearly
- Disable options that would exceed budget
- Player picks one per role
- After all 6 picked → move select → item select → gym map
- Write real behavioral tests for the budget math

### 2. Gym Map Screen (NEW SCREEN NEEDED)
Currently gyms are fought sequentially. Build a GymMapScreen:
- Show 8 gyms with gym building sprite (brown roof, find one from Showdown or generate simple one)
- Show each gym's type
- Player taps any gym in any order
- Beaten gyms grey out (obvious visual difference)
- After all 8 beaten, transition to E4 screen
- Track which gyms are beaten in campaign state

### 3. E4 Lock Screen (NEW SCREEN NEEDED)
Currently E4 is sequential. Build an E4LockScreen:
- 4 locks + 1 champion lock
- Tap a lock → reveals trainer sprite + tagline → starts battle
- After beating, sprite greys out
- Champion lock unlocks after all 4 E4 beaten
- Player picks order

### 4. Item Select Phase (NEW SCREEN NEEDED)
No item selection exists. Build an ItemSelectScreen:
- Grid of held item icons
- Long press and hold to see item details (same pattern as move details)
- One item per Pokemon
- Shows after move selection in gym career flow

### 5. Fix Gauntlet Steal — Use Actual Opponent Team
In `battle-context.tsx`, `advanceCampaign()` calls `generateGauntletTeam()` again for the steal pool. Instead, store the actual opponent team when the battle starts (in `beginCampaignBattle`) and pass THAT to the steal screen.

### 6. Fix 999 Progress Dots
`CampaignIntroScreen` renders `totalStages` dots. For gauntlet, `totalStages=999` which renders 999 dots. Fix: for gauntlet, don't show progress dots. Show the battle number as text instead (e.g. "Battle #7").

### 7. Fix Campaign Progress Parsing
In `StatsScreen.tsx`, the regex `replace(/\D/g, '')` turns "Stage 3/13" into "313". Fix: parse the number before the slash for gym career, or store the stage number as a separate numeric field in the campaign run data.

### 8. Remove Old E4 Easter Egg Fully
- Remove `startEliteFour` function from battle-context.tsx
- Remove E4 unlock logic from StatsScreen
- Remove "Unlocked as an easter egg" comment from elite-four.ts
- Keep the E4 data (names, teams) since campaign uses them
- Make sure no UI path leads to the old E4 flow

---

## MEDIUM FIXES

### 9. Fix Trainer Name Desync
SetupScreen reads from `@pbs_trainer_name`, StatsScreen profile reads from `@pbs_profile`. Unify: read the trainer name from the profile storage everywhere. Remove the old `@pbs_trainer_name` key or migrate it on first load.

### 10. Fix Gauntlet Win Recording
Currently `saveCampaignRun` with `result: 'win'` is called after EACH gauntlet battle win. Only save one campaign run entry per gauntlet run — save on loss (run over) with the total battles won as the progress.

### 11. Fix Restart = Abandoned Loss
In `CampaignScreen.tsx`, `handleRestart` doesn't count the abandoned run as a loss. Add: before clearing the save, call `saveCampaignRun` with `result: 'loss'` and current progress.

### 12. Fix Duplicate Code in moveSelectionComplete
In `battle-context.tsx`, after the gauntlet early-return, there's a duplicate block that re-declares `local` and `conn` and re-runs `updateHumanTeam`/emit. Remove the duplicate.

### 13. Add Gen 9 Starters
Add to `starters.ts`: Meowscarada, Skeledirge, Quaquaval

---

## TEST FIXES

### 14. Fix Gym Tier Composition Test
In `campaign-teams.test.ts`, the gym team test asserts `megaCount >= 0` which always passes. Fix to assert exact counts: `megaCount === 1`, `t1Count === 1`, `t2Count === 2`, `t3Count === 2`.

### 15. Write Real Behavioral Tests
Replace source-string grep tests with real behavioral tests where possible:
- Budget draft: test 15-point cap, T3=0, can't exceed budget, various valid/invalid combos
- Campaign heal: create a damaged team, run heal function, verify all fields reset (HP, PP, status, boosts, volatile statuses)
- Campaign save: test real `saveGymCareer`/`getGymCareerSave` functions with mocked AsyncStorage
- Gauntlet steal: test team size cap at 6, drop-one-pick-one logic
- Gauntlet mid-range scaling: test battles 4-11 for gradual T3→T1 progression

### 16. Fix Redundant require()
In `BattleEndOverlay.tsx` line 290, remove the inline `require('../utils/stats-storage')` — it's already imported at the top.

---

## AFTER ALL FIXES

- Run full test suite: `npx vitest run` — ALL tests must pass
- Build the iOS app to verify no compile errors:
  ```
  cd ios && pod install && cd ..
  npx expo export --platform ios
  ```
- Increment version to 2.0 and bump build number to 20
- Commit everything

---

## Important
- Do NOT modify battle screen or online play logic
- Write thorough tests for ALL new screens/logic
- Commit after each major fix (don't do one giant commit)
- This MUST be TestFlight-ready when done
