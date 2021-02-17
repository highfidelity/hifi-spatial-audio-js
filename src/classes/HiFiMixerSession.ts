/**
 * Code in this module is used internally by the [[HiFiCommunicator]] object to manage the connection between client and server.
 * Developers do not need to and should not consider this module when writing their applications.
 * @packageDocumentation
 */

import { HiFiAudioAPIData, OrientationEuler3D, OrientationQuat3D, Point3D, ReceivedHiFiAudioAPIData } from "./HiFiAudioAPIData";
import { HiFiLogger } from "../utilities/HiFiLogger";
import { HiFiConnectionStates } from "./HiFiCommunicator";

// We use @ts-ignore here so TypeScript doesn't complain about importing these plain JS modules.
// @ts-ignore
import { RaviUtils } from "../libravi/RaviUtils";
// @ts-ignore
import { RaviSession, RaviSessionStates } from "../libravi/RaviSession";
// @ts-ignore
import { RaviSignalingConnection, SignalingStates } from "../libravi/RaviSignalingConnection";
import { HiFiAxisUtilities, ourHiFiAxisConfiguration } from "./HiFiAxisConfiguration";
const pako = require('pako');

const INIT_TIMEOUT_MS = 5000;

/**
 * Instantiations of this class contain data about a connection between a client and a mixer.
 * Client library users shouldn't have to care at all about the variables and methods contained in this class.
 */
export class HiFiMixerSession {
    /**
     * The RAVI Signaling Connection associated with this Mixer Session.
     */
    private _raviSignalingConnection: RaviSignalingConnection;
    /**
     * The RAVI Session associated with this Mixer Session.
     */
    private _raviSession: RaviSession;

    /**
     * Stores the current HiFi Connection State, which is an abstraction separate from the RAVI Session State and RAVI Signaling State.
     */
    private _currentHiFiConnectionState: HiFiConnectionStates;

    /**
     * Used when muting and unmuting to save the state of the user's input device's `MediaTrackConstraints`.
     * When a user mutes, we explicitly call `stop()` on all audio tracks associated with the user's input device.
     * When a user unmutes, we must call `getUserMedia()` to re-obtain those audio tracks. We want to call `getUserMedia()`
     * with the same constraints used by the application when _it_ first calls `getUserMedia()`.
     */
    private _cachedMediaTrackConstraints: MediaTrackConstraints;

    /**
     * When we receive peer data from the server, it's in a format like this:
     * {
     *     318: {c: "#5df1f5", d: "Howard", e: "873c4d43-ccd9-4ce4-9ac7-d5fade4def929a", i: "{f0ce22bb-8b67-4044-a8c5-65aefbce4060}", o: 0, …}
     *     341: {e: "9c5af44b-7e3f-8f65-5421-374b43bebc4a", i: "{be38a256-850a-4c8d-bddd-cfe80aaddfe9}", o: 0, p: true, v: -120, …}
     * }
     * The peer data does not always contain all possible key/value pairs associated with each key in this Object. In fact, most of the time, it contains
     * only a fraction of the data. For example, we might receive `{ 341: {v: -40} }` from the server.
     * When the HiFi Audio Library user sets up a User Data Subscription, they can optionally associate the Subscription with a "Provided User ID".
     * Since the server doesn't always send the "Provided User ID" in these peer updates, we have to keep track of the (presumably stable) key in `jsonData.peers`
     * associated with that "Provided User ID" in order to forward that "Provided User ID" to the Subscription handler and thus to the Library user.
     * Thus, the Library user should never have to care about the `_mixerPeerKeyToProvidedUserIDDict`.
     * Similarly, we keep a `_mixerPeerKeyToHashedVisitIDDict`.
     */
    private _mixerPeerKeyToProvidedUserIDDict: any;
    private _mixerPeerKeyToHashedVisitIDDict: any;

    /**
     * We will track whether or not the input stream is stereo, so that
     * we can advise the server to mix it appropriately
     */
    private _inputAudioMediaStreamIsStereo: boolean;

    /**
     * The WebRTC Stats Observer callback
     */
    private _statsObserverCallback: Function;

    /**
     * If set to `true`, the `streaming_scope` argument to the `audionet.init` command will be set to `"all"`, which ensures that the Server sends all User Data updates
     * to the client. If set to `false`, the `streaming_scope` argument will be set to `none`, which ensures that the Server will not send _any_ User Data updates to the client.
     * 
     * If set to `false`, User Data Subscriptions will serve no purpose.
     */
    serverShouldSendUserData: boolean;

    /**
     * The WebRTC Address to which we want to connect as a part of this Session. This WebRTC Address is obtained from the Mixer Discovery Address during
     * the `HiFiCommunicator.connectToHiFiAudioAPIServer()` call.
     */
    webRTCAddress: string;
    /**
     * This function is called when Peer data is returned from the Server.
     */
    onUserDataUpdated: Function;
    /**
     * This function is called when a Peer disconnects from the Server.
     */
    onUsersDisconnected: Function;
    /**
     * This function is called when the "connection state" changes.
     * Right now, this is called when the the RAVI session state changes to
     * `RaviSessionStates.CONNECTED`, `RaviSessionStates.DISCONNECTED`, and `RaviSessionStates.FAILED`.
     */
    onConnectionStateChanged: Function;

    /**
     * Contains information about the mixer to which we are currently connected.
     */
    mixerInfo: any;

    /**
     * 
     * @param __namedParameters
     * @param serverShouldSendUserData - If set to `true`, the `streaming_scope` argument to the `audionet.init` command will be set to `"all"`, which ensures that the Server sends all User Data updates
     * to the client. If set to `false`, the `streaming_scope` argument will be set to `none`, which ensures that the Server will not send _any_ User Data updates to the client.
     * 
     * If set to `false`, User Data Subscriptions will serve no purpose.
     * @param onUserDataUpdated - The function to call when the server sends user data to the client. Irrelevant if `serverShouldSendUserData` is `false`.
     * @param onUsersDisconnected - The function to call when the server sends user data about peers who just disconnected to the client.
     */
    constructor({ serverShouldSendUserData = true, onUserDataUpdated, onUsersDisconnected, onConnectionStateChanged }: { serverShouldSendUserData?: boolean, onUserDataUpdated?: Function, onUsersDisconnected?: Function, onConnectionStateChanged?: Function }) {
        this.webRTCAddress = undefined;
        this.serverShouldSendUserData = serverShouldSendUserData;
        this.onUserDataUpdated = onUserDataUpdated;
        this.onUsersDisconnected = onUsersDisconnected;
        this._mixerPeerKeyToProvidedUserIDDict = {};
        this._mixerPeerKeyToHashedVisitIDDict = {};
        
        RaviUtils.setDebug(false);
        
        this._raviSignalingConnection = new RaviSignalingConnection();
        this._raviSignalingConnection.addStateChangeHandler((event: any) => {
            this.onRAVISignalingStateChanged(event);
        });
        
        this._raviSession = new RaviSession();
        this._raviSession.addStateChangeHandler((event: any) => {
            this.onRAVISessionStateChanged(event);
        });
        
        this.onConnectionStateChanged = onConnectionStateChanged;
        
        this._resetMixerInfo();
    }

    /**
     * Sends the command `audionet.init` to the mixer.
     * 
     * @returns If this operation is successful, the Promise will resolve with `{ success: true, audionetInitResponse: <The response to `audionet.init` from the server in Object format>}`.
     * If unsuccessful, the Promise will reject with `{ success: false, error: <an error message> }`.
     */
    async promiseToRunAudioInit(): Promise<any> {
        return new Promise((resolve, reject) => {
            let initData = {
                primary: true,
                // The mixer will hash this randomly-generated UUID, then disseminate it to all clients via `peerData.e`.
                visit_id: this._raviSession.getUUID(),
                session: this._raviSession.getUUID(), // Still required for old mixers. Will eventually go away.
                // Accepts "none", "peers", or "all".
                streaming_scope: this.serverShouldSendUserData ? "all" : "none",
                is_input_stream_stereo: this._inputAudioMediaStreamIsStereo
            };
            let commandController = this._raviSession.getCommandController();
            if (!commandController) {
                return Promise.reject({
                    success: false,
                    error: `Couldn't connect to mixer: no \`commandController\`!`
                });
            }

            let initTimeout = setTimeout(() => {
                this.disconnect();
                return Promise.reject({
                    success: false,
                    error: `Couldn't connect to mixer: Call to \`init\` timed out!`
                });
            }, INIT_TIMEOUT_MS);

            commandController.queueCommand("audionet.init", initData, async (response: string) => {
                clearTimeout(initTimeout);
                let parsedResponse: any;
                try {
                    parsedResponse = JSON.parse(response);
                    this.mixerInfo["connected"] = true;
                    this.mixerInfo["build_number"] = parsedResponse.build_number;
                    this.mixerInfo["build_type"] = parsedResponse.build_type;
                    this.mixerInfo["build_version"] = parsedResponse.build_version;
                    this.mixerInfo["visit_id_hash"] = parsedResponse.visit_id_hash;
                    parsedResponse["unhashedVisitID"] = this._raviSession.getUUID();
                    resolve({
                        success: true,
                        audionetInitResponse: parsedResponse
                    });
                } catch (e) {
                    reject({
                        success: false,
                        error: `Couldn't parse init response! Parse error:\n${e}`
                    });
                }
            });
        });
    }

    /**
     * `mixer` and `peer` data is sent from the Mixer to all connected clients when necessary.
     * @param data The `gzipped` data from the Mixer.
     */
    handleRAVISessionBinaryData(data: any) {
        let unGZippedData = pako.ungzip(data, { to: 'string' });
        let jsonData = JSON.parse(unGZippedData);

        // Wait for merge and deploy of https://github.com/highfidelity/audionet-hifi/pull/258
        if (jsonData.deleted_visit_ids) {
            console.log(jsonData.deleted_visit_ids);
            
            // let allDeletedUserData: Array<ReceivedHiFiAudioAPIData> = [];

            // let deletedPeersKeys = Object.keys(jsonData.deleted_peers);
            // for (let itr = 0; itr < deletedPeersKeys.length; itr++) {
            //     let peerDataFromMixer = jsonData.deleted_peers[deletedPeersKeys[itr]];

            //     let deletedUserData = new ReceivedHiFiAudioAPIData();
            // }

            // if (this.onUsersDisconnected && allDeletedPeers.length > 0) {
            //     this.onUsersDisconnected(allDeletedPeers);
            // }
        }


        if (jsonData.peers) {
            let allNewUserData: Array<ReceivedHiFiAudioAPIData> = [];

            let peerKeys = Object.keys(jsonData.peers);
            for (let itr = 0; itr < peerKeys.length; itr++) {
                let peerDataFromMixer = jsonData.peers[peerKeys[itr]];

                let newUserData = new ReceivedHiFiAudioAPIData();

                // See {@link this._mixerPeerKeyToProvidedUserIDDict}.
                if (this._mixerPeerKeyToProvidedUserIDDict[peerKeys[itr]]) {
                    newUserData.providedUserID = this._mixerPeerKeyToProvidedUserIDDict[peerKeys[itr]];
                } else if (typeof (peerDataFromMixer.J) === "string") {
                    newUserData.providedUserID = peerDataFromMixer.J;
                    this._mixerPeerKeyToProvidedUserIDDict[peerKeys[itr]] = newUserData.providedUserID;
                }

                // `.e` is the `hashedVisitID`, which is a hashed version of the random UUID that a connecting client
                // sends as the `session` key inside the argument to the `audionet.init` command.
                // It is used to identify a given client across a cloud of mixers.
                if (this._mixerPeerKeyToHashedVisitIDDict[peerKeys[itr]]) {
                    newUserData.hashedVisitID = this._mixerPeerKeyToHashedVisitIDDict[peerKeys[itr]];
                } else if (typeof (peerDataFromMixer.e) === "string") {
                    newUserData.hashedVisitID = peerDataFromMixer.e;
                    this._mixerPeerKeyToHashedVisitIDDict[peerKeys[itr]] = newUserData.hashedVisitID;
                }

                let serverSentNewUserData = false;

                // `ReceivedHiFiAudioAPIData.position.x`
                if (typeof (peerDataFromMixer.x) === "number") {
                    if (!newUserData.position) {
                        newUserData.position = new Point3D();
                    }
                    // Mixer sends position data in millimeters
                    newUserData.position.x = peerDataFromMixer.x / 1000;
                    serverSentNewUserData = true;
                }
                // `ReceivedHiFiAudioAPIData.position.y`
                if (typeof (peerDataFromMixer.y) === "number") {
                    if (!newUserData.position) {
                        newUserData.position = new Point3D();
                    }
                    // Mixer sends position data in millimeters
                    newUserData.position.y = peerDataFromMixer.y / 1000;
                    serverSentNewUserData = true;
                }
                // `ReceivedHiFiAudioAPIData.position.z`
                if (typeof (peerDataFromMixer.z) === "number") {
                    if (!newUserData.position) {
                        newUserData.position = new Point3D();
                    }
                    // Mixer sends position data in millimeters
                    newUserData.position.z = peerDataFromMixer.z / 1000;
                    serverSentNewUserData = true;
                }

                // `ReceivedHiFiAudioAPIData.orientationEuler.pitchDegrees`
                if (typeof (peerDataFromMixer.k) === "number") {
                    if (!newUserData.orientationEuler) {
                        newUserData.orientationEuler = new OrientationEuler3D();
                    }
                    newUserData.orientationEuler.pitchDegrees = peerDataFromMixer.k;
                    serverSentNewUserData = true;
                }
                // `ReceivedHiFiAudioAPIData.orientationEuler.yawDegrees`
                if (typeof (peerDataFromMixer.o) === "number") {
                    if (!newUserData.orientationEuler) {
                        newUserData.orientationEuler = new OrientationEuler3D();
                    }
                    newUserData.orientationEuler.yawDegrees = peerDataFromMixer.o;
                    serverSentNewUserData = true;
                }
                // `ReceivedHiFiAudioAPIData.orientationEuler.rollDegrees`
                if (typeof (peerDataFromMixer.l) === "number") {
                    if (!newUserData.orientationEuler) {
                        newUserData.orientationEuler = new OrientationEuler3D();
                    }
                    newUserData.orientationEuler.rollDegrees = peerDataFromMixer.l;
                    serverSentNewUserData = true;
                }

                // `ReceivedHiFiAudioAPIData.orientationQuat.*`
                if (typeof (peerDataFromMixer.W) === "number" && typeof (peerDataFromMixer.X) === "number" && typeof (peerDataFromMixer.Y) === "number" && typeof (peerDataFromMixer.Z) === "number") {
                    newUserData.orientationQuat = new OrientationQuat3D({
                        // Mixer sends Quaternion component data multiplied by 1000
                        w: peerDataFromMixer.W / 1000,
                        x: peerDataFromMixer.X / 1000,
                        y: peerDataFromMixer.Y / 1000,
                        z: peerDataFromMixer.Z / 1000
                    });
                    serverSentNewUserData = true;
                }

                // `ReceivedHiFiAudioAPIData.hiFiGain`
                if (typeof (peerDataFromMixer.g) === "number") {
                    newUserData.hiFiGain = peerDataFromMixer.g;
                    serverSentNewUserData = true;
                }

                // `ReceivedHiFiAudioAPIData.volumeDecibels`
                if (typeof (peerDataFromMixer.v) === "number") {
                    newUserData.volumeDecibels = peerDataFromMixer.v;
                    serverSentNewUserData = true;
                }

                if (serverSentNewUserData) {
                    allNewUserData.push(newUserData);
                }
            }

            if (this.onUserDataUpdated && allNewUserData.length > 0) {
                this.onUserDataUpdated(allNewUserData);
            }
        }
    }

    /**
     * Connect to the Mixer given `this.webRTCAddress`.
     * @returns A Promise that rejects with an error message string upon failure, or resolves with the response from `audionet.init` as a string.
     */
    async connect(): Promise<any> {
        if (!this.webRTCAddress) {
            let errMsg = `Couldn't connect: \`this.webRTCAddress\` is falsey!`;
            this.disconnect();
            return Promise.reject(errMsg);
        }

        this._currentHiFiConnectionState = undefined;

        try {
            await this._raviSignalingConnection.open(this.webRTCAddress)
        } catch (errorOpeningSignalingConnection) {
            let errMsg = `Couldn't open signaling connection to \`${this.webRTCAddress.slice(0, this.webRTCAddress.indexOf("token="))}<token redacted>\`! Error:\n${errorOpeningSignalingConnection}`;
            this.disconnect();
            return Promise.reject(errMsg);
        }

        try {
            await this._raviSession.open(this._raviSignalingConnection);
        } catch (errorOpeningRAVISession) {
            let errMsg = `Couldn't open RAVI session associated with \`${this.webRTCAddress.slice(0, this.webRTCAddress.indexOf("token="))}<token redacted>\`! Error:\n${errorOpeningRAVISession}`;
            this.disconnect();
            return Promise.reject(errMsg);
        }

        let audionetInitResponse;
        try {
            audionetInitResponse = await this.promiseToRunAudioInit();
        } catch (initError) {
            let errMsg = `\`audionet.init\` command failed! Error:\n${initError.error}`;
            this.disconnect();
            return Promise.reject(errMsg);
        }

        this._raviSession.getCommandController().addBinaryHandler((data: any) => { this.handleRAVISessionBinaryData(data) }, true);

        return Promise.resolve(audionetInitResponse);
    }

    /**
     * Disconnects from the Mixer. Closes the RAVI Signaling Connection and the RAVI Session.
     * @returns A Promise that _always_ Resolves with a "success" status string.
     */
    async disconnect(): Promise<string> {
        async function close(thingToClose: (RaviSignalingConnection | RaviSession), nameOfThingToClose: string, closedState: string) {
            if (thingToClose) {
                let state = thingToClose.getState();
                if (!thingToClose || state === closedState) {
                    HiFiLogger.log(`The RAVI ${nameOfThingToClose} was already closed.`);
                } else {
                    try {
                        await thingToClose.close();
                        HiFiLogger.log(`The RAVI ${nameOfThingToClose} closed successfully from state ${state}.`);
                    } catch (e) {
                        HiFiLogger.warn(`The RAVI ${nameOfThingToClose} didn't close successfully from state ${state}! Error:\n${e}`);
                    }
                }
            } else {
                HiFiLogger.warn(`The RAVI ${nameOfThingToClose} was missing.`);
            }

            thingToClose = null;
        }

        await close(this._raviSignalingConnection, "Signaling Connection", SignalingStates.CLOSED);
        await close(this._raviSession, "Session", RaviSessionStates.CLOSED);

        this._resetMixerInfo();

        return Promise.resolve(`Successfully disconnected.`);
    }

    /**
     * Sets the audio `MediaStream` that is sent to RAVI to be mixed.
     * @param inputAudioMediaStream The `MediaStream` that is sent to RAVI to be mixed.
     * @param isStereo - `true` if the input stream should be treated as stereo. Defaults to `false`.
     * @returns `true` if the new stream was successfully set; `false` otherwise.
     */
    async setRAVIInputAudio(inputAudioMediaStream: MediaStream, isStereo: boolean = false): Promise<boolean> {

        let retval = false;
        if (this._raviSession) {
            let streamController = this._raviSession.getStreamController();
            if (!streamController) {
                HiFiLogger.warn(`Couldn't set input audio on _raviSession.streamController: No \`streamController\`!`);
                retval = false;
            } else {
                streamController.setInputAudio(inputAudioMediaStream, isStereo);
                HiFiLogger.log(`Successfully set input audio on _raviSession.streamController!`);
                retval = true;
            }
        } else {
            HiFiLogger.warn(`Couldn't set input audio on _raviSession.streamController: No \`_raviSession\`!`);
            retval = false;
        }

        if (retval) {
            if (this._inputAudioMediaStreamIsStereo != isStereo) {
                if (this._raviSession.getState() === RaviSessionStates.CONNECTED) {
                    // Stereo status has changed; may need to call audionet.init again.
                    HiFiLogger.warn(`Stereo status has changed from ${this._inputAudioMediaStreamIsStereo} to ${isStereo}; attempting to re-initialize with the mixer`);
                    let audionetInitResponse;
                    try {
                        this._inputAudioMediaStreamIsStereo = isStereo;
                        audionetInitResponse = await this.promiseToRunAudioInit();
                    } catch (initError) {
                        // If this goes wrong, do we actually care all that much?
                        // It just means that the mixer will continue to treat the new stream as
                        // whatever setting it was before. For now, just return the error and
                        // let the user try again if they want.
                        let errMsg = `Attempt to call \`audionet.init\` for change in stereo status failed! Error:\n${initError.error}`;
                        return Promise.reject(errMsg);
                    }
                } else {
                    // If we haven't already connected, it'll just pick up the right stereo value when we
                    // call it the first time.
                    this._inputAudioMediaStreamIsStereo = isStereo;
                }
            }
        }
        return retval;
    }

    /**
     * Sets the input audio stream to "muted" by disabling all of the tracks on it
     * (or to "unmuted" by enabling the tracks on it).
     * @returns `true` if the stream was successfully muted/unmuted, `false` if it was not.
     */
    async setInputAudioMuted(newMutedValue: boolean): Promise<boolean> {
        let streamController = this._raviSession.getStreamController();
        if (this._raviSession && streamController) {
            let hasMicPermission = false;

            if (navigator.permissions && navigator.permissions.query) {
                let result: PermissionStatus = await navigator.permissions.query({ name: 'microphone' });
                if (result.state === "granted") {
                    hasMicPermission = true;
                }
            }

            if (!hasMicPermission || typeof self === 'undefined') {
                // NodeJS context OR the user hasn't granted or can't grant permanent mic permissions to our script...
                // On iOS Safari, the user _can't_ grant permanent mic permissions to our script.
                let raviAudioStream = streamController._inputAudioStream;

                if (raviAudioStream) {
                    raviAudioStream.getTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = !newMutedValue;
                    });
                    HiFiLogger.log(`Successfully set mute state to ${newMutedValue} on _raviSession.streamController._inputAudioStream`);
                    return true;
                } else {
                    HiFiLogger.warn(`Couldn't set mute state: No \`_inputAudioStream\` on \`_raviSession.streamController\`.`);
                }
            } else {
                // In the browser context, if and only if the user has granted mic permissions to our script,
                // we want to call `stop()` on all `MediaStreamTrack`s associated with the
                // user's audio input device stream. This is to hopefully allow the OS to switch the user's output audio device
                // into half-duplex (i.e. stereo) mode in the case where that output device is Bluetooth.
                // If the user hasn't granted permanent mic permissions to our script, doing this would break features like push-to-talk,
                // as the browser would prompt the user for permission to access the microphone every time they unmuted.
                //
                // We may not want to use this code branch at all, as getting a brand-new `MediaStream` every time the user unmutes
                // may introduce unwanted delay on slower devices. Additionally, since the user can _never_ grant permanent mic permissions
                // to our script on iOS, and many of our problems with half-duplex audio are on iOS, we may see no gain from adding this code.
                let raviAudioStream = streamController._inputAudioStream;
                if (raviAudioStream && newMutedValue) {
                    raviAudioStream.getTracks().forEach((track: MediaStreamTrack) => {
                        // The `MediaTrackConstraints` are very likely to be the same across all `MediaStreamTracks`.
                        // Thus, in the case of overwriting this value multiple times due to multiple tracks contained
                        // within the `raviAudioStream`, there should be no problems.
                        this._cachedMediaTrackConstraints = track.getConstraints();
                        track.stop();
                    });
                    streamController.setInputAudio(null);
                    HiFiLogger.log(`Successfully set mute state to \`true\` by stopping all input media tracks!`);
                    return true;
                } else if (!raviAudioStream && !newMutedValue) {
                    let newMediaStream = await navigator.mediaDevices.getUserMedia({ audio: this._cachedMediaTrackConstraints, video: false });
                    streamController.setInputAudio(newMediaStream);
                    HiFiLogger.log(`Successfully set mute state to \`false\` by getting new input media stream!`);
                    return true;
                } else if (raviAudioStream && !newMutedValue) {
                    raviAudioStream.getTracks().forEach((track: MediaStreamTrack) => {
                        track.enabled = true;
                    });
                    HiFiLogger.log(`Successfully set mute state to \`false\` by enabling all tracks on \`_raviSession.streamController._inputAudioStream\`!`);
                    return true;
                } else {
                    HiFiLogger.warn(`Couldn't set mute state: No \`_inputAudioStream\` on \`_raviSession.streamController\`.`);
                }
            }
        } else {
            HiFiLogger.warn(`Couldn't set mute state: No \`_raviSession\`, or \`_raviSession.getStreamController()\` returned null.`);
            return false;
        }
    }

    /**
     * Gets the output `MediaStream` from the Mixer. This is the final, mixed, spatialized audio stream containing
     * all sources sent to the Mixer.
     * @returns The mixed, spatialized `MediaStream` from the Mixer. Returns `null` if it's not possible to obtain that `MediaStream`.
     */
    getOutputAudioMediaStream(): MediaStream {
        if (!this._raviSession) {
            return null;
        }

        let streamController = this._raviSession.getStreamController();

        if (!streamController) {
            return null;
        }

        return streamController.getAudioStream();
    }

    /**
     * Fires when the RAVI Signaling State chantges.
     * @param event 
     */
    onRAVISignalingStateChanged(event: any): void {
        HiFiLogger.log(`New RAVI signaling state: \`${event.state}\``);
        switch (event.state) {
            case SignalingStates.UNAVAILABLE:
                this._currentHiFiConnectionState = HiFiConnectionStates.Unavailable;
                if (this.onConnectionStateChanged) {
                    this.onConnectionStateChanged(this._currentHiFiConnectionState);
                }
                this.disconnect();
                break;
        }
    }

    /**
     * Fires when the RAVI Session State changes.
     * @param event
     */
    onRAVISessionStateChanged(event: any): void {
        HiFiLogger.log(`New RAVI session state: \`${event.state}\``);
        switch (event.state) {
            case RaviSessionStates.CONNECTED:
                this._mixerPeerKeyToProvidedUserIDDict = {};
                this._mixerPeerKeyToHashedVisitIDDict = {};

                this._currentHiFiConnectionState = HiFiConnectionStates.Connected;

                if (this.onConnectionStateChanged) {
                    this.onConnectionStateChanged(this._currentHiFiConnectionState);
                }
                break;
            case RaviSessionStates.DISCONNECTED:
                if (this._currentHiFiConnectionState === HiFiConnectionStates.Unavailable) {
                    break;
                }

                this._currentHiFiConnectionState = HiFiConnectionStates.Disconnected;

                if (this.onConnectionStateChanged) {
                    this.onConnectionStateChanged(this._currentHiFiConnectionState);
                }
                break;
            case RaviSessionStates.FAILED:
                if (this._currentHiFiConnectionState === HiFiConnectionStates.Unavailable) {
                    break;
                }

                this._currentHiFiConnectionState = HiFiConnectionStates.Failed;

                if (this.onConnectionStateChanged) {
                    this.onConnectionStateChanged(this._currentHiFiConnectionState);
                }
                break;
        }
    }    

    startCollectingWebRTCStats(callback: Function) {
        if (!this._raviSession) {
            HiFiLogger.error(`Couldn't start collecting WebRTC stats: No \`_raviSession\`!`);
            return;
        }

        if (this._statsObserverCallback) {
            this.stopCollectingWebRTCStats();
        }

        this._statsObserverCallback = callback;

        this._raviSession.addStatsObserver(this._statsObserverCallback);
    }

    stopCollectingWebRTCStats() {
        if (!this._raviSession) {
            HiFiLogger.error(`Couldn't stop collecting WebRTC stats: No \`_raviSession\`!`);
            return;
        }

        this._raviSession.removeStatsObserver(this._statsObserverCallback);

        this._statsObserverCallback = undefined;
    }

    /**
     * @returns If this operation is successful, returns `{ success: true, stringifiedDataForMixer: <the raw data that was transmitted to the server>}`. If unsuccessful, returns
     * `{ success: false, error: <an error message> }`.
     */
    _transmitHiFiAudioAPIDataToServer(hifiAudioAPIData: HiFiAudioAPIData): any {
        if (!this.mixerInfo["connected"] || !this._raviSession) {
            return {
                success: false,
                error: `Can't transmit data to mixer; not connected to mixer.`
            };
        }

        let dataForMixer: any = {};

        if (hifiAudioAPIData.position) {
            let translatedPosition = HiFiAxisUtilities.translatePoint3DToMixerSpace(ourHiFiAxisConfiguration, hifiAudioAPIData.position);

            // Position data is sent in millimeters integers to reduce JSON size.
            if (typeof (translatedPosition.x) === "number") {
                dataForMixer["x"] = Math.round(translatedPosition.x * 1000);
            }
            if (typeof (translatedPosition.y) === "number") {
                dataForMixer["y"] = Math.round(translatedPosition.y * 1000);
            }
            if (typeof (translatedPosition.z) === "number") {
                dataForMixer["z"] = Math.round(translatedPosition.z * 1000);
            }
        }

        if (hifiAudioAPIData.orientationEuler) {
            let translatedOrientation = HiFiAxisUtilities.translateOrientationEuler3DToMixerSpace(ourHiFiAxisConfiguration, hifiAudioAPIData.orientationEuler);

            if (typeof (translatedOrientation.pitchDegrees) === "number") {
                dataForMixer["k"] = translatedOrientation.pitchDegrees;
            }
            if (typeof (translatedOrientation.yawDegrees) === "number") {
                dataForMixer["o"] = translatedOrientation.yawDegrees;
            }
            if (typeof (translatedOrientation.rollDegrees) === "number") {
                dataForMixer["l"] = translatedOrientation.rollDegrees;
            }
        }

        // The mixer expects Quaternion components to be mulitiplied by 1000.
        if (hifiAudioAPIData.orientationQuat) {
            if (typeof (hifiAudioAPIData.orientationQuat.w) === "number") {
                dataForMixer["W"] = hifiAudioAPIData.orientationQuat.w * 1000;
            }
            if (typeof (hifiAudioAPIData.orientationQuat.x) === "number") {
                dataForMixer["X"] = hifiAudioAPIData.orientationQuat.x * 1000;
            }
            if (typeof (hifiAudioAPIData.orientationQuat.y) === "number") {
                dataForMixer["Y"] = hifiAudioAPIData.orientationQuat.y * 1000;
            }
            if (typeof (hifiAudioAPIData.orientationQuat.z) === "number") {
                dataForMixer["Z"] = hifiAudioAPIData.orientationQuat.z * 1000;
            }
        }

        if (typeof (hifiAudioAPIData.hiFiGain) === "number") {
            dataForMixer["g"] = Math.max(0, hifiAudioAPIData.hiFiGain);
        }

        if (Object.keys(dataForMixer).length === 0) {
            // We call this a "success" even though we didn't send anything to the mixer.
            return {
                success: true,
                stringifiedDataForMixer: JSON.stringify({})
            };
        } else {
            let commandController = this._raviSession.getCommandController();

            if (commandController) {
                let stringifiedDataForMixer = JSON.stringify(dataForMixer);
                commandController.sendInput(stringifiedDataForMixer);
                return {
                    success: true,
                    stringifiedDataForMixer: stringifiedDataForMixer
                };
            } else {
                return {
                    success: false,
                    error: `Can't transmit data to mixer; no \`commandController\`!.`
                };
            }
        }
    }

    /**
     * Resets our "Mixer Info". Happens upon instantiation and when disconnecting from the mixer.
     */
    private _resetMixerInfo(): void {
        this.mixerInfo = {
            "connected": false,
        };
    }
}
