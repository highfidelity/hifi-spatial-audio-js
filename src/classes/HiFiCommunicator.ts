/**
 * Methods on the [[HiFiCommunicator]] class allow developers to perform actions such as:
 * - `connectToHiFiAudioAPIServer()`: Connect to and disconnect from the High Fidelity Audio Server
 * - `updateUserDataAndTransmit()`: Update the user's data (position, orientation, etc) on the High Fidelity Audio Server
 * - `setInputAudioMediaStream()`: Set a new input audio media stream (for example, when the user's audio input device changes)
 * @packageDocumentation
 */

declare var HIFI_API_VERSION: string;

import { HiFiConstants } from "../constants/HiFiConstants";
import { WebRTCSessionParams, CustomSTUNandTURNConfig } from "../libravi/RaviSession";
import { HiFiLogger } from "../utilities/HiFiLogger";
import { HiFiUtilities } from "../utilities/HiFiUtilities";
import { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, Point3D, OrientationQuat3D, OrientationEuler3D, OrientationEuler3DOrder, eulerToQuaternion, eulerFromQuaternion, OtherUserGainMap } from "./HiFiAudioAPIData";
import { HiFiAxisConfiguration, HiFiAxisUtilities, ourHiFiAxisConfiguration } from "./HiFiAxisConfiguration";
import { HiFiMixerSession, SetOtherUserGainForThisConnectionResponse, SetOtherUserGainsForThisConnectionResponse, OnMuteChangedCallback, ConnectionAttemptResult } from "./HiFiMixerSession";
import { AvailableUserDataSubscriptionComponents, UserDataSubscription } from "./HiFiUserDataSubscription";

/**
 * When the state of the connection to the High Fidelity Audio Server changes, the new state will be one of these values.
 */
export enum HiFiConnectionStates {
    /**
     * The `HiFiConnectionState` will be `"Disconnected"` when the HiFiCommunicator is not connected to the
     * High Fidelity servers. This is the initial state of a new HiFiCommunicator. 
     * For a HiFiCommunicator that has been previously connected and has since disconnected, 
     * if the disconnection was due to a failure, the state will first go to `"Failed"`
     * and will then settle on `"Disconnected"` once fully disconnected. If the disconnection was triggered
     * by a user action (i.e. as the result of calling \`disconnectFromHiFiAudioAPIServer()\`), the state will
     * first go to `"Disconnecting"` and will then settle on `"Disconnected"` once fully disconnected.
     */
    Disconnected = "Disconnected",
    /**
     * The `HiFiConnectionState` will be `"Connecting"` when the system is in the process of trying to establish
     * an initial connection. If the HiFiCommunicator is configured for autoretries of initial connections, the state will remain in
     * `"Connecting"` until all retry attempts (if needed) have completed. If the connection has not been established
     * once all of the retries have been attempted, the state will then go to `"Failed"` and finally to `"Disconnected"`.
     */
    Connecting = "Connecting",
    /**
     * The `HiFiConnectionState` will be `"Connected"` when the system has an active connection to the High Fidelity
     * servers.
     */
    Connected = "Connected",
    /**
     * The `HiFiConnectionState` will be `"Reconnecting"` if the system is in the process of trying to
     * automatically re-establish a pre-existing connection. If the HiFiCommunicator is configured for 
     * autoreconnects of dropped connections, the state will remain in `"Reconnecting"` until all
     * reconnection attempts have completed. If the connection has not been established once all of
     * the reconnection attempts have been tried, the state will then go to `"Failed"` and finally to `"Disconnected"`.
     */
    Reconnecting = "Reconnecting",
    /**
     * The `HiFiConnectionState` will be `"Disconnecting"` when the \`disconnectFromHiFiAudioAPIServer()\`
     * is called and while the connection is in the process of being disconnected.
     */
    Disconnecting = "Disconnecting",
    /**
     * The `HiFiConnectionState` will be `"Failed"` if the HiFiCommunicator attempted to connect (or reconnect) to the
     * High Fidelity servers and was unable to make a connection, or if an existing connection was disconnected unexpectedly
     * and couldn't be automatically reconnected (if configured).
     * After going to `"Failed"`, the connection state will proceed automatically to `"Disconnected"`. (Failed is a transition
     * state indicating that the disconnection is due to a failure.)
     * Note that if an unexpected disconnect is being automatically retried, the state will be `"Reconnecting"` instead;
     * the connection state will not go to `"Failed"` until / unless the reconnection attempt fails completely.
     */
    Failed = "Failed",
    /**
     * The `HiFiConnectionState` will be `"Unavailable"` when the API Server is at capacity.
     */
    Unavailable = "Unavailable"
};

/**
 * 
 */
export enum HiFiUserDataStreamingScopes {
    /**
     * Passing this value to the {@link HiFiCommunicator} constructor means that the Server will not send any
     * User Data updates to the client, meaning User Data Subscriptions will not function. This Streaming Scope
     * saves bandwidth and, marginally, processing time.
     */
    None = "none",
    /**
     * Passing this value to the {@link HiFiCommunicator} constructor means that the Server will only send
     * _peer data_ to the Client; the Server will not send User Data pertaining to the connecting Client when
     * this Data Streaming Scope is selected.
     */
    Peers = "peers",
    /**
     * "all" is the default value when the {@link HiFiCommunicator} constructor is called. All User Data
     * will be streamed from the Server to the Client.
     */
    All = "all"
};

export interface ConnectionRetryAndTimeoutConfig {
  /**
   * Whether or not to automatically retry initial connection attempts.
   * When this is set to true, if the first attempt to connect to
   * the High Fidelity servers fails, we will automatically retry the connection.
   * While the connection is being attempted, the overall HiFiCommunicator state (as queried via
   * `getConnectionState()`) will be "Connecting".
   * After the desired amount of time has passed, if a connection has not been established, we will stop
   * trying to reconnect and the connection state will change to 'Failed'.
   * By default, connections are not retried. However, when we start a connection, we do always
   * trigger a state change to HiFiConnectionStates.Connecting when we start the
   * connection process, regardless of the setting of this value.
   *
   */
  autoRetryInitialConnection?: boolean;
  /**
   * The total amount of time (in seconds) to keep retrying the initial
   * connection before giving up completely. If `autoRetryInitialConnection`
   * is set to `true`, this defaults to 60 seconds.
   * TODO: Don't let this be negative
   */
  maxSecondsToSpendRetryingInitialConnection?: number;

  /**
   * Whether or not to automatically attempt to reconnect if an existing
   * connection is disconnected. When this is set to true, we will attempt
   * to reconnect if any disconnect from any cause occurs.
   * By default, reconnections are not automatically attempted.
   * NOTE: The retrying that happens when this is set to `true` does not currently take into account
   * the reason WHY a connection was disconnected. This means that if this is
   * set to true, a connection that is disconnected via a purposeful server-side
   * action (e.g. a "kick") will be automatically reconnected. (However, connections
   * that are explicitly closed from the client side via the `disconnectFromHiFiAudioAPIServer()`
   * method will stay closed.)
   */
  autoRetryOnDisconnect?: boolean;
  /**
   * The total amount of time (in seconds) to keep trying to reconnect
   * if an existing connection is disconnected. While the connection is
   * being attempted, the state will be "Connecting". After this amount of time
   * has passed, if a connection has not been established, we will stop
   * trying to reconnect and set the connection state to 'Failed'.
   * If `autoRetryOnDisconnect` is set to `true`, this defaults to 300 seconds (5 minutes).
   * TODO: Don't let this be negative
   */
  maxSecondsToSpendRetryingOnDisconnect?: number;
  
  pauseBetweenRetriesMS?: number;
  /**
   * The amount of time in milliseconds to wait before timing out an attempted
   * connection. This is used for all connection attempts, including retries
   * (if enabled). Defaults to 5000 milliseconds (5 seconds).
   */
  timeoutPerConnectionAttemptMS?: number;
};

/**
 * This class exposes properties and methods useful for communicating from the High Fidelity Audio API Client to
 * the High Fidelity Audio API Server. 
 */
export class HiFiCommunicator {
    // Prevents users of our client-side API from slamming their mixer with requests.
    // Of course, because this rate limit is clientside, it could be worked around.
    transmitRateLimitTimeoutMS: number;
    private _timers: any = {
        transmitRateLimitTimeout: null,
        wantedToTransmitHiFiAudioAPIData: true
    };

    // This is usually the `MediaStream` associated with a user's audio input device,
    // but it could be any `MediaStream`.
    private _inputAudioMediaStream: MediaStream;

    // These next two member variables are used for keeping track of what to send to the mixer.
    // The client only sends data that the mixer doesn't already know about.
    private _currentHiFiAudioAPIData: HiFiAudioAPIData;
    private _lastTransmittedHiFiAudioAPIData: HiFiAudioAPIData;

    // Library users can make use of "User Data Subscriptions" to cause something to happen
    // when the server reports that a user's data - such as position, orientation, and volume - has been modified.
    private _userDataSubscriptions: Array<UserDataSubscription>;

    /**
     * See {@link HiFiCommunicator._onUsersDisconnected}.
     */
    onUsersDisconnected: Function;
    /**
     * This is a function that will get called when the "connection state" changes. It should be set
     * when the HiFiCommunicator object is first constructed. (Note that if a connection state re-triggers --
     * e.g. if a "Closed" connection is closed again -- this will not be called. It only gets called when the
     * new state is different than the previous state.)
     */
    onConnectionStateChanged: Function;

    /**
     * Stores the current HiFi Connection State, which is an abstraction separate from the individual states
     * of the WebRTC (RAVI Session) state and the RAVI Signaling State. The connection state starts
     * at "Disconnected" until a connection attempt has been made.
     */
    private _currentHiFiConnectionState: HiFiConnectionStates = HiFiConnectionStates.Disconnected;
    /**
     * @returns The current state of the connection to High Fidelity, as one of the HiFiConnectionStates.
     * This will return null if the current state is not available (e.g. if the HiFiCommunicator
     * is still in the process of initializing its underlying HiFiMixerSession).
     */
    getConnectionState(): HiFiConnectionStates {
        return this._currentHiFiConnectionState;
    }


    // This contains data dealing with the mixer session, such as the RAVI session, WebRTC address, etc.
    private _mixerSession: HiFiMixerSession;

    private _webRTCSessionParams?: WebRTCSessionParams;
    private _customSTUNandTURNConfig?: CustomSTUNandTURNConfig;

    private _connectionRetryAndTimeoutConfig: ConnectionRetryAndTimeoutConfig;
    private _retryTimerInProgress: any;
    private _failureNotificationPending: ConnectionAttemptResult; // Stores the most recent failure notification message
    private _resolveOpen: Function;
    private _rejectOpen: Function;

    /**
     * Constructor for the HiFiCommunicator object. Once you have created a HiFiCommunicator, you can use the
     * {@link setInputAudioMediaStream} method to assign an input audio stream to the connection, and
     * once the connection has been established, use the {@link getOutputAudioMediaStream} method to
     * retrieve the output audio from the server.
     * @param {Object} __namedParameters
     * @param initialHiFiAudioAPIData - The initial position, orientation, etc of the user.
     * @param onConnectionStateChanged - A function that will be called when the connection state to the High Fidelity Audio API Server changes. See {@link HiFiConnectionStates}.
     * @param onUsersDisconnected - A function that will be called when a peer disconnects from the Space.
     * @param transmitRateLimitTimeoutMS - User Data updates will not be sent to the server any more frequently than this number in milliseconds.
     * @param userDataStreamingScope - Cannot be set later. See {@link HiFiUserDataStreamingScopes}.
     * @param hiFiAxisConfiguration - Cannot be set later. The 3D axis configuration. See {@link ourHiFiAxisConfiguration} for defaults.
     * @param webrtcSessionParams - Cannot be set later. Extra parameters used for configuring the underlying WebRTC connection to the API servers.
     * These settings are not frequently used; they are primarily for specific jitter buffer configurations.
     * @param customSTUNandTURNConfig - Cannot be set later. This object can be used if specific STUN and TURN server information needs to be
     * provided for negotiating the underlying WebRTC connection. By default, High Fidelity's TURN server will be used, which should suffice
     * for most operations. This is primarily useful for testing or for using a commercial TURN server provider for dealing with particularly challenging client networks/firewalls.
     * See {@link CustomSTUNandTURNConfig} for the format of this object (note that _all_ values must be provided when setting this).
     * @param onMuteChanged - A function that will be called when the mute state of the client has changed, for example when muted by an admin. See {@link OnMuteChangedCallback} for the information this function will receive.
     * @param connectionRetryAndTimeoutConfig - Settings for configuring auto-reconnect behavior and the amount of time spent trying to connect before giving up.
     * See {@link ConnectionRetryAndTimeoutConfig} for the format of this object. Values that are omitted from the passed object will be set to their defaults.
     */
    constructor({
        initialHiFiAudioAPIData = new HiFiAudioAPIData(),
        onConnectionStateChanged,
        onUsersDisconnected,
        transmitRateLimitTimeoutMS = HiFiConstants.DEFAULT_TRANSMIT_RATE_LIMIT_TIMEOUT_MS,
        userDataStreamingScope = HiFiUserDataStreamingScopes.All,
        hiFiAxisConfiguration,
        webrtcSessionParams,
        customSTUNandTURNConfig,
        onMuteChanged,
        connectionRetryAndTimeoutConfig
    }: {
        initialHiFiAudioAPIData?: HiFiAudioAPIData,
        onConnectionStateChanged?: Function,
        onUsersDisconnected?: Function,
        transmitRateLimitTimeoutMS?: number,
        userDataStreamingScope?: HiFiUserDataStreamingScopes,
        hiFiAxisConfiguration?: HiFiAxisConfiguration,
        webrtcSessionParams?: WebRTCSessionParams,
        customSTUNandTURNConfig?: CustomSTUNandTURNConfig,
        onMuteChanged?: OnMuteChangedCallback,
        connectionRetryAndTimeoutConfig?: ConnectionRetryAndTimeoutConfig
    } = {}) {
        // If user passed in their own stun/turn config, make sure it matches our interface (ish).
        // (I do so wish that TypeScript could just do this for us based on the interface definition, but it seems that it can not.)
        if (customSTUNandTURNConfig) {
            if (!customSTUNandTURNConfig.hasOwnProperty("stunUrls") || !Array.isArray(customSTUNandTURNConfig.stunUrls) || customSTUNandTURNConfig.stunUrls.length == 0 ) {
                throw new Error(`\`customSTUNandTURNConfig.stunUrls\` must be specified and must be a list containing at least one STUN server.`);
            }
            if (!customSTUNandTURNConfig.hasOwnProperty("turnUrls") || !Array.isArray(customSTUNandTURNConfig.turnUrls) || customSTUNandTURNConfig.turnUrls.length == 0 ) {
                throw new Error(`\`customSTUNandTURNConfig.turnUrls\` must be specified and must be a list containing at least one TURN server.`);
            }
            if (!customSTUNandTURNConfig.hasOwnProperty("turnUsername")) {
                throw new Error(`\`customSTUNandTURNConfig.turnUsername\` must be specified.`);
            }
            if (!customSTUNandTURNConfig.hasOwnProperty("turnCredential")) {
                throw new Error(`\`customSTUNandTURNConfig.turnCredential\` must be specified.`);
            }
        }
        this._customSTUNandTURNConfig = customSTUNandTURNConfig;

        // Make minimum 10ms
        if (transmitRateLimitTimeoutMS < HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS) {
            HiFiLogger.warn(`\`transmitRateLimitTimeoutMS\` must be >= ${HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS}ms! Setting to ${HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS}ms...`);
            transmitRateLimitTimeoutMS = HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS;
        }
        this.transmitRateLimitTimeoutMS = transmitRateLimitTimeoutMS;

        if (onUsersDisconnected) {
            this.onUsersDisconnected = onUsersDisconnected;
        }
        if (onConnectionStateChanged) {
            this.onConnectionStateChanged = onConnectionStateChanged;
        }
        this._connectionRetryAndTimeoutConfig = HiFiConstants.DEFAULT_CONNECTION_RETRY_AND_TIMEOUT;
        if (connectionRetryAndTimeoutConfig) {
            Object.assign(this._connectionRetryAndTimeoutConfig, connectionRetryAndTimeoutConfig);
        }

        this._mixerSession = new HiFiMixerSession({
            "userDataStreamingScope": userDataStreamingScope,
            "onUserDataUpdated": (data: Array<ReceivedHiFiAudioAPIData>) => { this._handleUserDataUpdates(data); },
            "onUsersDisconnected": (data: Array<ReceivedHiFiAudioAPIData>) => { this._onUsersDisconnected(data); },
            "onConnectionStateChanged": (state: HiFiConnectionStates, message: ConnectionAttemptResult) => { this._manageConnection(state, message); },
            "onMuteChanged": onMuteChanged
        });

        this._inputAudioMediaStream = undefined;

        this._currentHiFiAudioAPIData = new HiFiAudioAPIData();

        this._lastTransmittedHiFiAudioAPIData = new HiFiAudioAPIData();

        this._userDataSubscriptions = [];

        if (webrtcSessionParams && webrtcSessionParams.audioMinJitterBufferDuration && (webrtcSessionParams.audioMinJitterBufferDuration < 0.0 || webrtcSessionParams.audioMinJitterBufferDuration > 10.0)) {
            HiFiLogger.warn(`The value of \`webrtcSessionParams.audioMinJitterBufferDuration\` (${webrtcSessionParams.audioMinJitterBufferDuration}) will be clamped to (0.0, 10.0).`);
            webrtcSessionParams.audioMinJitterBufferDuration = HiFiUtilities.clamp(webrtcSessionParams.audioMinJitterBufferDuration, 0.0, 10.0);
        }
        if (webrtcSessionParams && webrtcSessionParams.audioMaxJitterBufferDuration && (webrtcSessionParams.audioMaxJitterBufferDuration < 0.0 || webrtcSessionParams.audioMaxJitterBufferDuration > 10.0)) {
            HiFiLogger.warn(`The value of \`webrtcSessionParams.audioMaxJitterBufferDuration\` (${webrtcSessionParams.audioMaxJitterBufferDuration}) will be clamped to (0.0, 10.0).`);
            webrtcSessionParams.audioMaxJitterBufferDuration = HiFiUtilities.clamp(webrtcSessionParams.audioMaxJitterBufferDuration, 0.0, 10.0);
        }
        this._webRTCSessionParams = webrtcSessionParams;

        if (hiFiAxisConfiguration) {
            if (HiFiAxisUtilities.verify(hiFiAxisConfiguration)) {
                ourHiFiAxisConfiguration.rightAxis = hiFiAxisConfiguration.rightAxis;
                ourHiFiAxisConfiguration.leftAxis = hiFiAxisConfiguration.leftAxis;
                ourHiFiAxisConfiguration.intoScreenAxis = hiFiAxisConfiguration.intoScreenAxis;
                ourHiFiAxisConfiguration.outOfScreenAxis = hiFiAxisConfiguration.outOfScreenAxis;
                ourHiFiAxisConfiguration.upAxis = hiFiAxisConfiguration.upAxis;
                ourHiFiAxisConfiguration.downAxis = hiFiAxisConfiguration.downAxis;
                ourHiFiAxisConfiguration.handedness = hiFiAxisConfiguration.handedness;
                ourHiFiAxisConfiguration.eulerOrder = hiFiAxisConfiguration.eulerOrder;
            } else {
                HiFiLogger.error(`There is an error with the passed \`HiFiAxisConfiguration\`, so the new axis configuration was not set. There are more error details in the logs above.`);
            }
        }

        // Initialize the current Audio API Data with the given data, but use the 'updateUserData()' call for sanity.
        this._updateUserData(initialHiFiAudioAPIData);
    }

    /**
     * Connects to the High Fidelity Audio API server and transmits the initial user data to the server.
     * 
     * @param hifiAuthJWT  This JSON Web Token (JWT) is used by callers to associate a user with a specific High Fidelity Spatial Audio API Server.
     * JWTs are an industry-standard method for securely representing claims between two applications.
     * 
     * **Important information about JWTs:**
     * - **Do not expose JWTs to users!** Anyone with access to one of your JWTs will be able to connect to your High Fidelity Spatial Audio API Server.
     * - In your application's production environment, each client running your app code should connect to the High Fidelity Spatial Audio Server with a unique JWT.
     * In the case of a Web application, your application server code should generate a JWT associated with the user requesting your Web application.
     * 
     * To generate a JWT for use with the High Fidelity Audio API:
     * 1. Head to {@link https://jwt.io/} to find the appropriate library for your langauge.
     *     a. For NodeJS applications and Web applications compilied from NodeJS code, we recommend {@link https://www.npmjs.com/package/jose|jose}.
     * 2. Using the {@link https://account.highfidelity.com/dev/account|High Fidelity Audio API Developer Console},
     * obtain your App ID, Space ID, and App Secret.
     * 3. Create your user's JWT using the appropriate library, passing your App ID, Space ID, and App Secret. Here is an example of what that might look like, using NodeJS and `jose`:
     *     ```
     * hiFiSampleJWT = await new SignJWT({
     *     "app_id": APP_ID,
     *     "space_id": SPACE_ID
     * })
     * .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
     * .sign(crypto.createSecretKey(Buffer.from(APP_SECRET, "utf8")));
     *     ```
     * Please reference our {@link https://www.highfidelity.com/api/guides/misc/getAJWT|"Get a JWT" guide} for additional context.
     * 4. Pass the created JWT to `connectToHiFiAudioAPIServer()`.
     * 
     * @param signalingHostURL An URL that will be used to create a valid WebRTC signaling address at High Fidelity. The passed `signalingHostURL` parameter should not contain the protocol
     * or port - e.g. `server.highfidelity.com` - and it will be used to construct a signaling address of the form: `wss://${signalingHostURL}:${signalingPort}/?token=`
     * If the developer does not pass a `signalingHostURL` parameter, a default URL will be used instead. See: {@link DEFAULT_PROD_HIGH_FIDELITY_ENDPOINT}
     * Reading this parameter from the URL (if needed) should be implemented by the developer as part of the application code.
     *
     * @param signalingPort The port to use for making WebSocket connections to the High Fidelity servers.
     * If the developer does not pass a `signalingPort` parameter, the default (443) will be used instead. See: {@link DEFAULT_PROD_HIGH_FIDELITY_PORT}
     * 
     * @returns If this operation is successful, the Promise will resolve with `{ success: true, audionetInitResponse: <The response to `audionet.init` from the server in Object format>}`.
     * If unsuccessful, the Promise will reject with `{ success: false, error: <an error message> }`.
     */
    async connectToHiFiAudioAPIServer(hifiAuthJWT: string, signalingHostURL?: string, signalingPort?: number): Promise<any> {
        if (!this._mixerSession) {
            let errMsg = `\`this._mixerSession\` is falsey; try creating a new HiFiCommunicator and starting over.`;
            return Promise.reject({
                success: false,
                error: errMsg
            });
        }

        if ([HiFiConnectionStates.Connected, HiFiConnectionStates.Connecting, HiFiConnectionStates.Reconnecting].includes(this.getConnectionState())) {
            let msg = `Session is already connected or is in the process of connecting! If you need to reset the connection, please disconnect fully using \`disconnectFromHiFiAudioAPIServer()\` and call this method again.`;
            return Promise.resolve({
                success: true,
                error: msg
            });
        }


        let signalingHostURLSafe;

        try {
            let url = new URL(signalingHostURL);
            signalingHostURLSafe = url.hostname;
            if (signalingPort == null && url.port !== "") {
                // sometimes the signalingPort is specified in the signalHostURL in which case
                // we extract the port number rather than fallback to default
                signalingPort = Number(url.port);
            }
        } catch(e) {
            // If signalingHostURL is not defined, we assign the default URL
            signalingHostURLSafe = signalingHostURL ? signalingHostURL : HiFiConstants.DEFAULT_PROD_HIGH_FIDELITY_ENDPOINT;
        }

        signalingPort = signalingPort ? signalingPort : HiFiConstants.DEFAULT_PROD_HIGH_FIDELITY_PORT;
        let webRTCSignalingAddress = `wss://${signalingHostURLSafe}:${signalingPort}/?token=`;
        this._mixerSession.webRTCAddress = `${webRTCSignalingAddress}${hifiAuthJWT}`;
        HiFiLogger.log(`Using WebRTC Signaling Address:\n${webRTCSignalingAddress}<token redacted>`);

        // When making the initial connection, this connection method's promise shouldn't
        // resolve or reject until all retries have been attempted.
        // In order to do that, we're going to create a new Promise object and
        // stash its resolve and reject functions on `this` (our HiFiCommunicator object),
        // so that the methods that handle retrying can appropriately call the resolve
        // or reject function once they're done with the retry attempts.
        let communicator = this;
        communicator._failureNotificationPending = undefined;
        return new Promise((resolve, reject) => {
            // This promise will get resolved later by `this._manageConnection` once
            // the state changes to Connected!
            communicator._resolveOpen = resolve;
            communicator._rejectOpen = reject;

            // The connection manager is what is in charge of determining whether
            // or not connection attempts succeed, whether or not they should
            // be retried, when the user-supplied state change handler
            // should get called, and whether this Promise gets rejected or
            // resolved. By telling it that the new state should be "Connecting",
            // we're triggering it to try making a connection (and to deal with the
            // fallout from that attempt). If that attempt fails, the connection manager
            // (`"this._manageConnection"`) will decide whether to keep trying, or to go ahead and
            // reject the promise. (And if it succeeds, the state change
            // handler will resolve the promise.)
            this._manageConnection(HiFiConnectionStates.Connecting);
        });
    }


    /**
     * Attempt to make a connection based on all of the information that we've gathered so far.
     * This should only be called by or after connectToHiFiAudioAPIServer(), because it
     * relies on connectToHiFiAudioAPIServer() having set up this._mixerSession appropriately.
     */
    private _connectToHiFiMixer(): void {
        if (!this._mixerSession || !this._mixerSession.webRTCAddress) {
            this._manageConnection(HiFiConnectionStates.Failed, { success: false, message: "_connectToHiFiMixer() must be called after connectToHiFiAudioAPIServer()" });
        }
        // This should never get called unless we are reasonably certain that the session is
        // NOT connected, but just in case.
        if (this._mixerSession.isConnected()) {
            let msg = `Session is already connected! If you need to reset the connection, please disconnect fully using \`disconnectFromHiFiAudioAPIServer()\` and call this method again.`;
            throw new Error(msg);
        }

        let timeoutPerConnectionAttempt = this._connectionRetryAndTimeoutConfig.timeoutPerConnectionAttemptMS;
        // Allow this call to be kicked off asynchronously. Calls to this method get handled
        // entirely by callback-initiated retry code, so this should not get called unless
        // a callback asked us to do it.
        this._mixerSession.connectToHiFiMixer({ webRTCSessionParams: this._webRTCSessionParams, customSTUNandTURNConfig: this._customSTUNandTURNConfig, timeout: timeoutPerConnectionAttempt });
    }

    /**
     * This method manages the connection to the High Fidelity servers. 
     *
     * Calling this method with the "Connecting" or "Reconnecting" states will trigger it to call the `_connectToHiFiMixer()`
     * method. This method handles when to resolve or reject the Promise that got opened by `connectToHiFiAudioAPIServer()`
     *
     * This method also manages things like auto-retries, when to call (and not to call) the customer-supplied
     * onConnectionStateChanged function, and keeping track of the current "overarching meta-state" of the
     * communicator as a whole (which might be different from the current state of the MixerSession, due to retries
     * and failures and the like). This method is passed directly into the MixerSession to serve as its state
     * change handler, but is also used internally to, well, manage the connection.
     *
     * @param newState The desired new state. If this is "Connecting" or "Reconnecting", the appropriate
     * method will be called to kick off a connection attempt. If this is "Failed" or "Disconnected", retries
     * will be attempted if they're configured.
     * @param message An optional message to include as part of the state change. This will be communicated
     * to users as part of the Reject or Resolve of the connection opening Promise.
     */
    private _manageConnection(newState: HiFiConnectionStates, message?: ConnectionAttemptResult): void {
        switch (newState) {
            case HiFiConnectionStates.Connecting:
            case HiFiConnectionStates.Reconnecting:
                /**
                 * The Connecting and Reconnecting states are only ever set explicitly, 
                 * either when the `connectToHiFiAudioAPIServer()` method is called (for "Connecting")
                 * or when this connection manager handles a failure (below).
                 * These are used to prompt this connection manager to start a (re-)connection attempt.
                 * They should always kick off a new connection attempt, UNLESS the current state is already "Connected".
                 */
                if (this._currentHiFiConnectionState !== HiFiConnectionStates.Connected) {
                    HiFiLogger.log(`_manageConnection: kicking off connection attempt.`);
                    this._updateStateAndCallUserStateChangeHandler(newState, message);
                    this._connectToHiFiMixer();
                } else {
                    HiFiLogger.warn(`_manageConnection called for ${newState} -- but already connected; taking no action.`);
                }
                return;

            case HiFiConnectionStates.Connected:
                /**
                 * A Connected state is set by the MixerSession if a connection attempt was successful.
                 * When it occurs, any timeouts for maxSecondsToSpendRetryingInitialConnection or
                 * maxSecondsToSpendRetryingOnDisconnect should be canceled. Additionally,
                 * an outstanding "connectToHiFiAudioServers" Promise should be resolved.
                 */
                clearTimeout(this._retryTimerInProgress);
                this._retryTimerInProgress = null;
                this._failureNotificationPending = undefined; // No need to let them know if we failed earlier; everything's OK now!
                // Finally, tell the user ("message" should be set to audionet.init by the mixer change handler)
                this._updateStateAndCallUserStateChangeHandler(newState, message);
                return;

            case HiFiConnectionStates.Disconnecting:
                /**
                 * The Disconnecting state is only ever set explicitly, when the `disconnectFromHiFiAudioAPIServer()` method is called,
                 * and is just used to track the fact that the user initiated the disconnection.
                 */
                this._updateStateAndCallUserStateChangeHandler(newState, message);
                return;

            case HiFiConnectionStates.Failed:
                /**
                 * When a Failure occurs, the HiFiMixerSession will automatically clean itself up by disconnecting
                 * completely. This means that this "Failed" state is going to transition to
                 * "Disconnected" real soon now. When it does, we're going to want to either
                 * retry, or give up and tell the user's state change handler that we've disconnected due to a
                 * failure. That means that we need to track the fact that we've encountered
                 * a failure. Do that here. (Note: We do NOT want to start a retry or trigger the user's
                 * callback UNTIL the disconnect has completed.)
                 */
                this._failureNotificationPending = message;
                return;

            case HiFiConnectionStates.Disconnected:
                /**
                 * A Disconnected state is set by the MixerSession when a connection disconnects. If the current state
                 * is "Disconnecting" (indicating that the user has explicitly called the disconnect method),
                 * then this is a normal and expected disconnect, and the customer's stateChangeHandler should be called
                 * and we're all done. However, if the current state is something else, we may want to retry.
                 */
                if (this._retryTimerInProgress) {
                    HiFiLogger.log("_manageConnection: Timer active; continuing to retry connection");

                    // `this._currentHiFiConnectionState` should already be
                    // either Connecting or Reconnecting, since there's a timer in play.
                    // (And if it's not, someone will hopefully let us know.)
                    if (this._currentHiFiConnectionState !== HiFiConnectionStates.Connecting &&
                                this._currentHiFiConnectionState !== HiFiConnectionStates.Reconnecting) {
                        HiFiLogger.warn(`_manageConnection handling reconnection, but encountered unexpected state ${this._currentHiFiConnectionState}; will attempt to reconnect, but please contact High Fidelity and report this message`);
                        // Fix the state; "Reconnecting" seems the best option at this point.
                        this._updateStateAndCallUserStateChangeHandler(HiFiConnectionStates.Reconnecting, message);
                    }
                    // Catch our breath (the "pauseBetweenRetriesMS" setting), and then retry again
                    setTimeout(() => {
                        // The current connection state is either "Connecting" or "Reconnecting"
                        // because we're already in the process of doing it. Re-calling with that
                        // same state will kick off another connection.
                        this._manageConnection(this._currentHiFiConnectionState);
                    }, this._connectionRetryAndTimeoutConfig.pauseBetweenRetriesMS);
                    return;
                } 

                // OK, we've dealt with the situation where there's already a retry cycle going.
                // Now see if we need to start one.
                let retriesTimeoutMs = 0;

                if (this._currentHiFiConnectionState === HiFiConnectionStates.Connecting &&
                            this._connectionRetryAndTimeoutConfig.autoRetryInitialConnection) {
                    // The user has started a connection attempt. It failed, and they want to retry.
                    retriesTimeoutMs = 1000 * this._connectionRetryAndTimeoutConfig.maxSecondsToSpendRetryingInitialConnection;

                } else if (this._currentHiFiConnectionState === HiFiConnectionStates.Reconnecting &&
                            this._connectionRetryAndTimeoutConfig.autoRetryOnDisconnect) {
                    // The user had previously been trying to reconnect. It failed, and they want to keep retrying.
                    // (Note - we're not even supposed to be here; this situation should have been
                    // caught by the "there's already a timer in play" logic above.
                    // However, bugs will be bugs, so log this unexpected event and handle it anyway.)
                    HiFiLogger.warn(`_manageConnection handling reconnection, but is being called for ${newState} and there isn't already a timer. Will attempt to reconnect, but please contact High Fidelity and report this message`);
                    retriesTimeoutMs = 1000 * this._connectionRetryAndTimeoutConfig.maxSecondsToSpendRetryingOnDisconnect;

                } else if (this._currentHiFiConnectionState === HiFiConnectionStates.Connected &&
                            this._connectionRetryAndTimeoutConfig.autoRetryOnDisconnect) {
                    // The user had previously been connected. They got disconnected, and they want to retry
                    retriesTimeoutMs = 1000 * this._connectionRetryAndTimeoutConfig.maxSecondsToSpendRetryingOnDisconnect;

                } else {
                    // If the current state is anything else, or if the user hasn't specified
                    // an autoretry, there's no more connecting or reconnecting to be done. Go straight to
                    // calling the customer's state change handler. Let them know about a failure if it
                    // had happened, then tell them about the disconnection.
                    if (this._failureNotificationPending) {
                        this._updateStateAndCallUserStateChangeHandler(HiFiConnectionStates.Failed, this._failureNotificationPending);
                        this._updateStateAndCallUserStateChangeHandler(HiFiConnectionStates.Disconnected, this._failureNotificationPending);
                    } else {
                        this._updateStateAndCallUserStateChangeHandler(HiFiConnectionStates.Disconnected, message);
                    }
                    this._failureNotificationPending = undefined; 
                    return;
                }

                // Timeout should be non-zero if we've made it this far, but just in case...
                if (retriesTimeoutMs >= 0) {
                    HiFiLogger.warn("_manageConnection: Attempting retry of connection with timeout " + retriesTimeoutMs);
                    // Set up a timer that will cancel the retries after the specified amount of time
                    this._retryTimerInProgress = setTimeout(() => {
                        this._cancelRetriedConnectionAttempts();
                    }, retriesTimeoutMs);

                    if (this._currentHiFiConnectionState === HiFiConnectionStates.Connected) {
                        // Set the state to "Reconnecting" if it's the first failure from a connected state.
                        this._updateStateAndCallUserStateChangeHandler(HiFiConnectionStates.Reconnecting, message);
                        setTimeout(() => {
                                this._manageConnection(HiFiConnectionStates.Reconnecting);
                        }, this._connectionRetryAndTimeoutConfig.pauseBetweenRetriesMS);
                    } else if (this._currentHiFiConnectionState === HiFiConnectionStates.Connecting) {
                        // We're kicking off an initial reconnect from a new attempt to connect, so
                        // stay at "Connecting".
                        setTimeout(() => {
                                this._manageConnection(HiFiConnectionStates.Connecting);
                        }, this._connectionRetryAndTimeoutConfig.pauseBetweenRetriesMS);
                    }
                }
                return;

            case HiFiConnectionStates.Unavailable:
                /**
                 * "Unavailable" means there isn't any room on the server; this is itself a
                 * "failure" and "disconnected" state and so no additional state changes should get called after this.
                 */
                this._updateStateAndCallUserStateChangeHandler(newState, message);
                return;

            default:
                HiFiLogger.error(`_manageConnection called for invalid state change to ${newState}; taking no action.`);
                return;
        }
    }

    /**
     * This method will handle updating the _currentHiFiConnectionState and notifying
     * the user's callback (when we're ready for that to happen). This will also resolve
     * or reject the Promise made by the `connectToHiFiAudioAPIServer()` method.
     * All updates to `this._currentHiFiConnectionState` should go through this method
     * unless there's a really good reason (e.g. `_cancelRetriedConnectionAttempts`)
     */
    private _updateStateAndCallUserStateChangeHandler(newState: HiFiConnectionStates, message?: ConnectionAttemptResult): void {
        if (newState === HiFiConnectionStates.Connected) {
            // Always transmit current data as soon as we connect, just to be sure
            this._transmitHiFiAudioAPIDataToServer(true);
        }

        // If the new state is different from the current state,
        // change the current state to the new state and call the user's handler.
        if (newState !== this._currentHiFiConnectionState) {
            this._currentHiFiConnectionState = newState;
            if (this.onConnectionStateChanged) {
                this.onConnectionStateChanged(this._currentHiFiConnectionState, message);
            }
        }

        // Also check to make sure there aren't any Promises that need fulfilling
        if (newState === HiFiConnectionStates.Connected && this._resolveOpen) {
            // Resolve the `connectToHiFiAudioAPIServer()` Promise if it's open.
            // "message" should've gotten set to audionet.init result by the MixerSession
            // using the audionetInitResponse that the HiFiMixerSession got when it connected.
            this._resolveOpen(message);
            this._resolveOpen = undefined;
            this._rejectOpen = undefined;
        }
        // If this._rejectOpen is _not_ undefined, this disconnect happened without ever opening
        // the connection in the first place (because that would've set it to undefined), and therefore is an error.
        if ((newState === HiFiConnectionStates.Disconnected || newState === HiFiConnectionStates.Unavailable) && this._rejectOpen) {
            let errMsg = message ? message : { success: false, message: "Open attempt timed out" };
            this._rejectOpen(message);
            this._resolveOpen = undefined;
            this._rejectOpen = undefined;
        }
    }

    /**
     * This method will cancel any connection attempts that are in progress,
     * and move the HiFiCommunicator state to "Failed". It is meant to be called
     * when an attempt to reconnect times out.
     */
    private _cancelRetriedConnectionAttempts(): void {
        HiFiLogger.warn("Cancelling retries of connections");
        clearTimeout(this._retryTimerInProgress);
        this._retryTimerInProgress = undefined;
        // Explicitly set the current state to "Failed" so that we don't
        // end up just kicking off another set of retries. This will get
        // messaged to the user once the `disconnectFromHiFiMixer` method
        // finishes up.
        if (! this._failureNotificationPending) this._failureNotificationPending = { success: false, message: "Connection retry attempts unsuccessful" }; 
        this._updateStateAndCallUserStateChangeHandler(HiFiConnectionStates.Failed, this._failureNotificationPending);
        this._mixerSession.disconnectFromHiFiMixer();
    }

    /**
     * Disconnects from the High Fidelity Audio API. After this call, user data will no longer be transmitted to High Fidelity, the audio
     * input stream will not be transmitted to High Fidelity, and the user will no longer be able to hear the audio stream from High Fidelity.
     */
    async disconnectFromHiFiAudioAPIServer(): Promise<string> {
        if (!this._mixerSession) {
            return Promise.resolve(`No mixer session from which we can disconnect!`);
        }
        if (this._currentHiFiConnectionState === HiFiConnectionStates.Disconnecting ||
                this._currentHiFiConnectionState === HiFiConnectionStates.Disconnected) {
            return Promise.resolve(`HiFiCommunicator is already disconnected or in the process of disconnecting.`);
        }
        // This is an explicit, user-triggered disconnection attempt. Set the state appropriately.
        this._manageConnection(HiFiConnectionStates.Disconnecting);

        this._lastTransmittedHiFiAudioAPIData = new HiFiAudioAPIData();

        return this._mixerSession.disconnectFromHiFiMixer();
    }


    /**
     *
     * NON-connection-handling methods below here
     *
     */

    /**
     * Adjusts the gain of another user for this communicator's current connection only. This is a single user version of {@link HiFiCommunicator.setOtherUserGainsForThisConnection}.
     * This can be used to provide a more comfortable listening experience for the client. If you need to perform moderation actions which apply server side, use the {@link https://docs.highfidelity.com/rest/latest/index.html|Administrative REST API}.
     * 
     * To use this command, the communicator must currently be connected to a space. You can connect to a space using {@link connectToHiFiAudioAPIServer}.
     * 
     * @param hashedVisitId  The hashed visit ID of the user whose gain will be adjusted.
     * Use {@link addUserDataSubscription} and {@link HiFiCommunicator.onUsersDisconnected} to keep track of the hashed visit IDs of currently connected users.
     * 
     * When you subscribe to user data, you will get a list of {@link ReceivedHiFiAudioAPIData} objects, which each contain, at minimum, {@link ReceivedHifiAudioAPIData.hashedVisitID}s and {@link ReceivedHifiAudioAPIData.providedUserID}s for each user in the space. By inspecting each of these objects, you can associate a user with their hashed visit ID, if you know their provided user ID.
     *
     * @param gain  The relative gain to apply to the other user. By default, this is `1.0`. The gain can be any value greater or equal to `0.0`.
     * For example: a gain of `2.0` will double the loudness of the user, while a gain of `0.5` will halve the user's loudness. A gain of `0.0` will effectively mute the user.
     * 
     * @returns If this operation is successful, the Promise will resolve with {@link SetOtherUserGainForThisConnectionResponse} with `success` equal to `true`.
     * If unsuccessful, the Promise will reject with {@link SetOtherUserGainForThisConnectionResponse} with `success` equal to `false` and `error` set to an error message describing what went wrong.
     */
    async setOtherUserGainForThisConnection(visitIdHash: string, gain: number): Promise<SetOtherUserGainForThisConnectionResponse> {
        let otherUserGainMap: OtherUserGainMap = {};
        otherUserGainMap[visitIdHash] = gain;
        let result = this.setOtherUserGainsForThisConnection(otherUserGainMap);
        return Promise.resolve(result);
    }

    /**
     * Adjusts the gain of one or more users for this communicator's current connection only.
     * This can be used to provide a more comfortable listening experience for the client. If you need to perform moderation actions on the server side, use the {@link https://docs.highfidelity.com/rest/latest/index.html|Administrative REST API}.
     * 
     * To use this command, the communicator must currently be connected to a space. You can connect to a space using {@link connectToHiFiAudioAPIServer}.
     * 
     * @param otherUserGainMap  The map between hashed visit IDs and the desired adjusted gains of users from the perspective of this client, for this connection only.
     * 
     * Use {@link addUserDataSubscription} and {@link HiFiCommunicator.onUsersDisconnected} to keep track of the hashed visit IDs of currently connected users.
     * 
     * When you subscribe to user data, you will get a list of {@link ReceivedHiFiAudioAPIData} objects, which each contain, at minimum, {@link ReceivedHifiAudioAPIData.hashedVisitID}s and {@link ReceivedHifiAudioAPIData.providedUserID}s for each user in the space. By inspecting each of these objects, you can associate a user with their hashed visit ID, if you know their provided user ID.
     * 
     * The relative gain will be applied to the other user with the matching hashed visit ID. By default, this is `1.0`. The gain can be any value greater or equal to `0.0`.
     * For example: a gain of `2.0` will double the loudness of the user, while a gain of `0.5` will halve the user's loudness. A gain of `0.0` will effectively mute the user.
     * 
     * @returns If this operation is successful, the Promise will resolve with {@link SetOtherUserGainsForThisConnectionResponse} with `success` equal to `true`.
     * If unsuccessful, the Promise will reject with {@link SetOtherUserGainsForThisConnectionResponse} with `success` equal to `false` and `error` set to an error message describing what went wrong.
     */
    async setOtherUserGainsForThisConnection(otherUserGainMap: OtherUserGainMap): Promise<SetOtherUserGainsForThisConnectionResponse> {
        Object.assign(this._currentHiFiAudioAPIData._otherUserGainQueue, otherUserGainMap);

        let result = this._transmitHiFiAudioAPIDataToServer();
        return Promise.resolve({
            success: result.success,
            error: result.error
        });
    }


    /**
     * @returns The final mixed audio `MediaStream` coming from the High Fidelity Audio Server.
     */
    getOutputAudioMediaStream(): MediaStream {
        if (this._mixerSession) {
            return this._mixerSession.getOutputAudioMediaStream();
        } else {
            return null;
        }
    }

    /**
     * Use this function to set the `MediaStream` associated with the user. This `MediaStream` will be sent up to the High Fidelity Audio Servers and
     * mixed with other users' audio streams. The resultant mixed stream will be sent to all connected clients.
     *
     * **Be mindful** of supplying this stream upon initial connection when you anticipate that the user is using Bluetooth audio
     * input and Bluetooth audio output simultaneously. Many Bluetooth audio devices do not support stereo (spatialized) audio
     * output and microphone audio input simultaneously, including the popular combination of an iPhone and AirPods.
     * Your users may have a better experience if they join the Server in "listen-only" mode - i.e. without microphone input - and then
     * are asked for microphone permission later (which will force their Bluetooth output device into a lower-quality, unspatialized mono mode).
     * 
     * @param newInputAudioMediaStream - The new `MediaStream` to send to the High Fidelity Audio Server. If this
     * is set to an `undefined` value, the existing input stream (if one is set) will be cleared.
     * @param isStereo - `true` if the input stream should be treated as stereo, `false` for mono (default).
     * @returns `true` if the new `MediaStream` was successfully set, `false` otherwise.
     */
    async setInputAudioMediaStream(newInputAudioMediaStream: MediaStream, isStereo: boolean = false): Promise<boolean> {
        const retval = await this._mixerSession.setRAVIInputAudio(newInputAudioMediaStream, isStereo);
        if (retval) {
            this._inputAudioMediaStream = newInputAudioMediaStream;
        } else {
            HiFiLogger.warn(`Error trying to setRAVIInputAudio on this._mixerSession`);
        }
        return retval;
    }

    /**
     * Use this function to set whether input audio stream will have the `enabled` property of each of its `MediaStreamTrack`s set to `false`
     * (and an unmuted stream -- the default -- will have the `enabled` property set to `true`). This will silence the input,
     * but has specific consequences:
     *   - If you are using the same `MediaStream` object in other ways, it will be affected by
     * calling this method. So, if you would like to mute/unmute the input audio stream separately for the
     * High Fidelity audio vs. some other use of it, it is recommended to clone the audio stream separately
     * for each use.
     *   - The effect is immediate and could result in a click or other audio artifact if there is steady sound at
     * the moment the input is muted.
     *
     * An alterative is to set the user's {@link volumeThreshold} to 0, which smoothly gates off the user's input.
     * @returns `true` if the stream was successfully muted/unmuted, `false` if it was not. (The user should
     * assume that if this returns `false`, no change was made to the mute (track enabled) state of the stream.)
     */
    async setInputAudioMuted(isMuted: boolean): Promise<boolean> {
        if (this._mixerSession) {
            HiFiLogger.debug(`Setting mute state to : ${isMuted}`);
            return await this._mixerSession.setInputAudioMuted(isMuted);
        } else {
            HiFiLogger.warn(`Couldn't set mute state: No \`_mixerSession\`.`);
            return false;
        }
    }

    /**
     * @returns A bunch of info about this `HiFiCommunicator` instantiation, including Server Version.
     */
    getCommunicatorInfo(): any {
        let retval: any = {
            "clientInfo": {
                "inputAudioStreamSet": !!this._inputAudioMediaStream,
            }
        };

        let isBrowserContext = typeof self !== 'undefined';
        if (isBrowserContext && typeof (HIFI_API_VERSION) === "string") {
            retval.clientInfo["apiVersion"] = HIFI_API_VERSION;
        }

        if (this._mixerSession && this._mixerSession.mixerInfo) {
            retval["serverInfo"] = this._mixerSession.mixerInfo;
        }

        return retval;
    }

    /**
     * Start collecting data about the WebRTC connection between Client and Server.
     * Note that the data inside the reports pertains only to payload data internal to the WebRTC connection
     * and does not include _total_ data sent over the wire or received over the wire in your application.
     * 
     * @param callback Callback functions will be provided two Array arguments: `stats` and `prevStats`.
     * Each of those Array items contains one or more Objects, which are reports of WebRTC stats data,
     * including data such as "a timestamp", "the number of bytes received since the last report" and "current jitter buffer delay".
     */
    startCollectingWebRTCStats(callback: Function) {
        if (!this._mixerSession) {
            HiFiLogger.error(`Couldn't start collecting WebRTC Stats: No \`_mixerSession\`!`);
        }

        this._mixerSession.startCollectingWebRTCStats(callback);
    }

    /**
     * Stop collecting data about the WebRTC connection between Client and Server.
     */
    stopCollectingWebRTCStats() {
        if (!this._mixerSession) {
            HiFiLogger.error(`Couldn't stop collecting WebRTC Stats: No \`_mixerSession\`!`);
        }

        this._mixerSession.stopCollectingWebRTCStats();
    }

    /**
     * Updates the internal copy of the User Data associated with the user associated with this client. Does **NOT** update
     * the user data on the High Fidelity Audio API server. There are no good reasons for a client to call this function
     * and _not_ update the server User Data, and thus this function is `private`.
     * 
     * You can update user orientation by passing Quaternion or Euler orientation representations to this function
     * The quaternion representation is preferred.
     * If both representation are provided, the euler representation is ignored.
     * If only the euler representation is provided, it is then converted immediately to the equivalent quaternion representation.
     * The eulerOrder used for the conversion is the provided by the 'ourAxisConfiguration.eulerOrder'.
     * Euler representation is not used internally anymore in the Hifi API.
     * 
     * @param __namedParameters
     * @param position - The new position of the user.
     * @param orientationQuat - The new orientationQuat of the user.
     * @param orientationEuler - The new orientationEuler of the user.
     * @param volumeThreshold - The new volumeThreshold of the user.
     * @param hiFiGain - This value affects how loud User A will sound to User B at a given distance in 3D space.
     * This value also affects the distance at which User A can be heard in 3D space.
     * Higher values for User A means that User A will sound louder to other users around User A, and it also means that User A will be audible from a greater distance.
     * The new hiFiGain of the user.
     * @param userAttenuation - This value affects how far a user's voice will travel in 3D space.
     * The new attenuation value for the user.
     * @param userRolloff - This value affects the frequency rolloff for a given user.
     * The new rolloff value for the user.
     */
    private _updateUserData({ position, orientationQuat, orientationEuler, volumeThreshold, hiFiGain, userAttenuation, userRolloff }: { position?: Point3D, orientationEuler?: OrientationEuler3D, orientationQuat?: OrientationQuat3D, volumeThreshold?: number, hiFiGain?: number, userAttenuation?: number, userRolloff?: number } = {}): void {
        if (position) {
            if (!this._currentHiFiAudioAPIData.position) {
                this._currentHiFiAudioAPIData.position = new Point3D();
            }

            this._currentHiFiAudioAPIData.position.x = position.x ?? this._currentHiFiAudioAPIData.position.x;
            this._currentHiFiAudioAPIData.position.y = position.y ?? this._currentHiFiAudioAPIData.position.y;
            this._currentHiFiAudioAPIData.position.z = position.z ?? this._currentHiFiAudioAPIData.position.z;
        }

        if (orientationQuat) {
            if (!this._currentHiFiAudioAPIData.orientationQuat) {
                this._currentHiFiAudioAPIData.orientationQuat = new OrientationQuat3D();
            }

            this._currentHiFiAudioAPIData.orientationQuat.w = orientationQuat.w ?? this._currentHiFiAudioAPIData.orientationQuat.w;
            this._currentHiFiAudioAPIData.orientationQuat.x = orientationQuat.x ?? this._currentHiFiAudioAPIData.orientationQuat.x;
            this._currentHiFiAudioAPIData.orientationQuat.y = orientationQuat.y ?? this._currentHiFiAudioAPIData.orientationQuat.y;
            this._currentHiFiAudioAPIData.orientationQuat.z = orientationQuat.z ?? this._currentHiFiAudioAPIData.orientationQuat.z;
        } 
        // if orientation is provided as an euler format, then do the conversion immediately
        else if (orientationEuler) {
            let checkedEuler = new OrientationEuler3D(orientationEuler);
            this._currentHiFiAudioAPIData.orientationQuat = eulerToQuaternion(checkedEuler, ourHiFiAxisConfiguration.eulerOrder);
        }

        if (typeof (volumeThreshold) === "number") {
            this._currentHiFiAudioAPIData.volumeThreshold = volumeThreshold;
        }
        if (typeof (hiFiGain) === "number") {
            this._currentHiFiAudioAPIData.hiFiGain = Math.max(0, hiFiGain);
        }
        if (typeof (userAttenuation) === "number") {
            this._currentHiFiAudioAPIData.userAttenuation = userAttenuation;
        }
        if (typeof (userRolloff) === "number") {
            this._currentHiFiAudioAPIData.userRolloff = Math.max(0, userRolloff);
        }
    }

    /**
     * Clears the clientside rate limit timeout used to prevent user data from being sent to the High Fidelity Audio API server too often.
     */
    private _maybeClearRateLimitTimeout(): void {
        if (this._timers.transmitRateLimitTimeout) {
            clearTimeout(this._timers.transmitRateLimitTimeout);
        }

        this._timers.transmitRateLimitTimeout = null;
    }

    /**
     * We keep a clientside copy of the data that we last transmitted to the High Fidelity Audio API server. We use this data to
     * ensure that we only send to the server the minimum set of data necessary - i.e. the difference between the data contained on the server
     * about the user and the new data that the client has locally. We use this function here to update the clientside copy of the data
     * that we last transmitted.
     * 
     * @param dataJustTransmitted - The data that we just transmitted to the High Fidelity Audio API server.
     */
    private _updateLastTransmittedHiFiAudioAPIData(dataJustTransmitted: HiFiAudioAPIData): void {
        if (dataJustTransmitted.position) {
            if (!this._lastTransmittedHiFiAudioAPIData.position) {
                this._lastTransmittedHiFiAudioAPIData.position = new Point3D();
            }

            this._lastTransmittedHiFiAudioAPIData.position.x = dataJustTransmitted.position.x ?? this._lastTransmittedHiFiAudioAPIData.position.x;
            this._lastTransmittedHiFiAudioAPIData.position.y = dataJustTransmitted.position.y ?? this._lastTransmittedHiFiAudioAPIData.position.y;
            this._lastTransmittedHiFiAudioAPIData.position.z = dataJustTransmitted.position.z ?? this._lastTransmittedHiFiAudioAPIData.position.z;
        }

        if (dataJustTransmitted.orientationQuat) {
            if (!this._lastTransmittedHiFiAudioAPIData.orientationQuat) {
                this._lastTransmittedHiFiAudioAPIData.orientationQuat = new OrientationQuat3D();
            }

            this._lastTransmittedHiFiAudioAPIData.orientationQuat.w = dataJustTransmitted.orientationQuat.w ?? this._lastTransmittedHiFiAudioAPIData.orientationQuat.w;
            this._lastTransmittedHiFiAudioAPIData.orientationQuat.x = dataJustTransmitted.orientationQuat.x ?? this._lastTransmittedHiFiAudioAPIData.orientationQuat.x;
            this._lastTransmittedHiFiAudioAPIData.orientationQuat.y = dataJustTransmitted.orientationQuat.y ?? this._lastTransmittedHiFiAudioAPIData.orientationQuat.y;
            this._lastTransmittedHiFiAudioAPIData.orientationQuat.z = dataJustTransmitted.orientationQuat.z ?? this._lastTransmittedHiFiAudioAPIData.orientationQuat.z;
        }

        if (typeof (dataJustTransmitted.volumeThreshold) === "number") {
            this._lastTransmittedHiFiAudioAPIData["volumeThreshold"] = dataJustTransmitted.volumeThreshold;
        }

        if (typeof (dataJustTransmitted.hiFiGain) === "number") {
            this._lastTransmittedHiFiAudioAPIData["hiFiGain"] = dataJustTransmitted.hiFiGain;
        }
        if (typeof (dataJustTransmitted.userAttenuation) === "number") {
            this._lastTransmittedHiFiAudioAPIData["userAttenuation"] = dataJustTransmitted.userAttenuation;
        }
        if (typeof (dataJustTransmitted.userRolloff) === "number") {
            this._lastTransmittedHiFiAudioAPIData["userRolloff"] = dataJustTransmitted.userRolloff;
        }
        if (typeof (dataJustTransmitted._otherUserGainQueue) === "object") {
            if (typeof(this._lastTransmittedHiFiAudioAPIData._otherUserGainQueue) !== "object") {
                this._lastTransmittedHiFiAudioAPIData._otherUserGainQueue = {};
            }
            for (const idToGain of Object.entries(dataJustTransmitted._otherUserGainQueue)) {
                this._lastTransmittedHiFiAudioAPIData._otherUserGainQueue[idToGain[0]] = idToGain[1];
            }
        }
    }

    /**
     * Formats the local user data properly, then sends that user data to the High Fidelity Audio API server. This transfer is rate limited.
     * 
     * There is no reason a library user would need to call this function without also simultaneously updating User Data, so this function is `private`.
     * 
     * @param forceTransmit - `true` if we should ignore the clientside rate limiter and send the data regardless of its status; `false` otherwise.
     * @returns If this operation is successful, returns `{ success: true, rawDataTransmitted: <the raw data that was transmitted to the server>}`. If unsuccessful, returns
     * `{ success: false, error: <an error message> }`.
     */
    private _transmitHiFiAudioAPIDataToServer(forceTransmit?: boolean): any {
        // Make sure that a caller can't transmit data for another `this.transmitRateLimitTimeoutMS` milliseconds.
        if (this._mixerSession && (!this._timers.transmitRateLimitTimeout || forceTransmit)) {
            this._timers.wantedToTransmitHiFiAudioAPIData = false;
            this._maybeClearRateLimitTimeout();
            if (!forceTransmit) {
                this._timers.transmitRateLimitTimeout = setTimeout(() => {
                    this._maybeClearRateLimitTimeout();

                    if (this._timers.wantedToTransmitHiFiAudioAPIData) {
                        this._transmitHiFiAudioAPIDataToServer(true);
                    }
                }, this.transmitRateLimitTimeoutMS);
            }
            // Get the data to transmit, which is the difference between the last data we transmitted
            // and the current data we have stored.
           // let delta = this._lastTransmittedHiFiAudioAPIData.diff(this._currentHiFiAudioAPIData);
            // This function will translate the new `HiFiAudioAPIData` object from above into stringified JSON data in the proper format,
            // then send that data to the mixer.
            // The function will return the raw data that it sent to the mixer.
            let transmitRetval = this._mixerSession._transmitHiFiAudioAPIDataToServer(this._currentHiFiAudioAPIData, this._lastTransmittedHiFiAudioAPIData);
            if (transmitRetval.success) {
                // Now we have to update our "last transmitted" `HiFiAudioAPIData` object
                // to contain the data that we just transmitted.
                this._updateLastTransmittedHiFiAudioAPIData(this._currentHiFiAudioAPIData);
                // Finally, in some cases, clean up some of the transmitted data history
                // (particularly, _otherUserGainQueue)
                this._cleanUpHiFiAudioAPIDataHistory();

                return {
                    success: true,
                    rawDataTransmitted: transmitRetval.stringifiedDataForMixer
                };
            } else {
                return {
                    success: false,
                    error: transmitRetval.error
                };
            }
        } else if (this._mixerSession && this._timers.transmitRateLimitTimeout && !forceTransmit) {
            this._timers.wantedToTransmitHiFiAudioAPIData = true;
            return {
                success: true,
                error: `Transfer is rate limited. Transfer will occur shortly automatically.`
            };
        } else if (!this._mixerSession) {
            return {
                success: false,
                error: `No server connection yet; can't transmit user data.`
            };
        }
    }

    /**
     * Normally, we try to limit the amount of data we transmit to the High Fidelity Audio API server, by remembering what we
     * sent. See {@link _updateUserData} for more information on how this is done.
     *
     * This function exists to handle any scenarios of remembering too much sent data. It is called just after data is succesfully sent, when data is known to no longer be needed.
     */
    private _cleanUpHiFiAudioAPIDataHistory(): void {
        // Always clear _otherUserGainQueue in our local data
        this._currentHiFiAudioAPIData._otherUserGainQueue = {};

        let maxCachedOtherUserGains = 1000;
        if (Object.keys(this._lastTransmittedHiFiAudioAPIData._otherUserGainQueue).length > maxCachedOtherUserGains) {
            this._lastTransmittedHiFiAudioAPIData._otherUserGainQueue = {};
            HiFiLogger.warn(`Stored \`_lastTransmittedHiFiAudioAPIData._otherUserGainQueue\` was too large and was cleared to save space.`);
        }
    }

    /**
     * A simple function that calls {@link _updateUserData}, followed by {@link _transmitHiFiAudioAPIDataToServer}.
     * Developers can call this function as often as they want. This function will update the internal data store of the user's
     * position, orientation, etc. No matter how often developers call this function, the internal data store transmission is rate-limited
     * and will only be sent to the server once every `transmitRateLimitTimeoutMS` milliseconds. When the internal data store is transmitted,
     * the most up-to-date data will be transmitted.
     * 
     * @param newUserData - The new user data that we want to send to the High Fidelity Audio API server.
     * @returns Returns the return value of {@link _transmitHiFiAudioAPIDataToServer}.
     */
    updateUserDataAndTransmit(newUserData: any): string {
        this._updateUserData(newUserData);

        return this._transmitHiFiAudioAPIDataToServer();
    }

    /**
     * Ingests user data updates from the server and, if relevant, calls the relevant callback functions associated with the
     * User Data Subscriptions. See {@link addUserDataSubscription}.
     * 
     * @param newUserDataFromServer - Contains all of the new user data most recently received from the server. 
     */
    private _handleUserDataUpdates(newUserDataFromServer: Array<ReceivedHiFiAudioAPIData>): void {
        if (this._userDataSubscriptions.length === 0) {
            return;
        }

        for (let subItr = 0; subItr < this._userDataSubscriptions.length; subItr++) {
            let currentSubscription = this._userDataSubscriptions[subItr];

            // Don't bother continuing to do anything if the developer didn't specify a callback associated
            // with the current Subscription that we are processing.
            if (!currentSubscription.callback) {
                continue;
            }

            let currentSubscriptionCallbackData: Array<ReceivedHiFiAudioAPIData> = [];

            for (let dataItr = 0; dataItr < newUserDataFromServer.length; dataItr++) {
                let currentDataFromServer = newUserDataFromServer[dataItr];

                if (currentSubscription.providedUserID && currentDataFromServer.providedUserID !== currentSubscription.providedUserID) {
                    continue;
                }

                let newCallbackData = new ReceivedHiFiAudioAPIData();

                if (typeof (currentDataFromServer.providedUserID) === "string") {
                    newCallbackData.providedUserID = currentDataFromServer.providedUserID;
                }

                if (typeof (currentDataFromServer.hashedVisitID) === "string") {
                    newCallbackData.hashedVisitID = currentDataFromServer.hashedVisitID;
                }

                let shouldPushNewCallbackData = false;

                for (let componentItr = 0; componentItr < currentSubscription.components.length; componentItr++) {
                    let currentComponent = currentSubscription.components[componentItr];

                    switch (currentComponent) {
                        case AvailableUserDataSubscriptionComponents.Position:
                            if (currentDataFromServer.position) {
                                newCallbackData.position = currentDataFromServer.position;
                                shouldPushNewCallbackData = true;
                            }
                            break;

                        case AvailableUserDataSubscriptionComponents.OrientationQuat:
                            if (currentDataFromServer.orientationQuat) {
                                newCallbackData.orientationQuat = currentDataFromServer.orientationQuat;
                                shouldPushNewCallbackData = true;
                            }
                            break;
                        case AvailableUserDataSubscriptionComponents.OrientationEuler:
                            // Generate the euler version of orientation if quat version available
                            if (currentDataFromServer.orientationQuat) {
                                newCallbackData.orientationEuler = eulerFromQuaternion(currentDataFromServer.orientationQuat, ourHiFiAxisConfiguration.eulerOrder);
                                shouldPushNewCallbackData = true;
                            }
                            break;

                        case AvailableUserDataSubscriptionComponents.VolumeDecibels:
                            if (typeof (currentDataFromServer.volumeDecibels) === "number") {
                                newCallbackData.volumeDecibels = currentDataFromServer.volumeDecibels;
                                shouldPushNewCallbackData = true;
                            }
                            break;

                        case AvailableUserDataSubscriptionComponents.IsStereo:
                            if (typeof (currentDataFromServer.isStereo) === "boolean") {
                                newCallbackData.isStereo = currentDataFromServer.isStereo;
                                shouldPushNewCallbackData = true;
                            }
                            break;
                    }
                }

                if (shouldPushNewCallbackData) {
                    currentSubscriptionCallbackData.push(newCallbackData);
                }
            }

            if (currentSubscription.callback && currentSubscriptionCallbackData.length > 0) {
                currentSubscription.callback(currentSubscriptionCallbackData);
            }
        }
    }

    /**
     * A simple wrapper function called by our instantiation of `HiFiMixerSession` that calls the user-provided `onUsersDisconnected()`
     * function if one exists.
     * Library users can provide an `onUsersDisconnected()` callback function when instantiating the `HiFiCommunicator` object, or by setting
     * `HiFiCommunicator.onUsersDisconnected` after instantiation.
     * @param usersDisconnected - An Array of {@link ReceivedHiFiAudioAPIData} regarding the users who disconnected.
     */
    private _onUsersDisconnected(usersDisconnected: Array<ReceivedHiFiAudioAPIData>): void {
        if (this.onUsersDisconnected) {
            this.onUsersDisconnected(usersDisconnected);
        }
    }

    /**
     * Adds a new User Data Subscription to the list of clientside Subscriptions. User Data Subscriptions are used to obtain
     * User Data about other Users. For example, if you set up a User Data Subscription for your own User Data, you can use that subscription 
     * to ensure that the data on the High Fidelity Audio API Server is the same as the data you are sending
     * to it from the client. 
     * 
     * To check if a user has disconnected, use {@link HiFiCommunicator.onUsersDisconnected}.
     * 
     * @param newSubscription - The new User Data Subscription associated with a user. 
     */
    addUserDataSubscription(newSubscription: UserDataSubscription): void {
        if (!this._mixerSession) {
            HiFiLogger.error(`No \`_mixerSession\`! Data subscription not added.`);
            return;
        }

        if (this._mixerSession.userDataStreamingScope === HiFiUserDataStreamingScopes.None) {
            HiFiLogger.error(`During \`HiFiCommunicator\` construction, the server was set up to **not** send user data! Data subscription not added.`);
            return;
        }

        HiFiLogger.log(`Adding new User Data Subscription:\n${JSON.stringify(newSubscription)}`);
        this._userDataSubscriptions.push(newSubscription);
    }
}
