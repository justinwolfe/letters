/**
 * Simple logging utility with different log levels
 *
 * Provides a singleton logger instance with timestamped log messages
 * and configurable log levels for filtering output.
 *
 * @example
 * ```typescript
 * import { logger, LogLevel } from './lib/utils/logger.js';
 *
 * logger.info('Application started');
 * logger.debug('Debugging information');
 * logger.warn('Warning message');
 * logger.error('Error occurred', error);
 * logger.success('Operation completed successfully');
 *
 * // Change log level
 * logger.setLevel(LogLevel.DEBUG);
 * ```
 */

/**
 * Log severity levels
 *
 * Lower values indicate more verbose logging:
 * - DEBUG: Detailed diagnostic information
 * - INFO: General informational messages
 * - WARN: Warning messages for potentially harmful situations
 * - ERROR: Error messages for failures
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Simple logger implementation with timestamped messages
 */
class Logger {
  private level: LogLevel;

  /**
   * Create a new logger instance
   *
   * @param level - Initial log level (default: INFO)
   */
  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * Set the logging level
   *
   * @param level - The new log level
   *
   * @example
   * ```typescript
   * logger.setLevel(LogLevel.DEBUG); // Show all messages
   * logger.setLevel(LogLevel.ERROR); // Only show errors
   * ```
   */
  setLevel(level: LogLevel) {
    this.level = level;
  }

  /**
   * Log a debug message (only visible when level is DEBUG)
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  /**
   * Log an informational message
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO]  ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  /**
   * Log a warning message
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN]  ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  /**
   * Log an error message
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  /**
   * Log a success message (shown at INFO level)
   *
   * @param message - The message to log
   * @param args - Additional arguments to log
   */
  success(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(`[✓]     ${new Date().toISOString()} ${message}`, ...args);
    }
  }
}

/**
 * Singleton logger instance
 *
 * Use this exported instance throughout the application for consistent logging.
 */
export const logger = new Logger();
