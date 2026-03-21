# Task: Gym Career Shop

Build a shop that appears after each gym/E4 win. Uses the same point currency as the budget draft.

---

## Economy

- **Draft budget: 14 pts** — any unspent points carry over as shop currency
- **Gym win: +1 pt**
- **E4 win: +2 pts**
- Track `shopBalance` in campaign state. Initialize to `14 - draftSpent` after budget draft.
- Persist shopBalance in gym career save (saveGymCareer / getGymCareerSave)

## Shop Screen (new: ShopScreen.tsx)

Appears after every gym or E4 win, before returning to gym map / E4 locks. Player can skip without buying.

**Three options:**

### 1. Swap Move — 1 pt
- Player picks a Pokemon from their team
- Player picks a move slot to replace
- Shows all legal moves for that Pokemon (from its learnset in pokedex data)
- Player picks the new move
- Move gets swapped

### 2. Swap Item — 1 pt
- Player picks a Pokemon from their team
- Shows full item pool (same as ItemSelectScreen)
- Player picks a new item
- Item gets swapped on that mon

### 3. Buy Pokemon — same costs as draft (Mega=4, T1=3, T2=2)
- Show a pool of available Pokemon: mix of Megas, T1, T2 (generate fresh pool each time, ~12 options)
- Player picks one to buy
- Player picks which of their 6 team members to swap out
- The bought Pokemon replaces that slot (with default moves/item, or let player pick moves+item immediately)
- The swapped-out Pokemon is gone

## UX

- Display balance at top: "X pts"
- Three big buttons for the three options
- Each option expands into the selection flow
- "Done Shopping" button always visible
- Disable options the player can't afford
- Long press on any Pokemon shows PokemonDetailModal (reuse existing component)
- Long press on any item shows item details (reuse ItemSelectScreen's long press pattern)
- Long press on any move shows move details (type, power, accuracy, PP, effect)

## Phase Flow

Current: gym win → advanceCampaign → GYM_BEATEN → SHOW_GYM_MAP
New: gym win → advanceCampaign → GYM_BEATEN → **SHOW_SHOP** → SHOW_GYM_MAP

Same for E4: e4 win → E4_MEMBER_BEATEN → **SHOW_SHOP** → SHOW_E4_LOCKS

Add new reducer actions:
- `SHOW_SHOP` — sets phase to `shop`, increments balance by payout
- `SHOP_DONE` — sets phase to `gym_map` or `e4_locks` depending on stage

Don't show shop after champion win (game is over).

## State Changes

- Add to campaign state: `shopBalance: number`
- Add to gym career save: `shopBalance`
- When buying a Pokemon, update `campaignPlayerTeamRef` and the saved team
- When swapping moves/items, update the team in place

## Tests

### Shop tests
- Budget rollover: draft spending 10 of 14 → shopBalance starts at 4
- Gym payout: shopBalance increases by 1 after gym win
- E4 payout: shopBalance increases by 2 after E4 win
- Can't buy what you can't afford (disable options, reject purchase)
- Swap move actually changes the move on the Pokemon
- Swap item actually changes the item
- Buy Pokemon replaces the correct team slot
- Buy Pokemon costs match draft costs (Mega=4, T1=3, T2=2)
- Shop phase appears after gym win but before gym map
- Shop phase appears after E4 win but before E4 locks
- Shop does NOT appear after champion win
- shopBalance persists in gym career save/load

### Regression tests (CRITICAL — these bugs existed before, never break them again)
- Campaign battles use pre-built teams from battle-context, NOT regenerated in local-battle
  - Generate a gym team with generateGymTeam('Fire'), pass it as campaignOpponentTeam, verify the battle uses THAT exact team (check species match)
  - Generate a gauntlet team for battle 0, verify it has exactly 1 Pokemon (not 6)
  - Generate a gauntlet team for battle 0, verify it's T3/T4 tier (not legends)
- Gym teams match their gym type: for each of the 18 types, generate a gym team and verify at least 4/6 Pokemon have that type
- No double loss recording: simulate a battle loss followed by returnToMenu, verify saveCampaignRun is called exactly once
- Budget draft enforces 14 point cap (not 15)

## Save & Quit

Add a "Save & Quit" button to:
- **GymMapScreen** — saves current progress (beaten gyms, team, shopBalance) and returns to main menu
- **E4LockScreen** — same thing (beaten E4 members, team, shopBalance)

On next launch, CampaignScreen should detect the save and show a "Resume" option that drops you back into gym map or E4 locks with your full state restored. This already partially works via getGymCareerSave — just make sure the resume flow restores beaten gyms/E4, shopBalance, and team correctly.

Do NOT save mid-battle. Only from gym map or E4 locks.

## E2E Tests

Write headless end-to-end tests that drive the reducer + context through full flows. No UI rendering — just state transitions and assertions. Put in tests/e2e/.

### Core flows
1. **Normal battle** — draft → team preview → battle → win/loss recorded in stats
2. **Online battle flow** — room create → opponent joins → draft → battle → rematch

### Campaign flows
3. **Full gym career** — draft cheap (bank pts) → gym win → shop opens → buy upgrade → beat all 8 → E4 → champion → win saved in stats
4. **Full gauntlet** — pick starter → item select → battle 1 (1v1 T3) → win → steal → team grows → scaling correct through run
5. **Campaign loss + restart** — lose gym battle → loss recorded once → restart → fresh draft
6. **Campaign abandon** — mid-run exit from gym map → abandoned recorded → save cleared
7. **Save & resume** — beat 3 gyms → save & quit → resume → verify beaten gyms, team, shopBalance all intact

### Shop economy flows
8. **Budget rollover** — draft 10/14 → 4pts banked → verify shopBalance = 4
9. **Full shop cycle** — win gym (+1pt) → shop opens → buy T2 mon (2pts) → verify balance, team updated
10. **Move/item swap persistence** — swap move in shop → next battle uses new move → swap item → verify item on mon

### Regression flows (CRITICAL)
11. **Campaign teams passthrough** — gym team generated with type, passed to local-battle, verify exact team used (not regenerated)
12. **Gauntlet scaling** — battle 0 = 1v1 T3, battle 5 = 6v legends, verify at each step
13. **Gym type enforcement** — all 18 types, at least 4/6 match
14. **No double loss** — lose battle → return to menu → only 1 loss in stats
15. **Budget cap** — can't exceed 14 in draft

## After

- `npx vitest run` — all pass
- Commit
- Rename this to TASK-SHOP-DONE.md
