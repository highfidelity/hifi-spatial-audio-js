/**
 * Methods on the [[HiFiCommunicator]] class allow developers to perform actions such as:
 * - `connectToHiFiAudioAPIServer()`: Connect to and disconnect from the High Fidelity Audio Server
 * - `updateUserDataAndTransmit()`: Update the user's data (position, orientation, etc) on the High Fidelity Audio Server
 * - `setInputAudioMediaStream()`: Set a new input audio media stream (for example, when the user's audio input device changes)
 * @packageDocumentation
 */

declare var BUILD_ENVIRONMENT: string;
declare var HIFI_API_VERSION: string;

import { HiFiConstants } from "../constants/HiFiConstants";
import { HiFiLogger } from "../utilities/HiFiLogger";
import { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, Point3D, OrientationEuler3D, OrientationQuat3D } from "./HiFiAudioAPIData";
import { HiFiAxisConfiguration, HiFiAxisUtilities, ourHiFiAxisConfiguration } from "./HiFiAxisConfiguration";
import { HiFiMixerSession } from "./HiFiMixerSession";
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
}

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
    // when the server reports that a user's data - such as position, orientationEuler, and volume - has been modified.
    private _userDataSubscriptions: Array<UserDataSubscription>;

    // This contains data dealing with the mixer session, such as the RAVI session, WebRTC address, etc.
    private _mixerSession: HiFiMixerSession;

    /**
     * Constructor for the HiFiCommunicator object. Once you have created a HiFiCommunicator, you can use the
     * {@link setInputAudioMediaStream} method to assign an input audio stream to the connection, and
     * once the connection has been established, use the {@link getOutputAudioMediaStrem} method to
     * retrieve the output audio from the server.
     * @param {Object} __namedParameters
     * @param initialHiFiAudioAPIData - The initial position, orientation, etc of the user.
     * @param onConnectionStateChanged - A function that will be called when the connection state to the High Fidelity Audio API Server changes. See {@link HiFiConnectionStates}.
     * @param transmitRateLimitTimeoutMS - User Data updates will not be sent to the server any more frequently than this number in milliseconds.
     * @param serverShouldSendUserData - Cannot be set later. If set to `true`, the Server will send all User Data updates to the client. Setting this value to `true` (its default) is necessary for
     * User Data Subscriptions to work. If this value is set to `false`, the Server will not send any User Data updates to the client, which saves bandwidth and, marginally, processing time.
     * @param hiFiAxisConfiguration - Cannot be set later. The 3D axis configuration. See {@link ourHiFiAxisConfiguration} for defaults.
     */
    constructor({
        initialHiFiAudioAPIData = new HiFiAudioAPIData(),
        onConnectionStateChanged,
        transmitRateLimitTimeoutMS = HiFiConstants.DEFAULT_TRANSMIT_RATE_LIMIT_TIMEOUT_MS,
        serverShouldSendUserData = true,
        hiFiAxisConfiguration
    }: {
        initialHiFiAudioAPIData?: HiFiAudioAPIData,
        onConnectionStateChanged?: Function,
        transmitRateLimitTimeoutMS?: number,
        serverShouldSendUserData?: boolean,
        hiFiAxisConfiguration?: HiFiAxisConfiguration
    } = {}) {
        // Make minimum 10ms
        if (transmitRateLimitTimeoutMS < HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS) {
            HiFiLogger.warn(`\`transmitRateLimitTimeoutMS\` must be >= ${HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS}ms! Setting to ${HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS}ms...`);
            transmitRateLimitTimeoutMS = HiFiConstants.MIN_TRANSMIT_RATE_LIMIT_TIMEOUT_MS;
        }
        this.transmitRateLimitTimeoutMS = transmitRateLimitTimeoutMS

        this._mixerSession = new HiFiMixerSession({
            "serverShouldSendUserData": serverShouldSendUserData,
            "onUserDataUpdated": (data: Array<ReceivedHiFiAudioAPIData>) => { this._handleUserDataUpdates(data); },
            "onConnectionStateChanged": onConnectionStateChanged
        });

        this._inputAudioMediaStream = undefined;

        this._currentHiFiAudioAPIData = initialHiFiAudioAPIData;

        this._lastTransmittedHiFiAudioAPIData = new HiFiAudioAPIData();

        this._userDataSubscriptions = [];

        if (hiFiAxisConfiguration) {
            if (HiFiAxisUtilities.verify(hiFiAxisConfiguration)) {
                ourHiFiAxisConfiguration.rightAxis = hiFiAxisConfiguration.rightAxis;
                ourHiFiAxisConfiguration.leftAxis = hiFiAxisConfiguration.leftAxis;
                ourHiFiAxisConfiguration.intoScreenAxis = hiFiAxisConfiguration.intoScreenAxis;
                ourHiFiAxisConfiguration.outOfScreenAxis = hiFiAxisConfiguration.outOfScreenAxis;
                ourHiFiAxisConfiguration.upAxis = hiFiAxisConfiguration.upAxis;
                ourHiFiAxisConfiguration.downAxis = hiFiAxisConfiguration.downAxis;
                ourHiFiAxisConfiguration.handedness = hiFiAxisConfiguration.handedness;
            } else {
                HiFiLogger.error(`There is an error with the passed \`HiFiAxisConfiguration\`, so the new axis configuration was not set. There are more error details in the logs above.`);
            }
        }
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
     * @param stackName The WebSocket address to which we make our WebRTC signaling connection is decided based on the following heirarchal logic:
     * 1. If the code is running in the browser context, and the browser's URL query parameters contains a `?stack=<stackName>` query parameter, 
     * the WebRTC signaling address will be based off of this `stackName`. Stack names are used internally by High Fidelity developers when testing new server-side code.
     * 2. If the code is running in the browser context, and the browser's current location's hostname contains `highfidelity.io` (a hostname for internal use only),
     * it is very likely that we are running a test in a browser. Tests running in a browser from that hostname should assume that the WebRTC Signaling Address
     * is at the same host from which the test is served.
     * 3. If the code is running in the browser context, and our code compilation processes have specified the build mode as "production", we should use the production
     * WebRTC signaling connection address.
     * 4. If a developer has passed a `stackName` parameter into this `connectToHiFiAudioAPIServer()` call, use a WebRTC signaling address based on that `stackName`.
     * 5. If the code is running in the NodeJS context, we will use the "production" `stackName`, and use a WebRTC signaling address based on that `stackName`.
     * 6. If none of the above logic applies, we will use the default "staging" WebRTC signaling connection address.
     * 
     * @returns If this operation is successful, the Promise will resolve with `{ success: true, audionetInitResponse: <The response to `audionet.init` from the server in Object format>}`.
     * If unsuccessful, the Promise will reject with `{ success: false, error: <an error message> }`.
     */
    async connectToHiFiAudioAPIServer(hifiAuthJWT: string, stackName?: string): Promise<any> {
        if (!this._mixerSession) {
            let errMsg = `\`this._mixerSession\` is falsey!`;
            return Promise.reject({
                success: false,
                error: errMsg
            });
        }

        let mixerConnectionResponse;
        try {
            // TODO: Revisit this chunk of code later. We almost certainly don't want this to stay in the API code,
            // but it's _very_ convenient for sample apps for right now.
            let params = URLSearchParams && (typeof (location) !== 'undefined') && new URLSearchParams(location.search);
            if (params && params.has("token") && (!hifiAuthJWT || hifiAuthJWT.length === 0)) {
                hifiAuthJWT = params.get("token");
            }

            let webRTCSignalingAddress = "wss://loadbalancer-$STACKNAME.highfidelity.io:8001/?token=";
            let isBrowserContext = typeof self !== 'undefined';
            if (params && params.has("stack")) {
                webRTCSignalingAddress = webRTCSignalingAddress.replace('$STACKNAME', params.get("stack"));
            } else if (isBrowserContext && window.location.hostname.indexOf("highfidelity.io") > -1) {
                webRTCSignalingAddress = `wss://${window.location.hostname}:8001/?token=`;
            } else if (isBrowserContext && BUILD_ENVIRONMENT && BUILD_ENVIRONMENT === "prod") {
                webRTCSignalingAddress = `${HiFiConstants.DEFAULT_PROD_HIGH_FIDELITY_ENDPOINT}/?token=`;
            } else if (stackName) {
                webRTCSignalingAddress = webRTCSignalingAddress.replace('$STACKNAME', stackName);
            } else if (!isBrowserContext) {
                webRTCSignalingAddress = `${HiFiConstants.DEFAULT_PROD_HIGH_FIDELITY_ENDPOINT}/?token=`;
            } else {
                webRTCSignalingAddress = webRTCSignalingAddress.replace('$STACKNAME', 'api-staging-01');
            }

            this._mixerSession.webRTCAddress = `${webRTCSignalingAddress}${hifiAuthJWT}`;

            HiFiLogger.log(`Using WebRTC Signaling Address:\n${webRTCSignalingAddress}<token redacted>`);

            mixerConnectionResponse = await this._mixerSession.connect();
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
     * Disconnects from the High Fidelity Audio API. After this call, user data will no longer be transmitted to High Fidelity, the audio
     * input stream will not be transmitted to High Fidelity, and the user will no longer be able to hear the audio stream from High Fidelity.
     */
    async disconnectFromHiFiAudioAPIServer(): Promise<string> {
        if (!this._mixerSession) {
            return Promise.resolve(`No mixer session from which we can disconnect!`);
        }

        return this._mixerSession.disconnect();
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
        if (isBrowserContext && HIFI_API_VERSION) {
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
     * @param __namedParameters
     * @param position - The new position of the user.
     * @param orientationEuler - The new orientationEuler of the user.
     * @param orientationQuat - The new orientationQuat of the user.
     * @param hiFiGain - This value affects how loud User A will sound to User B at a given distance in 3D space.
     * This value also affects the distance at which User A can be heard in 3D space.
     * Higher values for User A means that User A will sound louder to other users around User A, and it also means that User A will be audible from a greater distance.
     * The new hiFiGain of the user.
     */
    private _updateUserData({ position, orientationEuler, orientationQuat, hiFiGain }: { position?: Point3D, orientationEuler?: OrientationEuler3D, orientationQuat?: OrientationQuat3D, hiFiGain?: number } = {}): void {
        if (position) {
            if (!this._currentHiFiAudioAPIData.position) {
                this._currentHiFiAudioAPIData.position = new Point3D();
            }

            this._currentHiFiAudioAPIData.position.x = position.x ?? this._currentHiFiAudioAPIData.position.x;
            this._currentHiFiAudioAPIData.position.y = position.y ?? this._currentHiFiAudioAPIData.position.y;
            this._currentHiFiAudioAPIData.position.z = position.z ?? this._currentHiFiAudioAPIData.position.z;
        }

        if (orientationEuler) {
            if (!this._currentHiFiAudioAPIData.orientationEuler) {
                this._currentHiFiAudioAPIData.orientationEuler = new OrientationEuler3D();
            }

            this._currentHiFiAudioAPIData.orientationEuler.pitchDegrees = orientationEuler.pitchDegrees ?? this._currentHiFiAudioAPIData.orientationEuler.pitchDegrees;
            this._currentHiFiAudioAPIData.orientationEuler.yawDegrees = orientationEuler.yawDegrees ?? this._currentHiFiAudioAPIData.orientationEuler.yawDegrees;
            this._currentHiFiAudioAPIData.orientationEuler.rollDegrees = orientationEuler.rollDegrees ?? this._currentHiFiAudioAPIData.orientationEuler.rollDegrees;
        }

        if (orientationQuat) {
            if (this._currentHiFiAudioAPIData.orientationQuat) {
                this._currentHiFiAudioAPIData.orientationQuat.w = orientationQuat.w ?? this._currentHiFiAudioAPIData.orientationQuat.w;
                this._currentHiFiAudioAPIData.orientationQuat.x = orientationQuat.x ?? this._currentHiFiAudioAPIData.orientationQuat.x;
                this._currentHiFiAudioAPIData.orientationQuat.y = orientationQuat.y ?? this._currentHiFiAudioAPIData.orientationQuat.y;
                this._currentHiFiAudioAPIData.orientationQuat.z = orientationQuat.z ?? this._currentHiFiAudioAPIData.orientationQuat.z;
            } else {
                this._currentHiFiAudioAPIData.orientationQuat = new OrientationQuat3D({
                    "w": orientationQuat.w,
                    "x": orientationQuat.x,
                    "y": orientationQuat.y,
                    "z": orientationQuat.z,
                });
            }
        }

        if (typeof (hiFiGain) === "number") {
            this._currentHiFiAudioAPIData.hiFiGain = Math.max(0, hiFiGain);
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

        if (dataJustTransmitted.orientationEuler) {
            if (!this._lastTransmittedHiFiAudioAPIData.orientationEuler) {
                this._lastTransmittedHiFiAudioAPIData.orientationEuler = new OrientationEuler3D();
            }

            this._lastTransmittedHiFiAudioAPIData.orientationEuler.pitchDegrees = dataJustTransmitted.orientationEuler.pitchDegrees ?? this._lastTransmittedHiFiAudioAPIData.orientationEuler.pitchDegrees;
            this._lastTransmittedHiFiAudioAPIData.orientationEuler.yawDegrees = dataJustTransmitted.orientationEuler.yawDegrees ?? this._lastTransmittedHiFiAudioAPIData.orientationEuler.yawDegrees;
            this._lastTransmittedHiFiAudioAPIData.orientationEuler.rollDegrees = dataJustTransmitted.orientationEuler.rollDegrees ?? this._lastTransmittedHiFiAudioAPIData.orientationEuler.rollDegrees;
        }

        if (dataJustTransmitted.orientationQuat) {
            if (!this._lastTransmittedHiFiAudioAPIData.orientationQuat) {
                this._lastTransmittedHiFiAudioAPIData.orientationQuat = new OrientationQuat3D({
                    "w": dataJustTransmitted.orientationQuat.w,
                    "x": dataJustTransmitted.orientationQuat.x,
                    "y": dataJustTransmitted.orientationQuat.y,
                    "z": dataJustTransmitted.orientationQuat.z,
                });
            } else {
                this._lastTransmittedHiFiAudioAPIData.orientationQuat.w = dataJustTransmitted.orientationQuat.w;
                this._lastTransmittedHiFiAudioAPIData.orientationQuat.x = dataJustTransmitted.orientationQuat.x;
                this._lastTransmittedHiFiAudioAPIData.orientationQuat.y = dataJustTransmitted.orientationQuat.y;
                this._lastTransmittedHiFiAudioAPIData.orientationQuat.z = dataJustTransmitted.orientationQuat.z;
            }
        }

        if (typeof (dataJustTransmitted.hiFiGain) === "number") {
            this._lastTransmittedHiFiAudioAPIData["hiFiGain"] = dataJustTransmitted.hiFiGain;
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
            let delta = this._lastTransmittedHiFiAudioAPIData.diff(this._currentHiFiAudioAPIData);
            // This function will translate the new `HiFiAudioAPIData` object from above into stringified JSON data in the proper format,
            // then send that data to the mixer.
            // The function will return the raw data that it sent to the mixer.
            let transmitRetval = this._mixerSession._transmitHiFiAudioAPIDataToServer(delta);
            if (transmitRetval.success) {
                // Now we have to update our "last transmitted" `HiFiAudioAPIData` object
                // to contain the data that we just transmitted.
                this._updateLastTransmittedHiFiAudioAPIData(delta);

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

                        case AvailableUserDataSubscriptionComponents.OrientationEuler:
                            if (currentDataFromServer.orientationEuler) {
                                newCallbackData.orientationEuler = currentDataFromServer.orientationEuler;
                                shouldPushNewCallbackData = true;
                            }
                            break;

                        case AvailableUserDataSubscriptionComponents.OrientationQuat:
                            if (currentDataFromServer.orientationQuat) {
                                newCallbackData.orientationQuat = currentDataFromServer.orientationQuat;
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
     * Adds a new User Data Subscription to the list of clientside Subscriptions. User Data Subscriptions are used to obtain
     * User Data about other Users. For example, if you set up a User Data Subscription for your own User Data, you can use that subscription 
     * to ensure that the data on the High Fidelity Audio API Server is the same as the data you are sending
     * to it from the client. 
     * 
     * @param newSubscription - The new User Data Subscription associated with a user. 
     */
    addUserDataSubscription(newSubscription: UserDataSubscription): void {
        if (!this._mixerSession) {
            HiFiLogger.error(`No \`_mixerSession\`! Data subscription not added.`);
            return;
        }

        if (!this._mixerSession.serverShouldSendUserData) {
            HiFiLogger.error(`During \`HiFiCommunicator\` construction, the server was set up to **not** send user data! Data subscription not added.`);
            return;
        }

        HiFiLogger.log(`Adding new User Data Subscription:\n${JSON.stringify(newSubscription)}`);
        this._userDataSubscriptions.push(newSubscription);
    }
}
