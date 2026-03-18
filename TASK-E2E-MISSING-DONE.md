# Task: Add Missing E2E Tests

5 e2e tests are missing from tests/e2e/campaign-flows.test.ts. Add them.

## Missing Tests

### 1. Normal battle flow
Draft pool generated → player picks team → team preview → battle runs → winner determined → result saved in stats via saveCampaignRun or stats-storage

### 2. Online battle flow
Room created → opponent joins → draft → battle → rematch option. This can be a state-only test driving the reducer through ROOM_CREATED → TEAM_PREVIEW → battle phases → BATTLE_END → PLAY_AGAIN.

### 3. Move/item swap persistence in shop
- Start gym career, draft team
- Record what moves/items a Pokemon has
- Dispatch SHOW_SHOP, call shopSwapMove to change a move on Pokemon 0
- Call shopSwapItem to change the item on Pokemon 0
- Dispatch SHOP_DONE
- Verify the team in state has the NEW move and NEW item, not the originals

### 4. Campaign teams passthrough regression
This is CRITICAL — the bug where local-battle.ts ignored pre-built campaign teams.
- Generate a gym team with generateGymTeam(rng, 'Fire')
- Verify every Pokemon in the returned team actually has Fire as one of its types (at least 4/6)
- Generate a gauntlet team for battle 0 with generateGauntletTeam(rng, 0)
- Verify it has exactly 1 Pokemon and it's T3/T4 tier
- Check that the LocalBattleOptions interface has campaignPlayerTeam and campaignOpponentTeam fields
- Check that battle-context.tsx beginCampaignBattle passes campaignPlayerTeam and campaignOpponentTeam (not eliteFourStage)

### 5. No double loss regression
- Read battle-context.tsx source
- Verify campaignRunSavedRef exists
- Verify returnToMenu checks campaignRunSavedRef.current before saving
- Verify beginCampaignBattle resets campaignRunSavedRef to false

## After
- `npx vitest run` — all pass
- Commit
- Rename to TASK-E2E-MISSING-DONE.md
