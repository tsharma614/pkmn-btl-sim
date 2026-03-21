# Task: Complete Item & Ability Audit

Full audit of every held item and every ability in the game. Fix everything that's broken. Miss NOTHING.

---

## Items — 7 BROKEN (no battle effect)

These items are selectable in ItemSelectScreen but have NO battle logic. Implement ALL of them:

### 1. Assault Vest
- 1.5x Special Defense
- Holder can ONLY use attacking moves (no status moves)
- Both effects must work

### 2. Eviolite
- 1.5x Defense AND 1.5x Special Defense
- ONLY works if the holder is not fully evolved (check if species has an evolution)

### 3. Light Clay
- Extends duration of Light Screen and Reflect from 5 turns to 8 turns
- Only matters if the holder is the one who sets the screen

### 4. Expert Belt
- 1.2x damage on super-effective hits
- No drawback

### 5. Sitrus Berry
- Restores 25% max HP when holder drops below 50% HP
- Single use — consumed after activation

### 6. Lum Berry
- Cures any status condition (burn, poison, paralysis, sleep, freeze) immediately when inflicted
- Single use — consumed after activation

### 7. Safety Goggles
- Immune to weather damage (sandstorm, hail)
- Immune to powder/spore moves (Sleep Powder, Stun Spore, Spore, Poison Powder, etc.)

## Items — VERIFY these 13 work correctly

Don't just assume they work. Write a test for each one that creates a battle scenario and verifies the effect triggers:

1. Leftovers — heals 1/16 end of turn
2. Life Orb — 1.3x power + 10% recoil
3. Choice Band — 1.5x Atk, move lock
4. Choice Specs — 1.5x SpA, move lock
5. Choice Scarf — 1.5x Spe, move lock
6. Focus Sash — survive OHKO at full HP
7. Rocky Helmet — 1/6 contact recoil
8. Air Balloon — Ground immunity, pops on hit
9. Weakness Policy — +2 Atk/SpA on super effective hit, single use
10. Heavy-Duty Boots — blocks hazard damage
11. Toxic Orb — badly poisons end of turn
12. Flame Orb — burns end of turn
13. Black Sludge — heals Poison types, damages others

## Abilities — Fix broken ones

Check EVERY ability that has battle logic implemented. Run a test scenario for each. Common ones that are often broken:

### Contact abilities (verify all trigger on contact moves ONLY)
- Rough Skin / Iron Barbs — 1/8 HP damage to attacker
- Static — 30% paralyze
- Poison Point — 30% poison
- Flame Body — 30% burn
- Effect Spore — 11% sleep, 10% poison, 10% paralyze

### Type immunities (verify they actually block damage AND activate effect)
- Volt Absorb — absorb Electric, heal 25% HP
- Water Absorb — absorb Water, heal 25% HP
- Lightning Rod — absorb Electric, +1 SpA
- Storm Drain — absorb Water, +1 SpA
- Flash Fire — absorb Fire, boost Fire moves 1.5x
- Sap Sipper — absorb Grass, +1 Atk
- Motor Drive — absorb Electric, +1 Spe
- Levitate — immune to Ground
- Dry Skin — absorb Water heal 25%, Fire damage 1.25x, rain heal, sun damage

### Stat modifiers (verify the math is right)
- Huge Power / Pure Power — 2x Atk
- Hustle — 1.5x Atk, 0.8x accuracy on physical moves
- Guts — 1.5x Atk when statused, ignore burn Atk drop
- Adaptability — STAB becomes 2x instead of 1.5x
- Technician — 1.5x power for moves with base power ≤ 60
- Sheer Force — 1.3x power for moves with secondary effects, but secondary effects don't apply

### Weather/terrain abilities
- Drizzle / Drought / Sand Stream / Snow Warning — verify they set weather on switch-in
- Chlorophyll / Swift Swim / Sand Rush / Slush Rush — 2x speed in respective weather
- Sand Force — 1.3x Rock/Ground/Steel in sand

### Defensive abilities
- Multiscale / Shadow Shield — halve damage at full HP
- Fur Coat — halve physical damage
- Thick Fat — halve Fire and Ice damage
- Solid Rock / Filter / Prism Armor — 0.75x super effective damage
- Wonder Guard — only hit by super effective moves
- Sturdy — survive OHKO at full HP (like Focus Sash)

### On-KO abilities
- Moxie — +1 Atk on KO
- Beast Boost — +1 to highest stat on KO
- Soul-Heart — +1 SpA on KO

## Tests

For EVERY item and EVERY ability listed above, write a behavioral test:
- Set up two Pokemon in a battle scenario
- One has the item/ability being tested
- Execute a move or turn
- Assert the effect triggered correctly (damage numbers, HP changes, stat boosts, status applied, etc.)

Put tests in tests/engine/item-audit.test.ts and tests/engine/ability-audit.test.ts

## After
- `npx vitest run` — ALL tests pass
- Commit
- Rename to TASK-ITEM-ABILITY-AUDIT-DONE.md
