/**
 * Simple logging utility with different log levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO]  ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN]  ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  success(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[✓]     ${new Date().toISOString()} ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
