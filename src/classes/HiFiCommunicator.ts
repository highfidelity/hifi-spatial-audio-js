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
import { HiFiMixerSession, SetOtherUserGainForThisConnectionResponse, SetOtherUserGainsForThisConnectionResponse, OnMuteChangedCallback } from "./HiFiMixerSession";
import { AvailableUserDataSubscriptionComponents, UserDataSubscription } from "./HiFiUserDataSubscription";

/**
 * When the state of the connection to the High Fidelity Audio Server changes, the new state will be one of these values.
 */
export enum HiFiConnectionStates {
    /**
     * The `HiFiConnectionState` will be `"New"` for a brand new HiFiCommunicator that hasn't yet tried to connect
     */
    New = "New",
    /**
     * The `HiFiConnectionState` will be `"Connecting"` when the system is in the process of trying to establish
     * an initial connection.
     */
    Connecting = "Connecting",
    Connected = "Connected",
    /**
     * The `HiFiConnectionState` will be `"Reconnecting"` if the system is in the process of trying to
     * automatically re-establish a pre-existing connection.
     */
    Reconnecting = "Reconnecting",
    Disconnected = "Disconnected",
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
   */
  maxSecondsToSpendRetryingOnDisconnect?: number;
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
     * of the WebRTC (RAVI Session) state and the RAVI Signaling State.
     */
    private _currentHiFiConnectionState: HiFiConnectionStates = HiFiConnectionStates.New;

    // This contains data dealing with the mixer session, such as the RAVI session, WebRTC address, etc.
    private _mixerSession: HiFiMixerSession;

    private _webRTCSessionParams?: WebRTCSessionParams;
    private _customSTUNandTURNConfig?: CustomSTUNandTURNConfig;
    private _connectionRetryAndTimeoutConfig : ConnectionRetryAndTimeoutConfig;

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
            "onConnectionStateChanged": (state: HiFiConnectionStates) => { this._stateChangeCoordinator(state); },
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
     * As of 2021-01-21, we've added code in this function which, in the browser context, searches for a `token` URL query parameter and, if a JWT
     * isn't supplied as an argument to this function, uses the value of that `token` URL query parameter as the JWT.
     * We should remove that later, because we almost certainly don't want this to stay in the API code, but it's _very_ convenient for sample apps for right now.
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

        let mixerConnectionResponse;
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
        let timeout = this._connectionRetryAndTimeoutConfig.timeoutPerConnectionAttemptMS;

        try {
            let webRTCSignalingAddress = `wss://${signalingHostURLSafe}:${signalingPort}/?token=`;
            this._mixerSession.webRTCAddress = `${webRTCSignalingAddress}${hifiAuthJWT}`;

            HiFiLogger.log(`Using WebRTC Signaling Address:\n${webRTCSignalingAddress}<token redacted>`);

            mixerConnectionResponse = await this._mixerSession.connectToHiFiMixer({ webRTCSessionParams: this._webRTCSessionParams, customSTUNandTURNConfig: this._customSTUNandTURNConfig, timeout: timeout });
        } catch (errorConnectingToMixer) {
            let errMsg = `Error when connecting to mixer!\n${errorConnectingToMixer}`;
            return Promise.reject({
                success: false,
                error: errMsg
            });
        }

        this._transmitHiFiAudioAPIDataToServer(true);
        return Promise.resolve({
            success: true,
            audionetInitResponse: mixerConnectionResponse.audionetInitResponse
        });
    }

    /**
     * This method manages things like auto-retries, when to call (and not to call) the customer-supplied
     * onConnectionStateChanged function, and keeps track of the current "overarching meta-state" of the
     * communicator as a whole (which might be different from the state of the mixerSession, due to retries
     * and failures and the like). This method is passed into the MixerSession to serve as its state change handler.
     * @param state
     */
    private _stateChangeCoordinator(state: HiFiConnectionStates): void {
        /**
         TODO: This (and various other functions, including setting of timeouts and the
         main connection method) need to do the following:

         A) When _first_ attempting a connection, the main connection method should set
            this._currentHiFiConnectionState = HiFiConnectionStates.Connecting
            before doing anything else.

         B) When handling a state change, this method (and/or methods it calls) should do the following:

            i)    IF the state change got triggered via an explicit call to disconnectFromHiFiAudioAPIServer()
                  THEN handle the new state as implemented below
                  (note: this behavior might be most easily implemented through the use of
                  an explicit, transient, DISCONNECTING state.)

            ii) IF this._currentHiFiConnectionState is currently CONNECTING:

               1. IF the new state is DISCONNECTED, FAILED, or UNAVAILABLE
                  AND IF autoRetryInitialConnection is true
                  AND IF maxSecondsToSpendRetryingInitialConnection has not yet elapsed
                  THEN ensure that this._currentHiFiConnectionState stays at CONNECTING
                  ELSE handle the new state as implemented below

               2. ELSE IF the new state is CONNECTED
                  THEN handle the new state as implemented below
                  AND kill the maxSecondsToSpendRetryingInitialConnection timeout if it's set

               3. ELSE IF the new state is other (CONNECTING or RECONNECTING)
                  AND IF the new state is not the same as this._currentHiFiConnectionState
                  THEN handle the new state as implemented below

            ii) IF this._currentHiFiConnectionState is currently CONNECTED or RECONNECTING:

               1. IF the new state is DISCONNECTED, FAILED, or UNAVAILABLE
                  AND IF autoRetryOnDisconnect is true
                  AND IF maxSecondsToSpendRetryingOnDisconnect has not yet elapsed
                  THEN set this._currentHiFiConnectionState to RECONNECTING
                  AND try to reconnect
                  ELSE handle the new state as implemented below

               2. ELSE IF the new state is CONNECTED
                  THEN handle the new state as implemented below
                  AND kill the maxSecondsToSpendRetryingOnDisconnect timeout if it's set

               4. ELSE IF the new state is other (CONNECTING or RECONNECTING)
                  AND IF the new state is not the same as this._currentHiFiConnectionState
                  THEN handle the new state as implemented below

         */
        if (this._currentHiFiConnectionState !== state) {
            // TODO: If this._currentHiFiConnectionState is "UNAVAILABLE", subsequent changes to "FAILED" or "DISCONNECTED"
            // should probably not trigger a change (they don't in the current implementation), because "UNAVAIALBLE" is
            // itself a failure status (for "velvet rope"). However, if the change from "UNAVAILABLE" goes to something else (e.g. "CONNECTING")
            // then the change _should_ be triggered. Need to think through that a little bit more, and also re-evaluate how that behavior has
            // changed since the websocket signaling changes were implemented (the UNAVAILABLE state gets communicated the same way, which
            // is what made its original handling logic so very complicated before RaviSession was updated with the new short-circuit approach).
            // It's probably easier now (i.e. I think the RaviSession may just stay at UNAVAILABLE, in which case this would all be moot).
            this._currentHiFiConnectionState = state;
            if (this.onConnectionStateChanged) {
                this.onConnectionStateChanged(this._currentHiFiConnectionState);
            }
        }
    }

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
     * Disconnects from the High Fidelity Audio API. After this call, user data will no longer be transmitted to High Fidelity, the audio
     * input stream will not be transmitted to High Fidelity, and the user will no longer be able to hear the audio stream from High Fidelity.
     */
    async disconnectFromHiFiAudioAPIServer(): Promise<string> {
        if (!this._mixerSession) {
            return Promise.resolve(`No mixer session from which we can disconnect!`);
        }

        this._inputAudioMediaStream = undefined;
        this.onUsersDisconnected = undefined;
        this._userDataSubscriptions = [];
        this._currentHiFiAudioAPIData = undefined;
        this._lastTransmittedHiFiAudioAPIData = new HiFiAudioAPIData();

        return this._mixerSession.disconnectFromHiFiMixer();
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
     * @returns The current state of the connection to High Fidelity, as one of the HiFiConnectionStates.
     * This will return null if the current state is not available (e.g. if the HiFiCommunicator
     * is still in the process of initializing its underlying HiFiMixerSession).
     */
    getConnectionState(): HiFiConnectionStates {
        return this._currentHiFiConnectionState;
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
