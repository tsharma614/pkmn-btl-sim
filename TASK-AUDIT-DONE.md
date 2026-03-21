# Task: Move & Ability Implementation Audit

Go through EVERY move and ability in the game data and verify their effects are correctly implemented in the battle engine. This is a comprehensive audit — be thorough.

## Files to audit
- `src/engine/battle.ts` — move execution, ability handling, status effects
- `src/engine/damage.ts` — damage calculation, modifiers
- `src/data/moves.json` — move database (~1000+ moves)
- `src/data/abilities.json` — ability database (~300+ abilities)
- `src/types/index.ts` — type definitions

## What to check

### Moves
For every move in moves.json that has effects/flags, verify the engine handles it:

1. **Status moves** — verify the status is actually applied (burn, paralysis, poison, toxic, sleep, freeze, confusion)
2. **Stat boost/drop moves** — verify correct stats and stages
3. **Side effect chances** — verify the % chance matches the data (e.g., Thunderbolt 10% paralysis)
4. **Multi-hit moves** — verify hit count logic (2-5 hits, fixed hits like Double Kick)
5. **Recoil moves** — verify recoil % is correct
6. **Drain moves** — verify heal amount
7. **Priority moves** — verify priority values work
8. **Weather moves** — verify weather is set and lasts correct turns
9. **Hazard moves** — verify Stealth Rock, Spikes (3 layers), Toxic Spikes (2 layers), Sticky Web
10. **Screen moves** — verify Reflect, Light Screen, Aurora Veil duration and damage reduction
11. **Protection moves** — verify Protect, Detect, King's Shield, Baneful Bunker, Spiky Shield
12. **Healing moves** — verify heal amounts, weather-dependent healing
13. **OHKO moves** — verify they work (Sheer Cold, Fissure, Horn Drill, Guillotine)
14. **Fixed damage moves** — verify Seismic Toss, Night Shade, Dragon Rage, Sonic Boom
15. **Variable power moves** — verify all power calculations (Gyro Ball, Electro Ball, Heavy Slam, Low Kick, Flail, etc.)
16. **Charge/recharge moves** — verify two-turn moves work (Solar Beam, Hyper Beam, Fly, Dig, etc.)
17. **Type-changing moves** — verify if any are implemented
18. **Sound moves** — verify Soundproof immunity works
19. **Bullet/ball moves** — verify Bulletproof immunity works
20. **Contact vs non-contact** — verify contact flags are correct for ability triggers

### Known missing (implement these):
- **Substitute** — type defined but not implemented. Add: costs 1/4 max HP, blocks most moves until broken
- **Terrain** — Grassy, Electric, Psychic, Misty terrain. Effects on moves and healing
- **Trick Room** — reverse speed priority for 5 turns
- **Tailwind** — double speed for 4 turns (infrastructure may exist)
- **Infatuation (Cute Charm)** — explicitly skipped, implement it
- **Type-changing moves** — Conversion, Reflect Type, etc.

### Abilities
For every ability that has a battle effect, verify the engine handles it. Check:

1. **Switch-in abilities** — Intimidate, weather setters, Download, Trace, etc.
2. **Immunity abilities** — Levitate, Flash Fire, Volt Absorb, Water Absorb, etc.
3. **Damage modifier abilities** — Huge Power, Technician, Adaptability, etc.
4. **Contact-triggered abilities** — Static, Flame Body, Rough Skin, etc.
5. **Status immunity abilities** — Water Veil, Limber, Immunity, etc.
6. **Stat change abilities** — Simple, Contrary, Defiant, Competitive
7. **End-of-turn abilities** — Speed Boost, Poison Heal, etc.
8. **KO abilities** — Moxie, Beast Boost, Soul-Heart
9. **Weather abilities** — Sand Rush, Swift Swim, Chlorophyll, etc.
10. **Commonly used abilities that might be missing** — check for: Protean/Libero, Prankster, Magic Bounce, Unaware, Regenerator, Natural Cure, Sturdy, Mold Breaker, Scrappy

### Output
Create a report file at `AUDIT-RESULTS.md` with:
1. **Correctly implemented** — moves/abilities that work as expected
2. **Incorrectly implemented** — moves/abilities with wrong behavior (wrong damage, wrong chance, etc.)
3. **Missing implementation** — moves/abilities in the data but not handled by the engine
4. **Priority fixes** — the most impactful missing/broken things to fix first

Then FIX everything that's broken or missing. Write tests for every fix. Prioritize:
1. Commonly used competitive moves/abilities first
2. Then niche ones
3. Skip moves that are doubles-only (we're singles only)

Commit in batches — don't do one massive commit.

## Tests
Write thorough tests for EVERY fix and every verified implementation:
- Test each move effect (status chance, stat stages, recoil %, drain %, etc.)
- Test each ability trigger (switch-in, contact, immunity, damage modifier, etc.)
- Test interactions (ability + move combos like Sheer Force + Life Orb)
- Test edge cases (Mold Breaker bypassing abilities, Sturdy at 1HP, etc.)
- Group tests by category: `tests/engine/move-effects.test.ts`, `tests/engine/abilities.test.ts`, `tests/engine/interactions.test.ts`
- All tests must pass before committing

## Version Note
This is v2.0 build 1, NOT build 20. Fix the build number to 1 if it was set to 20.
