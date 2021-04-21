/**
 * Methods on the [[HiFiCommunicator]] class allow developers to perform actions such as:
 * - `connectToHiFiAudioAPIServer()`: Connect to and disconnect from the High Fidelity Audio Server
 * - `updateUserDataAndTransmit()`: Update the user's data (position, orientation, etc) on the High Fidelity Audio Server
 * - `setInputAudioMediaStream()`: Set a new input audio media stream (for example, when the user's audio input device changes)
 * @packageDocumentation
 */

declare var HIFI_API_VERSION: string;

import { HiFiConstants } from "../constants/HiFiConstants";
import { WebRTCSessionParams } from "../libravi/RaviSession";
import { HiFiLogger } from "../utilities/HiFiLogger";
import { HiFiUtilities } from "../utilities/HiFiUtilities";
import { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, Point3D, OrientationQuat3D, OrientationEuler3D, OrientationEuler3DOrder, eulerToQuaternion, eulerFromQuaternion } from "./HiFiAudioAPIData";
import { HiFiAxisConfiguration, HiFiAxisUtilities, ourHiFiAxisConfiguration } from "./HiFiAxisConfiguration";
import { HiFiMixerSession, SetOtherUserGainForThisConnectionResponse } from "./HiFiMixerSession";
import { AvailableUserDataSubscriptionComponents, UserDataSubscription } from "./HiFiUserDataSubscription";

/**
 * When the state of the connection to the High Fidelity Audio Server changes, the new state will be one of these values.
 */
export enum HiFiConnectionStates {
    Connected = "Connected",
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

    // This contains data dealing with the mixer session, such as the RAVI session, WebRTC address, etc.
    private _mixerSession: HiFiMixerSession;

    private _webRTCSessionParams?: WebRTCSessionParams;

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
     */
    constructor({
        initialHiFiAudioAPIData = new HiFiAudioAPIData(),
        onConnectionStateChanged,
        onUsersDisconnected,
        transmitRateLimitTimeoutMS = HiFiConstants.DEFAULT_TRANSMIT_RATE_LIMIT_TIMEOUT_MS,
        userDataStreamingScope = HiFiUserDataStreamingScopes.All,
        hiFiAxisConfiguration,
        webrtcSessionParams
    }: {
        initialHiFiAudioAPIData?: HiFiAudioAPIData,
        onConnectionStateChanged?: Function,
        onUsersDisconnected?: Function,
        transmitRateLimitTimeoutMS?: number,
        userDataStreamingScope?: HiFiUserDataStreamingScopes,
        hiFiAxisConfiguration?: HiFiAxisConfiguration,
        webrtcSessionParams?: WebRTCSessionParams
    } = {}) {
        // Make minimum 10ms
        if (transmitRateLimitTimeoutMS < HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS) {
            HiFiLogger.warn(`\`transmitRateLimitTimeoutMS\` must be >= ${HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS}ms! Setting to ${HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS}ms...`);
            transmitRateLimitTimeoutMS = HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS;
        }
        this.transmitRateLimitTimeoutMS = transmitRateLimitTimeoutMS;

        if (onUsersDisconnected) {
            this.onUsersDisconnected = onUsersDisconnected;
        }

        this._mixerSession = new HiFiMixerSession({
            "userDataStreamingScope": userDataStreamingScope,
            "onUserDataUpdated": (data: Array<ReceivedHiFiAudioAPIData>) => { this._handleUserDataUpdates(data); },
            "onUsersDisconnected": (data: Array<ReceivedHiFiAudioAPIData>) => { this._onUsersDisconnected(data); },
            "onConnectionStateChanged": onConnectionStateChanged
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
            let errMsg = `\`this._mixerSession\` is falsey!`;
            return Promise.reject({
                success: false,
                error: errMsg
            });
        }

        let mixerConnectionResponse;
        let signalingHostURLSafe;

        try {
            signalingHostURLSafe = new URL(signalingHostURL).hostname;
        } catch(e) {
            // If signalingHostURL is not defined, we assign the default URL
            signalingHostURLSafe = signalingHostURL ? signalingHostURL : HiFiConstants.DEFAULT_PROD_HIGH_FIDELITY_ENDPOINT;
        }

        signalingPort = signalingPort ? signalingPort : HiFiConstants.DEFAULT_PROD_HIGH_FIDELITY_PORT;

        try {
            let webRTCSignalingAddress = `wss://${signalingHostURLSafe}:${signalingPort}/?token=`;
            this._mixerSession.webRTCAddress = `${webRTCSignalingAddress}${hifiAuthJWT}`;

            HiFiLogger.log(`Using WebRTC Signaling Address:\n${webRTCSignalingAddress}<token redacted>`);

            mixerConnectionResponse = await this._mixerSession.connectToHiFiMixer({ webRTCSessionParams: this._webRTCSessionParams });
        } catch (errorConnectingToMixer) {
            let errMsg = `Error when connecting to mixer! Error:\n${errorConnectingToMixer}`;
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
     * Adjusts the gain of another user for this communicator's current connection only.
     * This can be used to provide a more comfortable listening experience for the client. If you need to perform moderation actions which apply to all users, use the {@link https://docs.highfidelity.com/rest/latest/index.html|Administrative REST API}.
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
        this._currentHiFiAudioAPIData.otherUserGainQueue[visitIdHash] = gain;

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
     * Use this function to set whether or not the user's input audio `MediaStream` should be "muted". 
     * A muted stream will have the `enabled` property of each of its `MediaStreamTrack`s set to `false`
     * (and an unmuted stream -- the default -- will have the `enabled` property set to `true`). Be
     * aware that if you are using the same `MediaStream` object in other ways, it will be affected by
     * calling this method. So, if you would like to mute/unmute the input audio stream separately for the
     * High Fidelity audio vs. some other use of it, it is recommended to clone the audio stream separately
     * for each use.
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
        if (typeof (dataJustTransmitted.otherUserGainQueue) === "object") {
            if (typeof(this._lastTransmittedHiFiAudioAPIData.otherUserGainQueue) !== "object") {
                this._lastTransmittedHiFiAudioAPIData.otherUserGainQueue = {};
            }
            for (const idToGain of Object.entries(dataJustTransmitted.otherUserGainQueue)) {
                this._lastTransmittedHiFiAudioAPIData.otherUserGainQueue[idToGain[0]] = idToGain[1];
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
                // (particularly, otherUserGainQueue)
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
        // Always clear otherUserGainQueue in our local data
        this._currentHiFiAudioAPIData.otherUserGainQueue = {};

        let maxCachedOtherUserGains = 1000;
        if (Object.keys(this._lastTransmittedHiFiAudioAPIData.otherUserGainQueue).length > maxCachedOtherUserGains) {
            this._lastTransmittedHiFiAudioAPIData.otherUserGainQueue = {};
            HiFiLogger.warn(`Stored \`_lastTransmittedHiFiAudioAPIData.otherUserGainQueue\` was too large and was cleared to save space.`);
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

                        case AvailableUserDataSubscriptionComponents.HiFiGain:
                            if (typeof (currentDataFromServer.hiFiGain) === "number") {
                                newCallbackData.hiFiGain = currentDataFromServer.hiFiGain;
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
