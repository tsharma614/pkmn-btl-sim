# Task: Similar Bug Audit + Detail Modal Cycling + Item Descriptions

---

## 1. Audit for Similar Crash Bugs

The SIGABRT crash was caused by stale state being saved to AsyncStorage during campaign transitions. Search the ENTIRE codebase for similar patterns:

- Any place where saveGymCareer() is called — is the data being saved AFTER the dispatch updates state, or BEFORE (stale)?
- Any place where AsyncStorage is written with potentially null/undefined fields
- Any place where campaign state (beatenGyms, beatenE4, shopBalance, team) could be accessed before initialization
- Any TurboModule/native bridge calls that could receive unexpected data types
- Check ALL reducer dispatches in advanceCampaign, beginCampaignBattle, returnToMenu, saveAndQuit — are they accessing stale stateRef.current before or after dispatches?

Fix every instance you find. Don't just fix the one crash — prevent the whole category.

## 2. Cycle Through Pokemon in Detail Modal

When the PokemonDetailModal is open (during item select, move select, budget draft, shop, steal screen, team preview), add left/right navigation to cycle through all Pokemon without closing the modal.

- Add < and > arrows (or swipe left/right) in the modal
- Pass the full team/pool array + current index to the modal
- Tapping < shows previous Pokemon, > shows next
- Works EVERYWHERE PokemonDetailModal is used:
  - BudgetDraftScreen — cycle through all options in a role (4 per role)
  - MoveSelectionScreen — cycle through all 6 Pokemon while picking moves
  - ItemSelectScreen — cycle through all 6 Pokemon while assigning items
  - GauntletStarterScreen — cycle through all starter options
  - GauntletStealScreen — cycle through opponent's team
  - ShopScreen — cycle through your team + cycle through buy pool
  - Team preview before battle — cycle through your 6 + opponent's 6
  - BattleEndOverlay stats — cycle through your team and opponent team to see final states
- Current Pokemon indicator (e.g. "2/6" or dots)
- This is a QOL improvement that eliminates the tedious close → scroll → long press → repeat flow

## 3. Show Picked Moves + Ability During Item Select

In ItemSelectScreen, when you're assigning items, you need to see each Pokemon's:
- Ability (with description)
- The moves you already picked for them
- Their typing and stats

This info should be visible either inline (under each Pokemon) or via the long press detail modal. The player needs to know what moves/ability a Pokemon has to choose the right item.

## 4. Item Descriptions in ItemSelectScreen

When long pressing an item (or inline below item name), show what the item does:
- "Life Orb: 1.3x damage but lose 10% HP per attack"
- "Choice Band: 1.5x Attack but locked to one move"
- "Focus Sash: Survive a one-hit KO with 1 HP when at full health"

Check if items data has descriptions. If not, create a mapping.

## After
- `npx vitest run` — all pass
- Commit
- Rename to TASK-FOLLOWUP2-DONE.md
