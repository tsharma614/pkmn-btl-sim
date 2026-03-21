# Task: Overnight Fixes — DO NOT DEPLOY. Commit only.

Multiple features and fixes. Do them ONE AT A TIME. Test each before moving to the next. Review your own code line by line before committing.

---

## 1. Move Filter During Move Select

On the PICK MOVES screen, add filter buttons at the top:
- ALL (default) | Physical | Special | Status
- Tapping a filter shows only moves of that category
- The move list should update instantly
- Keep the current long-press detail popup working
- Test: filter to Physical → only physical moves shown → filter to All → all moves return

## 2. More Held Items + Item Sprites

Add more competitively relevant held items that aren't in the game yet. Check what's missing:
- Scope Lens, Razor Claw (crit boosters)
- White Herb, Power Herb
- Shell Bell
- Bright Powder
- Red Card
- Ring Target
- Any other commonly used competitive items

For EACH item:
- Implement the battle effect
- Download the item sprite from https://play.pokemonshowdown.com/sprites/itemicons/
- Bundle locally in assets/sprites/items/
- Show the sprite next to the item name in ItemSelectScreen
- Write a test for the battle effect

Make the item UI clean — sprite + name + brief description visible without long-pressing.

## 3. Respawn System — Keep Progress on Loss

Currently when you lose a gym battle, your run is over. Change this:
- Losing a gym battle does NOT end your run
- After losing, return to the gym map with your team fully healed
- The gym you lost to is still available to rechallenge
- Track losses in stats but don't wipe progress
- Same for E4 — losing to an E4 member returns you to E4 lock screen

Edge cases to handle:
- Lose first gym battle after draft → return to gym map, not back to draft
- Lose to E4 member → return to E4 locks, beaten E4 members stay beaten
- Lose to champion → return to E4 locks, champion lock still available
- Save state persists losses correctly
- Resume after Save & Quit still works after a loss

Write tests for EVERY edge case above.

## 4. Shop Always Accessible from Bottom Bar

The shop should be accessible anytime you're on the gym map or E4 lock screen:
- Add a "Shop" button to the bottom action bar (alongside Forfeit and Save & Quit)
- Tapping Shop opens the ShopScreen
- After closing shop, return to gym map / E4 locks
- Shop balance displayed on the button ("Shop (3 pts)")
- Make the bottom bar buttons look cleaner — proper styling, not plain text

## 5. Crash Prevention — Read the Research

After the crash research agent completes (check /private/tmp/claude-501/-Users-tanmaysharma-repos-agent-hub/7d4b2fcf-6cbb-46fe-9382-d424d854cc22/tasks/a1a9297e797aaf3ac.output), implement whatever fix is recommended. This crash has persisted across builds 28-34 and must be eliminated.

## Rules for ALL fixes:
- Review your own code LINE BY LINE before committing
- Write tests for every change
- Do NOT remove existing functionality
- Do NOT deploy — commit only
- `npx vitest run` must pass after each fix

## After
- All 5 items committed
- All tests pass
- Rename to TASK-OVERNIGHT-DONE.md
- Do NOT deploy
