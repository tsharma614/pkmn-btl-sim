# Task: Per-Pokemon Battle Stats

Track KOs, damage dealt, and times fainted per Pokemon across the gym career.

## Requirements

### 1. Engine — `src/engine/battle.ts`
- Add a `battleStats` object to each Pokemon: `{ kos: number, damageDealt: number, timesFainted: number }`
- When a Pokemon deals damage, accumulate it in `damageDealt`
- When a Pokemon KOs an opponent (HP drops to 0 from this Pokemon's attack), increment `kos`
- When a Pokemon faints, increment `timesFainted`
- These stats persist across battles within the gym career — they are cumulative, not per-battle

### 2. Shop Buy — `src/client/components/ShopScreen.tsx` / `src/client/state/battle-context.tsx`
- New Pokemon purchased from the shop MUST start with all stats at 0: `{ kos: 0, damageDealt: 0, timesFainted: 0 }`
- This is critical — shop Pokemon are fresh recruits with no history

### 3. Save/Load — `src/client/state/battle-context.tsx`
- Include `battleStats` in the save state for each Pokemon
- Restore `battleStats` when loading a saved game
- Stats must survive through respawns (loss → respawn should preserve cumulative stats)

### 4. UI — `src/client/components/GymMapScreen.tsx`
- Display per-Pokemon stats in the team details modal
- Show: KOs, Total Damage Dealt, Times Fainted
- Clean layout under each Pokemon's info

### 5. Tests — `tests/e2e/`
- Test that KO counter increments when a Pokemon KOs an opponent
- Test that damage dealt accumulates correctly
- Test that times fainted increments on faint
- Test that stats persist through save/load
- Test that stats survive respawn
- Test that newly bought shop Pokemon start at 0 for all stats

### 6. Victory Screen — Dynamic Island Fix + Points Display
- The "You Win" text on the post-battle stats screen is covered by the iPhone Dynamic Island / notch
- Move the victory text and stats content down with extra top padding so it clears the sensor housing on all iPhone models
- Use SafeAreaView or manual top inset to fix this
- Also show the player's CURRENT points balance and how many points they gained from the battle on this screen

## IMPORTANT
- Run ALL existing tests after changes to make sure nothing breaks
- Do NOT deploy — just commit. Hub agent will review line by line before deploying.
