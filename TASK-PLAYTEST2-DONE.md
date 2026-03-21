# Task: Playtest Feedback Round 2 — Critical Bugs + Detail Gaps

---

## CRITICAL BUGS

### 1. Resume Save Forces Redraft
When the player uses Save & Quit from the gym map and later resumes, it forces a full redraft instead of restoring their progress. The save should restore: beaten gyms, team, shop balance, and drop the player back at the gym map (or E4 locks if past gyms).

Check the resume flow in CampaignScreen — is getGymCareerSave() returning the correct data? Is the restore dispatching GYM_CAREER_START (which triggers a new draft) instead of restoring to gym_map phase?

### 2. App Crash After Gym Win → Stats → Continue
After winning a gym battle, viewing the stats screen, and pressing continue/next battle, the app crashes. This is likely the advanceCampaign flow — check what happens after SHOW_SHOP or GYM_BEATEN. The crash could be a null reference in the shop or gym map transition.

Check the full flow: battle end → advanceCampaign → SHOW_SHOP → shop phase → SHOP_DONE → SHOW_GYM_MAP. Something in this chain is crashing.

## DETAIL IMPROVEMENTS

### 3. Ability Descriptions
The PokemonDetailModal shows the ability name but NOT what it does. Add a one-line description for every ability. Examples:
- "Sand Veil: Raises evasion in sandstorm"
- "Intimidate: Lowers opponent's Attack on switch-in"
- "Technician: Boosts moves with base power ≤60 by 1.5x"

The ability descriptions should come from the pokedex data or a separate ability descriptions file. Check if ability descriptions exist in the data files. If not, create a mapping of ability name → short description for all abilities used in the game.

### 4. Wrong Abilities on Pokemon
Pokemon are sometimes displaying incorrect abilities. Audit how abilities are assigned:
- During budget draft, what ability does each Pokemon get?
- Is it pulling from the correct species data?
- Are mega evolutions getting their mega ability or their base ability?
- Check the draft pool generation and team building code

### 5. Moveset Preview During Draft
In BudgetDraftScreen, when you long press a Pokemon, the detail modal should show what moves that Pokemon can learn (its learnset). Right now it only shows stats. The player is drafting blind — they need to know if a Pokemon has good coverage moves before picking it.

Show the top 8-10 moves by level-up or a curated "notable moves" list in the detail modal during draft.

### 6. Move Effect Descriptions
The move detail popup shows power, accuracy, PP, priority, and flags. But it needs the EFFECT DESCRIPTION — what the move actually does beyond damage. Examples:
- "Earthquake: Hits all adjacent Pokemon. Double damage on targets using Dig."
- "Stone Edge: High critical hit ratio."
- "Flamethrower: 10% chance to burn the target."

Check if move descriptions exist in the data. The `desc` or `shortDesc` field should have this. Make sure it's displayed prominently in the move detail modal — not hidden or truncated.

## After
- `npx vitest run` — all pass
- Commit each fix separately
- Rename to TASK-PLAYTEST2-DONE.md
