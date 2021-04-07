/**
 * This module defines a number of constants used throughout the API code.
 * @packageDocumentation
 */

/**
 * Defines a number of constants used throughout the API code.
 */
export class HiFiConstants {
    /**
     * Defines the minimum amount of time that must pass between API transmission
     * of data from the client to the server.
     */
    static MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS: number = 10;
    /**
     * Defines the default amount of time that must pass between API transmission
     * of data from the client to the server.
     */
    static DEFAULT_TRANSMIT_RATE_LIMIT_TIMEOUT_MS: number = 50;
    /**
     * The production endpoint for our High Fidelity audio connections.
     */
    static DEFAULT_PROD_HIGH_FIDELITY_ENDPOINT: string = "api.highfidelity.com";
    /**
     * The default port for signaling connections to our High Fidelity audio servers.
     */
    static DEFAULT_PROD_HIGH_FIDELITY_PORT: number = 443;

    constructor() {}
};
