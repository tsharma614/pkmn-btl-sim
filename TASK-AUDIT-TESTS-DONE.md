# Task: Complete Item & Ability Test Coverage

The audit implemented all items/abilities but only wrote tests for HALF of them. Write the missing tests. Every item and ability must have at least one behavioral test.

---

## Missing Item Tests (6)

Add to tests/engine/item-audit.test.ts:

1. **Rocky Helmet** — attacker takes 1/6 max HP on contact move
2. **Air Balloon** — holder immune to Ground moves, balloon pops when hit by any attack
3. **Weakness Policy** — +2 Atk and +2 SpA when hit by super effective move, single use
4. **Toxic Orb** — holder gets badly poisoned at end of turn
5. **Flame Orb** — holder gets burned at end of turn
6. **Black Sludge** — heals 1/16 HP for Poison types, damages 1/8 HP for non-Poison

## Missing Ability Tests (26)

Add to tests/engine/ability-audit.test.ts:

### Contact abilities (5 missing)
- Rough Skin — 1/8 HP to attacker on contact
- Iron Barbs — same as Rough Skin
- Poison Point — 30% poison on contact
- Flame Body — 30% burn on contact
- Effect Spore — status on contact

### Type immunities (8 missing)
- Water Absorb — absorb Water, heal 25%
- Dry Skin — absorb Water heal, Fire 1.25x damage
- Lightning Rod — absorb Electric, +1 SpA
- Storm Drain — absorb Water, +1 SpA
- Sap Sipper — absorb Grass, +1 Atk
- Motor Drive — absorb Electric, +1 Spe
- Wonder Guard — only hit by super effective

### Weather (7 missing)
- Drizzle — sets rain on switch in
- Drought — sets sun on switch in
- Sand Stream — sets sand on switch in
- Snow Warning — sets snow/hail on switch in
- Sand Rush — 2x speed in sand
- Slush Rush — 2x speed in snow
- Sand Force — 1.3x Rock/Ground/Steel in sand

### Defensive (4 missing)
- Shadow Shield — halve damage at full HP
- Solid Rock — 0.75x super effective
- Filter — 0.75x super effective
- Prism Armor — 0.75x super effective

### On-KO (2 missing)
- Beast Boost — +1 to highest stat on KO
- Soul-Heart — +1 SpA on KO

## After
- `npx vitest run` — all pass
- Commit
- Rename to TASK-AUDIT-TESTS-DONE.md
