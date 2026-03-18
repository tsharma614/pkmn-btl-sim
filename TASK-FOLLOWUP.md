# Task: Follow-up Fixes from Review

Two issues found during code review. Fix both.

---

### 1. Gym Teams — Sparse Type Pools

The gym team generator filters by type correctly, but some types (Normal, Ice, Bug, etc.) may not have enough Pokemon across tiers to fill a 6-mon team. If a type-filtered pool is too small, the team will be undersized.

Fix: if the type-filtered pool can't fill 6 slots, relax the constraint — require at least 4/6 to match the gym type, fill remaining 2 from adjacent types or unfiltered pool. Log a warning when this happens.

Write a test that generates gym teams for ALL 18 types and asserts:
- Every team has exactly 6 Pokemon
- At least 4/6 match the gym type
- No crashes or empty teams

### 2. Double Loss Bug — Race Condition

`saveCampaignRun` is called in BattleEndOverlay on loss AND in `returnToMenu` with a guard (`phase !== 'battle_end'`). If there's any async delay where phase hasn't updated to `battle_end` when returnToMenu fires, you get both a loss AND an abandoned entry.

Fix: don't rely on phase timing. Add a flag like `campaignRunSaved` ref that gets set to true after the first save. Check it before any subsequent save. Reset it when starting a new campaign battle.

Write a test that simulates losing a battle and then returning to menu, and asserts only ONE campaign run entry is saved (not two).

---

## After fixes
- `npx vitest run` — all tests pass
- Commit
