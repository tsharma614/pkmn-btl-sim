# Task: Move Details, Pokemon Details Polish, Online Play Bugs

Three areas that need work. Do them in order.

---

## 1. Move Details During Move Select

When the player is picking moves for their team (MoveSelectionScreen or wherever moves are chosen), each move should show full details:
- Type (with type color)
- Category (Physical/Special/Status)
- Power
- Accuracy
- PP
- Effect description (e.g. "May cause flinching", "Lowers target's Defense by 1 stage")

This should be visible either inline or via long press. Check what's already there and make it actually useful — not just a move name.

## 2. Pokemon Detail Modal Polish

The PokemonDetailModal (used in budget draft, gauntlet starter, steal screen, shop) is buggy and vague. Fix it to show:

- Pokemon name + sprite (front facing)
- Typing with type color badges
- Ability name + short description of what it does
- Base stats (HP, Atk, Def, SpA, SpD, Spe) as bars or numbers
- Full moveset (if the Pokemon has been built with moves) with move type/power/accuracy
- Held item (if assigned)
- Tier badge (Mega, T1, T2, T3)

Make sure:
- It renders correctly for ALL Pokemon (no crashes on missing data)
- It looks clean and readable, not cramped
- Long press works consistently on every screen where Pokemon are shown:
  - BudgetDraftScreen
  - GauntletStarterScreen
  - GauntletStealScreen
  - ShopScreen
  - ItemSelectScreen (long press the Pokemon you're assigning items to)
  - Team preview before battle

Test every screen manually by reading the code — verify the onLongPress handler is wired up and passes the correct species data.

## 3. Online Play — Find and Fix Connection Bugs

Tanmay says he struggles to even connect in online play. Audit the full online flow:

### Read and understand the flow:
- How does room creation work? (Socket.io server)
- How does joining work?
- What happens on disconnect/reconnect?
- Where are the known failure points?

### Common connection issues to check:
- **Room code sharing** — is the deep link / share working?
- **Socket timeout** — what's the timeout? Is it too short?
- **Reconnection logic** — does it auto-reconnect on drop? How many retries?
- **State sync** — if one player is ahead, does it catch up?
- **Error handling** — what happens when connection fails? Does the user see a helpful message or does it just hang?

### Write tests:
- Room creation succeeds
- Second player joins successfully
- Disconnect mid-battle triggers reconnection
- Reconnection restores battle state
- Timeout shows error message to user
- Draft sync works (both players see same pool)

### Fix any bugs you find. Common ones:
- Socket not connecting because server URL is wrong or hardcoded to localhost
- No error feedback — user just sees a spinner forever
- Race conditions in draft phase
- Reconnection not restoring the correct battle state

## After
- `npx vitest run` — all pass
- Commit each section separately
- Rename to TASK-POLISH-DONE.md
