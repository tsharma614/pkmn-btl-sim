# Task: Gym Map UI Redesign

The gym map looks hideous. Fix it.

---

## Problems
- Every gym has the same brown house sprite — boring and generic
- The top buttons (Forfeit Run, Save & Quit) are ugly plain text links crammed at the top
- Overall looks like a debug screen, not a game

## Fixes

### 1. Type-Themed Gym Icons
Replace the generic brown house with unique icons per type. Use SF Symbols or simple drawn shapes:
- Ice: snowflake
- Fire: flame
- Water: droplet
- Grass: leaf
- Electric: bolt
- Psychic: eye/brain
- Dark: moon
- Poison: skull/vial
- Fighting: fist
- Ghost: ghost
- Dragon: dragon silhouette
- Rock: boulder
- Ground: mountain
- Steel: shield
- Bug: bug
- Flying: wing/feather
- Fairy: star/sparkle
- Normal: circle/pokeball

Make them visually distinct. Each gym card should feel different at a glance.

### 2. Card Backgrounds
Instead of just a colored border on dark cards, make the whole card background a subtle gradient of the type color. Dark at bottom, type color at top. The type name text color should match too.

### 3. Bottom Action Bar
Move Forfeit Run and Save & Quit from the ugly top row to a clean bottom bar:
- Two proper buttons with rounded corners
- Forfeit = red/destructive style
- Save & Quit = grey/secondary style
- Properly spaced, centered

### 4. Header Polish
- "GYM MAP" title should be bigger, styled
- "X/8 Beaten" should be a progress bar or badge row, not plain text
- Show 8 small badge slots at the top — filled in as gyms are beaten

### 5. Beaten Gym Visual
When a gym is beaten, don't just grey it out. Show:
- A checkmark or badge overlay
- Reduce opacity but keep the type color visible
- Maybe show the badge you earned

## After
- `npx vitest run` — all pass
- Commit
- Rename to TASK-GYM-UI-DONE.md
