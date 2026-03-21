# Task: Restore Animated GIF Sprites + Bundle Locally

The sprite bundling task BROKE animated sprites by replacing everything with static PNGs. The original code used animated GIFs from `ani/` and `gen5ani/` directories. RESTORE THIS.

## What was lost
The original PokemonSprite.tsx (commit 56d0fa1) had:
- `ani/{spriteId}.gif` — 3D animated front sprites
- `ani-back/{spriteId}.gif` — 3D animated back sprites
- `gen5ani/{spriteId}.gif` — pixel animated fallback
- `home/{spriteId}.png` — static fallback
- `toSpriteId()` function handling regional forms (raichualola → raichu-alola)
- `sprite-cache.ts` for caching downloaded sprites locally
- Fallback chain: animated → pixel animated → static

## What to do

1. Download animated GIF sprites and bundle them locally:
   - `assets/sprites/ani/{spriteId}.gif` — front animated
   - `assets/sprites/ani-back/{spriteId}.gif` — back animated
   - Fallback to `assets/sprites/{spriteId}.png` (already bundled) for Pokemon without GIFs

2. CRITICAL: Use `toSpriteId()` for URL/filename mapping:
   - Regional forms: raichualola → raichu-alola
   - Megas: mega-charizard-x, mega-garchomp, etc.
   - Paradox Pokemon: roaring-moon, iron-valiant, etc.
   - Check EVERY Pokemon in the pokedex and make sure the sprite ID matches Showdown's naming

3. Update PokemonSprite component:
   - Battle screen: use animated GIF (front for opponent, back for player)
   - UI screens (draft, preview, modals): keep static PNG (faster)
   - Enable GIF support in React Native if needed

4. Generate sprite map files for animated sprites just like the static ones

5. Triple-check these tricky Pokemon:
   - Roaring Moon, Iron Valiant, Iron Hands (Paradox)
   - All Mega evolutions (mega-charizard-x, mega-charizard-y, mega-garchomp, etc.)
   - All regional forms (alola, galar, hisui, paldea)
   - All alternate forms

## Size
If total GIFs are too large (100MB+), only bundle front animated. Use static PNGs for back sprites.

## After
- Battle screen shows animated idle sprites
- ALL Pokemon render correctly including Megas, regionals, Paradox
- Works fully offline
- `npx vitest run` — all pass
- Deploy
- Rename to TASK-ANIMATED-SPRITES-DONE.md
