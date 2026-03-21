# Task: Bundle ALL Sprites Locally — NO NETWORK

The app currently loads sprites from play.pokemonshowdown.com at runtime. This means no sprites when offline. This is unacceptable — the app MUST work fully offline.

## What to do

1. Download EVERY sprite used in the game as PNG files into the app bundle (assets/ or a sprites/ directory)
2. Use the home/front sprite URLs from Showdown: `https://play.pokemonshowdown.com/sprites/home/{speciesId}.png`
3. For every Pokemon in the pokedex data, download its sprite
4. Update PokemonSprite component to load from the LOCAL bundle using require() or Image(name:) — NOT from a URL
5. Remove ALL network sprite loading code (sprite-cache.ts, URL fetching, fallbacks)
6. The app must show all sprites with airplane mode on

## Script

Write a download script (Node.js or Python) that:
- Reads all species IDs from the pokedex data
- Downloads each sprite PNG from Showdown
- Saves to assets/sprites/{speciesId}.png
- Generates an index file mapping speciesId → require path

## After
- Verify sprites load with NO internet (airplane mode equivalent)
- `npx vitest run` — all pass
- Commit (will be a big commit with all the PNGs)
- Deploy to TestFlight
- Rename to TASK-BUNDLE-SPRITES-DONE.md
