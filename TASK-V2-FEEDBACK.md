# Task: v2.0 Playtest Feedback Fixes

Tanmay playtested v2.0 and found these issues. Fix ALL of them.

---

## UI FIXES

### 1. Long Press Pokemon Details — Everywhere
Add a long press handler that shows Pokemon details (typing, stats, ability, moves) in a modal/overlay. This needs to work on:
- **BudgetDraftScreen** — long press any Pokemon option during draft
- **Gauntlet starter select** — long press starter options
- **Steal screen** — long press Pokemon you can steal

Use the same component for all three. Same UX pattern as the item long press in ItemSelectScreen.

### 2. Move Details During Move Select
When picking moves for your team, show full move details: type, power, accuracy, PP, effect description. Long press or tap to expand — same pattern as item details.

### 3. Budget Cap → 14
Change the budget from 15 to 14 points. Update BudgetDraftScreen and all related tests.

### 4. Allow Duplicate Items
Remove the item clause restriction. Players should be able to give the same held item to multiple Pokemon. If there's validation preventing duplicates in ItemSelectScreen, remove it.

---

## GAUNTLET FIXES (CRITICAL — currently unplayable)

### 5. Gauntlet Battle 1 is 1v6 Against Full Legend Team
First gauntlet battle pits your 1 starter against a team of 6 including legendaries (Darkrai, Necrozma, Metagross, Zygarde). This is impossible.

Fix the gauntlet scaling:
- Battle 1: 1v1 against a T3 mon
- Battle 2: 1v2 (after you've stolen one, so you have 2)
- Battle 3: 2v3
- Scale up gradually — opponent team size should roughly match yours or be +1 at most
- Early battles should use T3/T2 mons, legendaries shouldn't appear until battle 5+
- By battle 8+ you can face full teams of mixed tiers

### 6. Item Select for Gauntlet Starter
After picking your gauntlet starter, let the player choose a held item for it before the first battle. Reuse ItemSelectScreen.

---

## GYM CAREER FIXES

### 7. Gym Teams Not Matching Their Type
Gym teams are completely ignoring their gym type:
- Fire gym had: Mewtwo, Zamazenta, Goodra-Hisui, Marshadow, Lunala, Mega Charizard Y (only 1/6 Fire)
- Normal gym had: Eternatus, Lunala, Mega Gallade, Lugia, Solgaleo, Aegislash (0/6 Normal)

Fix the gym team generator so that ALL 6 Pokemon on a gym team have the gym's type (primary or secondary). If there aren't enough mons of that type across tiers, at minimum 4/6 must match.

### 8. Loss Counted Twice in Stats
After losing a gym battle, the stats screen shows it as both a loss AND an abandoned run. The `saveCampaignRun` fix from the previous task is probably double-saving — once on battle loss and once on restart/abandon. Fix so a loss is recorded exactly once.

---

## APP ICON

### 9. New App Icon
The current pokeball icon looks flat and basic. Generate a new app icon that's a pokeball but looks better — more polished, maybe with some depth/shading/glow, keep the dark background. Generate it at all required iOS sizes (1024x1024 master + all AppIcon sizes). Replace the existing icon assets.

---

## AFTER ALL FIXES
- Run `npx vitest run` — all tests must pass
- Commit after each major fix
- This does NOT need a TestFlight deploy, just get it working
