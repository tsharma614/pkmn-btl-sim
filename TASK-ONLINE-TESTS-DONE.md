# Task: Online Play Connection Tests

The online play code was fixed but no tests were written. Write comprehensive tests for the full online flow.

---

## Tests to write (put in tests/integration/online-connection.test.ts or similar)

### Room creation
- Room creation returns a valid room code
- Room code is 4-6 characters
- Creating a room emits room_created event

### Joining
- Second player joins with valid code → receives joined event
- Invalid room code → receives room_error event (not silent hang)
- Room that's already full → receives room_error

### Draft sync
- Both players see the same draft pool
- Draft picks are synced (P1 picks → P2 sees it taken)
- Draft completes when both players have full teams

### Battle sync
- Move selections from both players are received
- Turn results are broadcast to both players
- Battle end is synced (both players see same result)

### Disconnect handling
- Player disconnects mid-battle → other player sees disconnect message
- Disconnected player reconnects within timeout → battle resumes
- Disconnected player doesn't reconnect → other player gets forfeit win
- Reconnection capped at 10 attempts (not infinite)

### Error feedback
- Socket error → dispatches DISCONNECTED (user sees error UI)
- Server rejection → dispatches DISCONNECTED
- Timeout after 20s → shows error

### Rematch
- After battle ends, rematch request from P1 → P2 sees rematch prompt
- Both accept → new draft starts
- One declines → both return to menu

## After
- `npx vitest run` — all pass
- Commit
- Rename to TASK-ONLINE-TESTS-DONE.md
