# Pokemon Battle Simulator

## Startup

**On launch or when told "do pending tasks":** check for any `TASK*.md` files in the project root. Read them and execute. When done, rename the file to `TASK*-DONE.md`.

## Global Rules

Read `~/repos/agent-hub/global-constraints.md` before doing anything. Those rules override everything.

## Project

- **Stack**: React Native / Expo, TypeScript, Socket.io
- **Bundle ID**: com.tanmay.pbs
- **Tests**: `npx vitest run`
- **iOS build**: see global-constraints.md for TestFlight deploy steps

## Key Directories

```
src/
├── client/          # React Native UI
│   ├── components/  # Screens and overlays
│   ├── state/       # battle-context.tsx, battle-reducer.ts
│   └── utils/       # stats-storage, helpers
├── data/            # pokedex, starters, elite-four, moves, abilities
├── engine/          # team-generator, battle engine, draft-pool
└── server/          # Socket.io server for online play
tests/               # vitest tests
```
