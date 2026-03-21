# Task: Bundle ALL Visual Assets Locally

Pokemon sprites are bundled (653). Now bundle EVERYTHING else that loads from network.

## Trainer Sprites
- Download all trainer sprites used in gym career, E4, champion, gauntlet opponents
- Source: https://play.pokemonshowdown.com/sprites/trainers/
- Check which trainer names are referenced in the code (gym leaders, E4 data, bot names)
- Download each as PNG into assets/sprites/trainers/
- Update trainer sprite component to load locally

## Item Sprites
- Download all 20 held item icons used in ItemSelectScreen
- Source: https://play.pokemonshowdown.com/sprites/itemicons/
- Save to assets/sprites/items/
- Update item display to load locally

## Type Icons
- If type badges/icons load from network, bundle them too
- Check if they're already local or CSS-based

## Move Type Icons
- Same — check if move type indicators load from network

## Anything Else From Showdown
- Check EVERY URL reference in the codebase: `grep -r "pokemonshowdown.com" src/`
- Whatever is found, download and bundle it
- The app should make ZERO network requests for visual assets

## After
- Test with airplane mode — everything renders
- `npx vitest run` — all pass
- Commit + deploy
- Rename to TASK-ALL-ASSETS-DONE.md
