# Task: DEFINITIVE Fix — Everything Must Work Perfectly

Tanmay is playtesting at 3 AM and the game is still broken. This task fixes EVERYTHING. No half-measures. Test every single thing. When this is done, the game must be flawless.

---

## CRASH FIX (HIGHEST PRIORITY)

### Gym Win Crash — STILL HAPPENING on Build 29
SIGSEGV (EXC_BAD_ACCESS) in UIKit gesture recognizer during screen transition after gym win. Build 28 had SIGABRT, build 29 has SIGSEGV — different crashes, same trigger.

The crash happens when transitioning from battle end → shop/gym map. It's a React Native navigation issue, NOT a battle engine bug.

Fix:
- Add a small delay (requestAnimationFrame or setTimeout 100ms) between battle end and the advanceCampaign dispatch to let the current screen fully unmount
- Clean up any running animations/timers in BattleScreen before transitioning
- Make sure no state updates happen on unmounted components
- Add try/catch around the advanceCampaign → dispatch chain
- Test by playing through a full gym battle → win → transition multiple times

## UI FIXES (CRITICAL — NOT WORKING ON DEVICE)

### Left/Right Cycling Buttons
The cycling feature was supposedly added but IS NOT visible on device. Verify:
- PokemonDetailModal has visible < > arrow buttons
- They're not hidden behind other elements or off-screen
- They work on EVERY screen: budget draft, move select, item select, gauntlet starter, steal, shop, team preview
- Test by rendering the modal and confirming arrows appear

### Ability Descriptions on Move Select Screen
The move select screen (PICK MOVES page) shows ability name (e.g. "Protean") but NO description. The player has no idea what Protean does.
- Add ability description text below the ability name on the move select header
- e.g. "Protean: Changes type to match the move about to be used"
- Use the abilities.json shortDesc field
- This must be visible WITHOUT long pressing — it should be inline on the move select screen

### Move Effect Descriptions
When tapping/long-pressing a move in the move list, the detail popup shows power/accuracy/PP/priority/flags. But it needs a plain English description of what the move DOES:
- "Earthquake: Power 100. Hits all adjacent Pokemon."
- "Knock Off: Power 65. Removes the target's held item."
- "U-turn: Power 70. User switches out after attacking."
- Use the move's `desc` or `shortDesc` field from moves data
- This MUST be prominently displayed in the move detail popup, not hidden

### Item Select — Show Pokemon Details
During item select, the player needs to see each Pokemon's ability + moves to make informed item choices. Verify this is actually rendering on device — it was supposedly added but screenshots show it's not there.

## STAT BOOST VERIFICATION

The code audit says boosts work. Tanmay says they don't. One of these is wrong. Write a definitive test:

1. Create two Pokemon in a battle
2. One uses Swords Dance
3. Verify boosts.atk is now +2
4. Attack with a physical move
5. Compare damage to a control (same attack without Swords Dance)
6. Damage with +2 Atk MUST be exactly 2x the control damage (allowing for random roll)

If the test passes, the boosts work in the engine but maybe the JS bundle on TestFlight is stale. If the test fails, find and fix the bug.

Do the same for: Calm Mind (SpA + SpD), Dragon Dance (Atk + Spe), Intimidate (-1 Atk), Speed Boost (+1 Spe each turn).

## AI MOVE SELECTION

The AI uses immune moves repeatedly (Earthquake into Levitate 6+ times). Fix:
- Before selecting a move, calculate type effectiveness against target
- Never use a 0x effectiveness move when alternatives exist
- Check ability immunities: Levitate (Ground), Volt Absorb (Electric), Water Absorb (Water), Flash Fire (Fire), Sap Sipper (Grass), Motor Drive (Electric), Lightning Rod (Electric), Storm Drain (Water)
- Priority order: super effective > STAB neutral > neutral > not very effective > status > immune (never)

Write a test: AI faces Levitate Pokemon, has Earthquake + Flamethrower. Must pick Flamethrower.

## COMPREHENSIVE MOVE TESTS

For EVERY move that has a secondary effect, write a test verifying the effect triggers:
- Stat boosting moves: Swords Dance, Calm Mind, Dragon Dance, Nasty Plot, Shell Smash, Quiver Dance, Iron Defense, Amnesia, Agility, Autotomize, Bulk Up, Hone Claws, Work Up, Coil, Shift Gear, Cotton Guard, Cosmic Power, Geomancy
- Stat dropping moves: Intimidate, Sticky Web, Icy Wind, Mud-Slap, Psychic (SpD drop chance), Moonblast (SpA drop chance), Superpower (self Atk/Def drop), Close Combat (self Def/SpD drop), Draco Meteor (self SpA drop), Overheat (self SpA drop), Leaf Storm (self SpA drop)
- Priority moves: Quick Attack, Extreme Speed, Aqua Jet, Mach Punch, Bullet Punch, Ice Shard, Shadow Sneak, Sucker Punch
- Recoil moves: Brave Bird, Flare Blitz, Wild Charge, Head Smash, Double-Edge, Take Down
- Drain moves: Drain Punch, Giga Drain, Horn Leech, Leech Life
- Self-boost on hit: Trailblaze, Flame Charge, Rapid Spin, Power-Up Punch, Ancient Power
- Protect: verify it blocks, verify consecutive use fails
- U-turn/Volt Switch: verify user switches after damage
- Knock Off: verify item removal
- Fake Out: verify flinch on turn 1 only

## COMPREHENSIVE ABILITY TESTS

For EVERY ability that has a battle effect, write a test:
- Contact abilities: Rough Skin, Iron Barbs, Static, Poison Point, Flame Body, Effect Spore
- Type immunity: Levitate, Volt Absorb, Water Absorb, Flash Fire, Sap Sipper, Motor Drive, Lightning Rod, Storm Drain, Dry Skin, Wonder Guard
- Stat modifiers: Huge Power, Pure Power, Hustle, Guts, Adaptability, Technician, Sheer Force
- Weather setters: Drizzle, Drought, Sand Stream, Snow Warning
- Speed modifiers: Chlorophyll, Swift Swim, Sand Rush, Slush Rush, Speed Boost, Unburden
- Defensive: Multiscale, Shadow Shield, Fur Coat, Thick Fat, Solid Rock, Filter, Prism Armor, Sturdy
- On-KO: Moxie, Beast Boost, Soul-Heart
- Switch-in: Intimidate, Download, Trace
- Other: Protean (type change), Prankster (+1 priority on status), Magic Bounce (reflect status), Contrary (reverse stat changes), Simple (double stat changes)

## AFTER — MANDATORY STEPS

1. `npx vitest run` — EVERY test passes
2. Review your own work — check that every fix is complete
3. Commit
4. Deploy to TestFlight following the standard deploy steps
5. Rename to TASK-DEFINITIVE-DONE.md

DO NOT mark this as done until EVERYTHING above is verified.
