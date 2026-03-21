# Task: Fix Stat Boosts + AI + Crash + Full Mechanics Audit

Two critical battle engine bugs found during playtesting.

---

## 1. CRITICAL: NO STAT CHANGES DO ANYTHING

Tanmay confirmed stat boosts/drops have ZERO effect on battle calculations. This means:
- Swords Dance, Calm Mind, Dragon Dance, Nasty Plot, Shell Smash — all useless
- Intimidate, Sticky Web, speed drops — all useless
- Weakness Policy +2 boosts — useless
- Speed Boost ability — useless
- Every stat-changing move and ability in the game is broken

This is a FUNDAMENTAL damage formula bug. Find and fix the root cause:

1. Check the damage formula in battle.ts — is it reading `pokemon.boosts.atk` / `pokemon.boosts.spa` etc when calculating damage?
2. Check the stat calculation function — does `getEffectiveStat()` or equivalent apply the boost multiplier? The formula should be: `stat * boostMultiplier` where multipliers are: +1=1.5, +2=2.0, +3=2.5, +4=3.0, +5=3.5, +6=4.0, -1=0.67, -2=0.5, -3=0.4, -4=0.33, -5=0.29, -6=0.25
3. Check that boosts are actually being SET on the Pokemon object when moves like Calm Mind/Swords Dance execute
4. Check that boosts PERSIST between turns (not reset each turn)
5. Check speed calculation — are speed boosts applied when determining move order?
6. Check accuracy/evasion — are those boost stages applied?

Write comprehensive tests:
- Swords Dance +2 Atk → physical move does 2x damage
- Calm Mind +1 SpA/SpD → special move does 1.5x damage AND takes 0.67x special damage
- Intimidate -1 Atk → opponent physical move does 0.67x damage
- Speed Boost +1 Spe → Pokemon moves first when it wouldn't without boost
- Dragon Dance +1 Atk +1 Spe → both effects work
- Shell Smash +2 Atk/SpA/Spe, -1 Def/SpD → all 5 stat changes apply
- Stacking: 3x Swords Dance = +6 Atk = 4x damage
- Boosts persist across turns (not reset)

## 2. AI Uses Immune Moves Repeatedly

Battle log evidence: Mega Camerupt used Earthquake SIX times into Cresselia (Levitate = Ground immune), then Groudon used Precipice Blades TWICE into the same Cresselia.

The AI should NEVER use a move that deals 0 damage when it has other options. Fix the AI move selection:

- Before selecting a move, check type effectiveness against the current target
- If a move is immune (0x effectiveness, or blocked by ability like Levitate), SKIP IT
- Only use an immune move if ALL moves are immune (switch instead if possible)
- Priority: super effective > neutral > not very effective > immune (never)
- Also check for abilities that grant immunity: Levitate (Ground), Volt Absorb (Electric), Water Absorb (Water), Flash Fire (Fire), Sap Sipper (Grass), Motor Drive (Electric), Lightning Rod (Electric), Storm Drain (Water), Wonder Guard (non-SE)

Write a test: AI opponent faces a Levitate Pokemon while knowing Earthquake + Flamethrower. Verify it picks Flamethrower, not Earthquake.

## 3. FULL BATTLE MECHANICS AUDIT

If stat boosts were completely broken, what else is broken? Test EVERY core mechanic:

### Type effectiveness
- Super effective = 2x damage
- Not very effective = 0.5x damage
- Immune = 0 damage
- Double super effective = 4x (e.g. Ice vs Grass/Flying)
- Double resist = 0.25x
- STAB = 1.5x (2x with Adaptability)

### Stat boosts (already covered above)

### Status conditions
- Burn: halves physical attack damage, 1/16 HP per turn
- Paralysis: 0.5x speed, 25% chance can't move
- Poison: 1/8 HP per turn
- Toxic: 1/16 increasing each turn
- Sleep: can't move for 1-3 turns, wake up check each turn
- Freeze: can't move, 20% thaw each turn, thawed by Fire moves

### Weather effects
- Rain: Water 1.5x, Fire 0.5x, Thunder 100% accuracy, Solar Beam halved
- Sun: Fire 1.5x, Water 0.5x, Solar Beam no charge, Thunder 50% accuracy
- Sand: Rock SpD 1.5x, 1/16 damage to non-Rock/Ground/Steel
- Hail/Snow: 1/16 damage to non-Ice (hail), Ice Def 1.5x (snow)

### Critical hits
- 1.5x damage
- Ignores negative attack boosts on attacker
- Ignores positive defense boosts on defender
- Base crit rate ~4.17%, +1 stage = 12.5%, +2 = 50%, +3 = 100%

### Priority
- Priority moves go first regardless of speed (Quick Attack +1, Extreme Speed +2, Protect +4)
- Negative priority goes last (Trick Room reversal, Roar -6)
- Same priority = speed determines order

### Switching
- Entry hazards trigger on switch-in (Stealth Rock, Spikes, Toxic Spikes)
- Abilities trigger on switch-in (Intimidate, Drizzle, etc.)
- Boosts reset on switch-out

### Recoil and drain
- Life Orb: 10% HP recoil
- Recoil moves: 33% of damage dealt (Brave Bird, Flare Blitz, etc.)
- Drain moves: heal 50% of damage dealt (Drain Punch, Giga Drain, etc.)

### Protect
- Blocks all moves that turn
- Fails if used consecutively (50% → 25% → etc.)

### Multi-hit moves
- Hit 2-5 times with correct distribution (35% 2, 35% 3, 15% 4, 15% 5)
- Skill Link = always 5 hits

### Flinch
- Only works if attacker moves FIRST
- 30% for Iron Head, Rock Slide, etc.

### Choice items
- Lock to one move
- Boost correct stat (Band=Atk, Specs=SpA, Scarf=Spe)

Write a behavioral test for EVERY mechanic listed above. If ANY mechanic is broken, fix it. This is the foundation of the entire game.

## After
- `npx vitest run` — all pass
- Commit
- Rename to TASK-CALMMIND-AI-DONE.md
