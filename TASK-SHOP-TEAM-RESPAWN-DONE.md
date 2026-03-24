# Task: Shop Flow + Team Page + Respawn Tests

## 1. Move/Item Selection for Bought Pokemon
When a player buys a Pokemon in the shop, they should go through:
- Move selection (pick 4 moves from the Pokemon's learnset)
- Item selection (pick a held item)

Currently bought Pokemon just drop in with defaults. Add a sub-flow within the shop:
- After picking which team member to replace, show move selection for the new Pokemon
- After moves, show item selection
- Then complete the purchase

## 2. Team Details Button on Gym Map
Add a "Team" button on the gym map screen (bottom bar or header) that shows:
- All 6 Pokemon with sprites
- Per Pokemon: name, types, ability, held item
- Base stats (HP/Atk/Def/SpA/SpD/Spe) displayed as colored bars or numbers
- Battle stats per Pokemon tracked across the gym career run:
  - KOs (knockouts dealt)
  - Damage dealt (total)
  - Times fainted
- Current moves with type indicators
- Tap a Pokemon for full PokemonDetailModal

These per-Pokemon battle stats need to be:
- Tracked during battles and accumulated across the career
- Saved/restored with the gym career save
- Displayed on the team page
- Reset when starting a new career
- Tests: verify KOs/damage/faints increment correctly, persist across battles, survive save/load

This should also be accessible from the E4 lock screen.

## 3. Respawn System Tests
Write comprehensive tests for the respawn system:
- Losing a gym battle → returns to gym map with healed team
- Badges from previous wins are preserved after loss
- Shop balance preserved after loss
- Team composition preserved after loss (same Pokemon, same moves, same items)
- "Forfeit Run" ends the run completely (different from respawn)
- Losing E4 battle → returns to E4 locks with healed team
- E4 progress preserved (beaten members stay beaten)

## 4. Save Flow Tests (Before and After Respawn)
Test that AsyncStorage saves are correct:
- Save before a battle has correct team/badges/balance
- After respawn (loss), save is updated with healed team but same badges
- After gym win, save has new badge + updated balance
- Resume from save after respawn loads correct state
- Resume from save after win loads correct state
- Multiple losses don't corrupt the save
- Save after shop purchase includes the new Pokemon

## IMPORTANT
- Do NOT use expo-image anywhere new — use React Native's built-in Image for static sprites
- Do NOT use dynamic require() in render functions
- Run all tests after changes: `npx vitest run`
- Commit when done, do NOT deploy

## After
- All tests pass (1206+ existing + new tests)
- Rename to TASK-SHOP-TEAM-RESPAWN-DONE.md
