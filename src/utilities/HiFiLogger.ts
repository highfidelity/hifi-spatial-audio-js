/**
 * This utility Module contains code related to logging from within API functions.
 * @packageDocumentation
 */

/**
 * Used for determining what data the High Fidelity Audio Client API should print to the console. 
 */
export enum HiFiLogLevel {
    None = "None",
    Error = "Error",
    Warn = "Warn",
    Debug = "Debug",
}

/**
 * A wrapper for API-internal `console.*()` calls, gated by the user's current log level.
 */
export class HiFiLogger {
    static logLevel: HiFiLogLevel = HiFiLogLevel.Error;

    /**
     * @param logLevel The initial Log Level for our Logger.
     */
    constructor(logLevel?: HiFiLogLevel) {
        logLevel = logLevel ? logLevel : HiFiLogLevel.Debug;
    }

    /**
     * Sets a new HiFi Log Level.
     * @param newLogLevel The new Log Level for our Logger.
     */
    static setHiFiLogLevel(newLogLevel: HiFiLogLevel): void {
        HiFiLogger.logLevel = newLogLevel;
    }

    /**
     * If the Logger's log level is `Debug`, will print a debug log to the logs.
     * @param message The message to log.
     * @returns `true` if the message was output to the console; `false` otherwise.
     */
    static log(message: string): boolean {
        if (HiFiLogger.logLevel === HiFiLogLevel.Debug) {
            console.log(message);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Does the same thing as {@link log}.
     * @param message
     * @returns `true` if the message was output to the console; `false` otherwise.
     */
    static debug(message: string): boolean {
        return this.log(message);
    }

    /**
     * If the Logger's log level is `Debug` or `Warn`, will print a warning log to the logs.
     * @param message The message to log.
     * @returns `true` if the message was output to the console; `false` otherwise.
     */
    static warn(message: string): boolean {
        if (HiFiLogger.logLevel === HiFiLogLevel.Debug || HiFiLogger.logLevel === HiFiLogLevel.Warn) {
            console.warn(message);
            return true;
        } else {
            return false;
        }
    }

    /**
     * If the Logger's log level is `Debug` or `Warn` or `Error`, will print an error log to the logs.
     * @param message The message to log.
     * @returns `true` if the message was output to the console; `false` otherwise.
     */
    static error(message: string): boolean {
        if (HiFiLogger.logLevel === HiFiLogLevel.Debug || HiFiLogger.logLevel === HiFiLogLevel.Warn || HiFiLogger.logLevel === HiFiLogLevel.Error) {
            console.error(message);
            return true;
        } else {
            return false;
        }
    }
}
