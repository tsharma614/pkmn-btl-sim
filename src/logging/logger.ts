export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

const LOG_LEVELS: Record<LogLevel, number> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

export interface LogEntry {
  level: LogLevel;
  timestamp: string;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface TurnLog {
  battleId: string;
  turn: number;
  timestamp: string;
  phase: string;
  player1Action: Record<string, unknown>;
  player2Action: Record<string, unknown>;
  resolutionOrder: string[];
  events: Record<string, unknown>[];
  endOfTurn: Record<string, unknown>;
}

export class BattleLogger {
  private logs: LogEntry[] = [];
  private turnLogs: TurnLog[] = [];
  private minLevel: LogLevel;
  private battleId: string;

  constructor(battleId: string, minLevel: LogLevel = 'DEBUG') {
    this.battleId = battleId;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.minLevel];
  }

  log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      category,
      message,
      data,
    };
    this.logs.push(entry);
    if (level === 'ERROR' || level === 'WARN') {
      console.error(`[${level}] [${category}] ${message}`, data || '');
    }
  }

  error(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('ERROR', category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('WARN', category, message, data);
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('INFO', category, message, data);
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('DEBUG', category, message, data);
  }

  trace(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('TRACE', category, message, data);
  }

  logTurn(turnLog: TurnLog): void {
    this.turnLogs.push(turnLog);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getTurnLogs(): TurnLog[] {
    return [...this.turnLogs];
  }

  getFullBattleLog(): {
    battleId: string;
    logs: LogEntry[];
    turns: TurnLog[];
  } {
    return {
      battleId: this.battleId,
      logs: this.logs,
      turns: this.turnLogs,
    };
  }

  exportJSON(): string {
    return JSON.stringify(this.getFullBattleLog(), null, 2);
  }
}
