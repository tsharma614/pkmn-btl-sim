/**
 * Disconnect tracker: manages 2-minute auto-forfeit timers
 * when a player disconnects mid-battle.
 */

export interface DisconnectEntry {
  roomCode: string;
  playerIndex: 0 | 1;
  playerName: string;
  timer: ReturnType<typeof setTimeout>;
  disconnectedAt: number;
}

export class DisconnectTracker {
  private timers: Map<string, DisconnectEntry> = new Map();
  private timeoutMs: number;

  constructor(timeoutMs: number = 2 * 60 * 1000) {
    this.timeoutMs = timeoutMs;
  }

  /** Start a disconnect timer. Returns the key for cancellation. */
  startTimer(
    roomCode: string,
    playerIndex: 0 | 1,
    playerName: string,
    onExpire: () => void
  ): string {
    const key = `${roomCode}:${playerIndex}`;

    // Clear any existing timer for this slot
    this.cancelTimer(key);

    const timer = setTimeout(onExpire, this.timeoutMs);

    this.timers.set(key, {
      roomCode,
      playerIndex,
      playerName,
      timer,
      disconnectedAt: Date.now(),
    });

    return key;
  }

  /** Cancel a disconnect timer (e.g. on reconnect). Returns true if cancelled. */
  cancelTimer(key: string): boolean {
    const entry = this.timers.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      this.timers.delete(key);
      return true;
    }
    return false;
  }

  /** Cancel timer by room code and player name (for reconnect lookups). */
  cancelByRoomAndName(roomCode: string, playerName: string): boolean {
    for (const [key, entry] of this.timers) {
      if (entry.roomCode === roomCode && entry.playerName === playerName) {
        clearTimeout(entry.timer);
        this.timers.delete(key);
        return true;
      }
    }
    return false;
  }

  /** Get a pending disconnect entry by room code. */
  getByRoom(roomCode: string): DisconnectEntry | undefined {
    for (const entry of this.timers.values()) {
      if (entry.roomCode === roomCode) {
        return entry;
      }
    }
    return undefined;
  }

  /** Clean up all timers for a room. */
  clearRoom(roomCode: string): void {
    for (const [key, entry] of this.timers) {
      if (entry.roomCode === roomCode) {
        clearTimeout(entry.timer);
        this.timers.delete(key);
      }
    }
  }

  /** Clear all timers. */
  clearAll(): void {
    for (const entry of this.timers.values()) {
      clearTimeout(entry.timer);
    }
    this.timers.clear();
  }

  get activeTimerCount(): number {
    return this.timers.size;
  }
}
