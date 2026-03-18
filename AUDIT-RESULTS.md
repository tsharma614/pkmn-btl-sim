# Move & Ability Implementation Audit Results

## 1. Correctly Implemented

### Moves
- **Status application**: burn, paralysis, poison, toxic, sleep, freeze, confusion — all work with correct type/ability immunities
- **Stat boost/drop**: All 7 stats (atk, def, spa, spd, spe, accuracy, evasion) with ±6 stage clamping, Simple/Contrary support
- **Secondary effect chances**: Encoded in effects array with correct % (Thunderbolt 10% par, Iron Head 30% flinch, etc.)
- **Multi-hit moves**: 2-5 hit range with Skill Link support, fixed-hit moves (Double Kick), scaling power (Triple Axel)
- **Recoil moves**: Brave Bird 33%, Flare Blitz 33%, etc. — percentage of damage dealt
- **Drain moves**: Giga Drain 50%, Drain Punch 50% — heals attacker
- **Priority moves**: Full priority system with Prankster (+1 status), Gale Wings (+1 flying), Triage (+3 drain)
- **Weather moves**: Rain Dance, Sunny Day, Sandstorm, Hail — 5 turn duration, correct damage modifiers
- **Hazard moves**: Stealth Rock (type-based), Spikes (3 layers), Toxic Spikes (2 layers), Sticky Web (-1 spe)
- **Screen moves**: Reflect, Light Screen, Aurora Veil — 5 turn duration, 0.5x damage reduction, no stacking
- **Protection moves**: Protect, Detect, King's Shield, Baneful Bunker, Spiky Shield, Obstruct, Silk Trap — consecutive use failure
- **Healing moves**: Recover/Roost 50%, weather-dependent (Moonlight/Synthesis/Morning Sun), Rest (full heal + 2-turn sleep), Wish
- **OHKO moves**: Sheer Cold, Fissure, Horn Drill, Guillotine — level check, Ice immunity for Sheer Cold
- **Fixed damage**: Seismic Toss/Night Shade (level-based), Dragon Rage (40), Sonic Boom (20), Super Fang (50% current HP), Endeavor
- **Variable power**: Gyro Ball, Electro Ball, Heavy Slam, Low Kick, Flail/Reversal, Stored Power, Facade, Weather Ball, Rage Fist
- **Recharge moves**: Hyper Beam, Giga Impact — skip next turn
- **Self-KO moves**: Explosion, Self-Destruct, Final Gambit
- **Sound moves**: Soundproof immunity works
- **Bullet moves**: Bulletproof immunity works
- **Contact flags**: Correct for all major moves, triggers Static/Flame Body/Rough Skin etc.
- **Substitute**: Costs 25% HP, blocks moves, sound bypasses, Baton Pass transfers
- **Rapid Spin**: Clears hazards, removes Leech Seed, +1 Speed
- **Defog**: Clears all hazards both sides
- **Knock Off**: 1.5x power if item present, removes item
- **Spectral Thief**: Steals positive boosts
- **Fake Out**: First turn only
- **Focus Punch**: Fails if hit
- **Sleep Talk**: Random move while asleep
- **Curse**: Dual-mode (Ghost vs non-Ghost)
- **Pain Split**: Averages HP

### Abilities (50+ implemented)
- **Switch-in**: Intimidate, Drizzle, Drought, Sand Stream, Snow Warning, Download, Trace
- **Damage modifiers (attacker)**: Huge Power, Pure Power, Hustle, Guts, Toxic Boost, Flare Boost, Technician, Adaptability, Sheer Force, Tough Claws, Strong Jaw, Mega Launcher, Tinted Lens, Reckless, Analytic, Sharpness, Iron Fist, Normalize, Overgrow/Blaze/Torrent/Swarm, Sand Force, Slow Start
- **Damage modifiers (defender)**: Thick Fat, Marvel Scale, Fur Coat, Multiscale/Shadow Shield, Solid Rock/Filter/Prism Armor
- **Immunity**: Levitate, Flash Fire (partial), Volt Absorb, Water Absorb, Dry Skin, Lightning Rod, Storm Drain, Motor Drive, Sap Sipper, Wonder Guard, Soundproof, Bulletproof
- **Status immunity**: Water Veil, Water Bubble, Limber, Immunity, Magma Armor, Insomnia, Vital Spirit
- **Contact-triggered**: Static, Poison Point, Flame Body, Effect Spore, Rough Skin, Iron Barbs
- **End-of-turn**: Speed Boost, Poison Heal, Ice Body, Rain Dish
- **Stat change**: Simple, Contrary, Defiant, Competitive
- **Priority**: Prankster, Gale Wings, Triage
- **Mold Breaker**: Mold Breaker, Turboblaze, Teravolt bypass defender abilities
- **KO abilities**: Moxie, Beast Boost, Soul-Heart
- **Switch-out**: Natural Cure, Regenerator
- **Weather speed**: Chlorophyll, Swift Swim, Sand Rush, Slush Rush
- **Other**: Pressure, Truant, Skill Link, Unburden, Magic Guard

### Items
- Choice Band/Specs/Scarf, Life Orb, Expert Belt, Soul Dew, Assault Vest, Rocky Helmet, Focus Sash, Weakness Policy, Heavy-Duty Boots

## 2. Incorrectly Implemented

- **Flash Fire**: Immunity works but Fire power boost is NOT applied after absorbing a Fire move
- **Analytic**: Uses `defender.hasMovedThisTurn` as proxy — inaccurate if the defender used a priority move but technically "went first"
- **Taunt**: Volatile status is applied but move-blocking (preventing status moves) is NOT enforced

## 3. Missing Implementation

### High Priority (competitively important)
1. **Terrain** — Grassy/Electric/Psychic/Misty Terrain: data exists, no engine support
2. **Trick Room** — data exists (priority -7), speed reversal not implemented
3. **Two-turn charge moves** — Solar Beam, Fly, Dig, Phantom Force, etc.: `charge` flag exists but charging mechanic not implemented (moves execute in 1 turn)
4. **Taunt move-blocking** — status applied but status moves not actually blocked
5. **Counter/Mirror Coat** — `lastDamageTaken` tracked but moves not implemented
6. **Disable** — volatile status defined but move disabling not enforced
7. **Flash Fire power boost** — immunity works, 1.5x Fire boost missing

### Medium Priority
8. **Infatuation (Cute Charm)** — explicitly skipped with comment
9. **Partial trapping** (Bind, Wrap, Fire Spin, etc.) — 'partiallytrapped' volatile exists but damage/trapping not enforced
10. **Power-Up Punch** — should boost Attack after use (generic boost effect may handle this)

### Low Priority (niche/doubles-only)
11. **Type-changing moves** — Conversion, Reflect Type not implemented
12. **Magnet Rise** — not implemented
13. **Gravity** — not implemented
14. **Helping Hand** — doubles-only, skip

## 4. Priority Fixes (Most Impactful)

### Tier 1 — Fix immediately (breaks competitive play)
1. **Trick Room** — many slow Pokemon depend on it (Dusclops, Torkoal, etc.)
2. **Terrain** — Tapu Koko/Lele/Bulu/Fini define the metagame
3. **Taunt blocking** — Prankster Taunt is a core strategy
4. **Flash Fire boost** — Heatran and other Flash Fire users need the power boost

### Tier 2 — Fix soon
5. **Two-turn moves** — Solar Beam in sun, Fly/Dig for evasion
6. **Counter/Mirror Coat** — used by Chansey, Wobbuffet
7. **Disable** — used by some stall strategies

### Tier 3 — Nice to have
8. **Cute Charm/Infatuation** — rarely game-deciding
9. **Partial trapping** — Magma Storm, Fire Spin damage
10. **Type-changing moves** — very niche
