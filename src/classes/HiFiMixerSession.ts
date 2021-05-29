/**
 * Code in this module is used internally by the [[HiFiCommunicator]] object to manage the connection between client and server.
 * Developers do not need to and should not consider this module when writing their applications.
 * @packageDocumentation
 */

import { HiFiAudioAPIData, OrientationQuat3D, Point3D, ReceivedHiFiAudioAPIData, OtherUserGainMap } from "./HiFiAudioAPIData";
import { HiFiCoordinateFrameUtil } from "../utilities/HiFiCoordinateFrameUtil"; 
import { HiFiLogger } from "../utilities/HiFiLogger";
import { HiFiConnectionStates, HiFiUserDataStreamingScopes } from "./HiFiCommunicator";

import { RaviUtils } from "../libravi/RaviUtils";
import { RaviSession, RaviSessionStates, WebRTCSessionParams, CustomSTUNandTURNConfig } from "../libravi/RaviSession";
import { RaviSignalingConnection, RaviSignalingStates } from "../libravi/RaviSignalingConnection";
const pako = require('pako');

const INIT_TIMEOUT_MS = 5000;
const PERSONAL_VOLUME_ADJUST_TIMEOUT_MS = 5000;

interface AudionetSetOtherUserGainsForThisConnectionResponse {
    success: boolean,
    reason?: string
}

export interface SetOtherUserGainsForThisConnectionResponse {
    success: boolean,
    error?: string,
    audionetSetOtherUserGainsForThisConnectionResponse?: AudionetSetOtherUserGainsForThisConnectionResponse
}

export type SetOtherUserGainForThisConnectionResponse = SetOtherUserGainsForThisConnectionResponse;

/**
 * This enum string represents the reason the client's mute state has updated.
 * See {@link OnMuteChangedCallback} for how this is used.
 *
 * {@link MuteReason.CLIENT} is used to indicate that the client has attempted to change the mute state using {@link HiFiCommunicator.setInputAudioMuted}
 *
 * {@link MuteReason.ADMIN} is used to indicate that the server has changed the client's mute state.
 *
 * {@link MuteReason.INTERNAL} is used to indicate that the client's mute state has changed due to an implementation detail of the spatial audio API, for example to keep the state of the client consistent with the server.
*/
export enum MuteReason {
    CLIENT = "client",
    ADMIN = "admin",
    INTERNAL = "internal"
}

/**
 * This event object describes how and why the mute state of the client has changed. It is passed in as a parameter to {@link OnMuteChangedCallback}.
*/
export class MuteChangedEvent {
    /**
     * Indicates whether the the mute state was set successfully.
     * This may be `false` if the client is trying to unmute themselves when muted by an admin, or if there was a failure setting the mute state of the input device.
    */
    success: boolean;
    /**
     * Indicates the muted value that would have been set if the mute state was set succesfully.
     * `true` means muted, `false` means unmuted.
    */
    targetInputAudioMutedValue: boolean;
    /**
     * Indicates the current muted value after attempting to set mute state.
     * `true` means muted, `false` means unmuted.
    */
    currentInputAudioMutedValue: boolean;
    /**
     * Indicates whether the client is currently prevented from unmuting using {@link HiFiCommunicator.setInputAudioMuted}.
    */
    adminPreventsInputAudioUnmuting: boolean;
    /**
     * Indicates the reason the mute state has changed.
    */
    muteReason: MuteReason;

    constructor({ success, targetInputAudioMutedValue, currentInputAudioMutedValue, adminPreventsInputAudioUnmuting, muteReason }: { success: boolean, targetInputAudioMutedValue: boolean, currentInputAudioMutedValue: boolean, adminPreventsInputAudioUnmuting: boolean, muteReason: MuteReason }) {
        this.success = success;
        this.targetInputAudioMutedValue = targetInputAudioMutedValue;
        this.currentInputAudioMutedValue = currentInputAudioMutedValue;
        this.adminPreventsInputAudioUnmuting = adminPreventsInputAudioUnmuting;
        this.muteReason = muteReason;
    }
}

/**
 * An `onMuteChanged` callback function with this signature can be provided to {@link HiFiCommunicator.constructor}. The function you provide will be called whenever the mute state of the client may have updated.
 *
 * One situation where this is useful is when the client's mute state has been changed by an admin, i.e. when {@link MuteChangedEvent.muteReason} is {@link MuteReason.ADMIN}. If {@link MuteChangedEvent.adminPreventsInputAudioUnmuting} is `true`, then the client is muted, and is prevented from unmuting when using {@link HiFiCommunicator.setInputAudioMuted}. If {@link MuteChangedEvent.adminPreventsInputAudioUnmuting} is `false`, then the client is no longer prevented from unmuting, but is not automatically unmuted. The client is allowed to mute themself at any time regardless of the current mute state.
 *
 * If {@link MuteChangedEvent.muteReason} is equal to {@link MuteReason.CLIENT}, the client attempted to set the mute state through {@link HiFiCommunicator.setInputAudioMuted}.
 *
 * If {@link MuteChangedEvent.muteReason} is equal to {@link MuteReason.INTERNAL}, the client's mute state has changed due to an implementation detail of the spatial audio API, for example to keep the state of the client consistent with the server.
 *
 * This callback can also be used to keep track of whether the client is muted and display this in the client UI, and can also be used for debugging purposes. The mute state of the client may not have changed after this callback.
*/
export type OnMuteChangedCallback = (muteChangedEvent: MuteChangedEvent) => void;

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
     * 
     * And since we are caching that one value, we are also caching the full state for all kwnon peers.
     * This allows to optimize the received stream of changed data for a given peer from the server to just the necessary bits
     * and reconstruct the complete information with the knowledge of the cached state of thata peer.
     * One caveat, the position and orienationQuat fields cached for a peer are expressed in the 'MixerSpace', not transformed yet in the 'ClientUserSpace'.
     * 
     * Thus, the Library user should never have to care about the `_mixerPeerKeyToStateCacheDict`.
     */
    private _mixerPeerKeyToStateCacheDict: any;

    /**
     * We will track whether or not the input stream is stereo, so that
     * we can advise the server to mix it appropriately
     */
    private _inputAudioMediaStreamIsStereo: boolean;

    private _adminPreventsInputAudioUnmuting: boolean;
    private _lastSuccessfulInputAudioMutedValue: boolean;

    private onMuteChanged: OnMuteChangedCallback;

    /**
     * The WebRTC Stats Observer callback
     */
    private _statsObserverCallback: Function;

    /**
     * See {@link HiFiUserDataStreamingScopes}.
     */
    userDataStreamingScope: HiFiUserDataStreamingScopes;

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
     * If the World coordinate system is NOT compatible with the HiFi coordindate frame used by the mixer
     * then configure a HiFiCoordinateFrameUtil to transform to and from HiFi-frame.
     *
     * The World-frame is compatible iff:
     * (1) It is right-handed
     * (2) It uses the Y-axis (positive or negative, doesn't matter) for the UP direction.
     *
     * For all other cases create a HiFiCoordinateFrameUtil like so:
     *
     */
    _coordFrameUtil: HiFiCoordinateFrameUtil;

    /**
     * Contains information about the mixer to which we are currently connected.
     */
    mixerInfo: any;

    /**
     * 
     * @param __namedParameters
     * @param userDataStreamingScope - See {@link HiFiUserDataStreamingScopes}.
     * 
     * If set to `false`, User Data Subscriptions will serve no purpose.
     * @param onUserDataUpdated - The function to call when the server sends user data to the client. Irrelevant if `userDataStreamingScope` is `HiFiUserDataStreamingScopes.None`.
     * @param onUsersDisconnected - The function to call when the server sends user data about peers who just disconnected to the client.
     */
    constructor({ userDataStreamingScope = HiFiUserDataStreamingScopes.All, onUserDataUpdated, onUsersDisconnected, onConnectionStateChanged, onMuteChanged, coordFrameUtil }: { userDataStreamingScope?: HiFiUserDataStreamingScopes, onUserDataUpdated?: Function, onUsersDisconnected?: Function, onConnectionStateChanged?: Function, onMuteChanged?: OnMuteChangedCallback, coordFrameUtil?: HiFiCoordinateFrameUtil}) {
        this.webRTCAddress = undefined;
        this.userDataStreamingScope = userDataStreamingScope;
        this.onUserDataUpdated = onUserDataUpdated;
        this.onUsersDisconnected = onUsersDisconnected;
        this._mixerPeerKeyToStateCacheDict = {};
        this._lastSuccessfulInputAudioMutedValue = false;
        this.onMuteChanged = onMuteChanged;
        this._coordFrameUtil = coordFrameUtil;

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
                streaming_scope: this.userDataStreamingScope,
                is_input_stream_stereo: this._inputAudioMediaStreamIsStereo
            };
            let commandController = this._raviSession.getCommandController();
            if (!commandController) {
                return Promise.reject({
                    success: false,
                    error: `Couldn't connect to mixer: no \`commandController\`!`
                });
            }

            let initTimeout = setTimeout(async () => {
                let errMsg = `Couldn't connect to mixer: Call to \`init\` timed out!`
                try {
                    await this.disconnectFromHiFiMixer();
                } catch (errorClosing) {
                    errMsg += `\nAdditionally, there was an error trying to close the failed connection. Error:\n${errorClosing}`;
                }
                return Promise.reject({
                    success: false,
                    error: errMsg
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

        if (jsonData.deleted_visit_ids) {
            let allDeletedUserData: Array<ReceivedHiFiAudioAPIData> = [];

            let deletedVisitIDs = jsonData.deleted_visit_ids;
            for (const deletedVisitID of deletedVisitIDs) {
                let hashedVisitID = deletedVisitID;

                let deletedUserData = new ReceivedHiFiAudioAPIData({
                    hashedVisitID: hashedVisitID
                });

                let mixerPeerKeys = Object.keys(this._mixerPeerKeyToStateCacheDict);
                for (const mixerPeerKey of mixerPeerKeys) {
                    if (this._mixerPeerKeyToStateCacheDict[mixerPeerKey].hashedVisitID === hashedVisitID) {
                        if (this._mixerPeerKeyToStateCacheDict[mixerPeerKey].providedUserID) {
                            deletedUserData.providedUserID = this._mixerPeerKeyToStateCacheDict[mixerPeerKey].providedUserID;
                        }
                        break;
                    }
                }

                allDeletedUserData.push(deletedUserData);
            }

            // TODO: remove the entry from the peer state cache

            if (this.onUsersDisconnected && allDeletedUserData.length > 0) {
                this.onUsersDisconnected(allDeletedUserData);
            }
        }

        if (jsonData.peers) {
            let allNewUserData: Array<ReceivedHiFiAudioAPIData> = [];

            let peerKeys = Object.keys(jsonData.peers);
            for (let itr = 0; itr < peerKeys.length; itr++) {
                let peerDataFromMixer = jsonData.peers[peerKeys[itr]];

                // See {@link this._mixerPeerKeyToStateCacheDict}.
                let userDataCache: ReceivedHiFiAudioAPIData;
                // If it is a knwon peer, we should have an entry for it in the cache dict
                if (this._mixerPeerKeyToStateCacheDict[peerKeys[itr]]) {
                    userDataCache = this._mixerPeerKeyToStateCacheDict[peerKeys[itr]] as ReceivedHiFiAudioAPIData;
                }
                // if not let's create it.
                else {
                    userDataCache = new ReceivedHiFiAudioAPIData();
                    this._mixerPeerKeyToStateCacheDict[peerKeys[itr]] = userDataCache;
                }

                // This is a new empty data that will collect the changes received from the server.
                // as we collect the changes from the received data, we will also update the userDataCache associated with that peer.
                let newUserData = new ReceivedHiFiAudioAPIData();

                // `.J` is the 'providedUserID'
                if (userDataCache.providedUserID) {
                    // already  defined, should be the same initial value.
                    newUserData.providedUserID = userDataCache.providedUserID;
                } else if (typeof (peerDataFromMixer.J) === "string") {
                    userDataCache.providedUserID = peerDataFromMixer.J;
                    newUserData.providedUserID = peerDataFromMixer.J;
                }

                // `.e` is the `hashedVisitID`, which is a hashed version of the random UUID that a connecting client
                // sends as the `session` key inside the argument to the `audionet.init` command.
                // It is used to identify a given client across a cloud of mixers.
                if (userDataCache.hashedVisitID) {
                    // already  defined, should be the same initial value.
                    newUserData.hashedVisitID = userDataCache.hashedVisitID;
                } else if (typeof (peerDataFromMixer.e) === "string") {
                    userDataCache.hashedVisitID = peerDataFromMixer.e;
                    newUserData.hashedVisitID = peerDataFromMixer.e;
                }

                let serverSentNewUserData = false;

                // `ReceivedHiFiAudioAPIData.position.*`
                let serverSentNewPosition = false;
                if (typeof (peerDataFromMixer.x) === "number") {
                    if (!userDataCache.position) {
                        userDataCache.position = new Point3D();
                    }
                    // Mixer sends position data in millimeters
                    userDataCache.position.x = peerDataFromMixer.x / 1000;
                    serverSentNewPosition = true;
                }
                if (typeof (peerDataFromMixer.y) === "number") {
                    if (!userDataCache.position) {
                        userDataCache.position = new Point3D();
                    }
                    // Mixer sends position data in millimeters
                    userDataCache.position.y = peerDataFromMixer.y / 1000;
                    serverSentNewPosition = true;
                }
                if (typeof (peerDataFromMixer.z) === "number") {
                    if (!userDataCache.position) {
                        userDataCache.position = new Point3D();
                    }
                    // Mixer sends position data in millimeters
                    userDataCache.position.z = peerDataFromMixer.z / 1000;
                    serverSentNewPosition = true;
                }
                if (serverSentNewPosition) {
                    // We received a new position and updated the cache entry.
                    // Need to add the new position value in the newUserData
                    if (this._coordFrameUtil == null) {
                        // HiFi- and World-frame are assumed compatible --> copy position straight across
                        newUserData.position = userDataCache.position;
                    } else {
                        // convert the received position from HiFi- to World-frame
                        newUserData.position = this._coordFrameUtil.HiFiPositionToWorld(userDataCache.position);
                    }
                    serverSentNewUserData = true;
                }

                // `ReceivedHiFiAudioAPIData.orientation.*`
                let serverSentNewOrientation = false;
                if (typeof (peerDataFromMixer.W) === "number") {
                    if (!userDataCache.orientationQuat) {
                        userDataCache.orientationQuat = new OrientationQuat3D();
                    }
                    userDataCache.orientationQuat.w = peerDataFromMixer.W / 1000;
                    serverSentNewOrientation = true;
                }
                if (typeof (peerDataFromMixer.X) === "number") {
                    if (!userDataCache.orientationQuat) {
                        userDataCache.orientationQuat = new OrientationQuat3D();
                    }
                    userDataCache.orientationQuat.x = peerDataFromMixer.X / 1000;
                    serverSentNewOrientation = true;
                }
                if (typeof (peerDataFromMixer.Y) === "number") {
                    if (!userDataCache.orientationQuat) {
                        userDataCache.orientationQuat = new OrientationQuat3D();
                    }
                    userDataCache.orientationQuat.y = peerDataFromMixer.Y / 1000;
                    serverSentNewOrientation = true;
                }
                if (typeof (peerDataFromMixer.Z) === "number") {
                    if (!userDataCache.orientationQuat) {
                        userDataCache.orientationQuat = new OrientationQuat3D();
                    }
                    userDataCache.orientationQuat.z = peerDataFromMixer.Z / 1000;
                    serverSentNewOrientation = true;
                }
                // We received a new orientation and updated the cache entry.
                // Need to add the new orientation value in the newUserData
                if (serverSentNewOrientation) {
                    if (this._coordFrameUtil == null) {
                        newUserData.orientationQuat = new OrientationQuat3D({
                            w: userDataCache.orientationQuat.w,
                            x: userDataCache.orientationQuat.x,
                            y: userDataCache.orientationQuat.y,
                            z: userDataCache.orientationQuat.z});
                    } else {
                        newUserData.orientationQuat = this._coordFrameUtil.HiFiOrientationToWorld(userDataCache.orientationQuat);
                    }
                    serverSentNewUserData = true;
                }

                // `ReceivedHiFiAudioAPIData.volumeDecibels`
                if (typeof (peerDataFromMixer.v) === "number") {
                    userDataCache.volumeDecibels = peerDataFromMixer.v;
                    newUserData.volumeDecibels = peerDataFromMixer.v;
                    serverSentNewUserData = true;
                }

                // `ReceivedHiFiAudioAPIData.isStereo`
                if (typeof (peerDataFromMixer.s) === "boolean") {
                    userDataCache.isStereo = peerDataFromMixer.s;
                    newUserData.isStereo = peerDataFromMixer.s;
                    serverSentNewUserData = true;
                }

                // the newUserData AND the userDataCache have been updated with the new values
                // propagate newUserData to user space
                if (serverSentNewUserData) {
                    allNewUserData.push(newUserData);
                }
            }

            if (this.onUserDataUpdated && allNewUserData.length > 0) {
                this.onUserDataUpdated(allNewUserData);
            }
        }
        
        if (jsonData.instructions) {
            for (const instruction of jsonData.instructions) {
                if (!Array.isArray(instruction) || !instruction.length) {
                    continue;
                }

                let instructionName = instruction[0];
                let instructionArguments = instruction.slice(1);
                if (instructionName === "mute") {
                    let shouldBeMuted: boolean;
                    if (instructionArguments.length >= 1) {
                        if (typeof(instructionArguments[0]) === "boolean") {
                            shouldBeMuted = instructionArguments[0];
                        }
                    }
                    if (shouldBeMuted !== undefined) {
                        this._setMutedByAdmin(shouldBeMuted, MuteReason.ADMIN);
                    }
                }
            }
        }
    }

    /**
     * Connect to the Mixer given `this.webRTCAddress`.
     * 
     * @param __namedParameters
     * @param webRTCSessionParams - Parameters passed to the RAVI session when opening that session.
     * @returns A Promise that rejects with an error message string upon failure, or resolves with the response from `audionet.init` as a string.
     */
    async connectToHiFiMixer({ webRTCSessionParams, customSTUNandTURNConfig }: { webRTCSessionParams?: WebRTCSessionParams, customSTUNandTURNConfig?: CustomSTUNandTURNConfig }): Promise<any> {

        if (this._currentHiFiConnectionState === HiFiConnectionStates.Connected && this.mixerInfo["connected"]) {
            let msg = `Already connected! If a reconnect is needed, please hang up and try again.`;
            return Promise.resolve(msg);
        }

        if (!this.webRTCAddress) {
            let errMsg = `Couldn't connect: \`this.webRTCAddress\` is falsey!`;
            try {
                await this.disconnectFromHiFiMixer();
            } catch (errorClosing) {
                errMsg += `\nAdditionally, there was an error trying to close the failed connection. Error:\n${errorClosing}`;
            }
            return Promise.reject(errMsg);
        }

        this._currentHiFiConnectionState = undefined;

        let mixerIsUnavailable = false;
        const tempUnavailableStateHandler = (event: any) => {
            if (event && event.state === RaviSignalingStates.UNAVAILABLE) {
                mixerIsUnavailable = true;
                this._raviSignalingConnection.removeStateChangeHandler(tempUnavailableStateHandler);
                this._raviSession.closeRAVISession();
            }
        }
        this._raviSignalingConnection.addStateChangeHandler(tempUnavailableStateHandler);

        try {
            await this._raviSignalingConnection.openRAVISignalingConnection(this.webRTCAddress)
        } catch (errorOpeningSignalingConnection) {
            let errMsg = `Couldn't open signaling connection to \`${this.webRTCAddress.slice(0, this.webRTCAddress.indexOf("token="))}<token redacted>\`! Error:\n${errorOpeningSignalingConnection}`;
            try {
                await this.disconnectFromHiFiMixer();
            } catch (errorClosing) {
                errMsg += `\nAdditionally, there was an error trying to close the failed connection. Error:\n${errorClosing}`;
            }
            this._raviSignalingConnection.removeStateChangeHandler(tempUnavailableStateHandler);
            return Promise.reject(errMsg);
        }

        try {
            await this._raviSession.openRAVISession({ signalingConnection: this._raviSignalingConnection, params: webRTCSessionParams, customStunAndTurn: customSTUNandTURNConfig });
        } catch (errorOpeningRAVISession) {
            let errMsg = `Couldn't open RAVI session associated with \`${this.webRTCAddress.slice(0, this.webRTCAddress.indexOf("token="))}<token redacted>\`! Error:\n${errorOpeningRAVISession}`;
            if (mixerIsUnavailable) {
                errMsg = `High Fidelity server is at capacity; service is unavailable.`;
            }
            try {
                await this.disconnectFromHiFiMixer();
            } catch (errorClosing) {
                errMsg += `\nAdditionally, there was an error trying to close the connection. Error:\n${errorClosing}`;
            }
            this._raviSignalingConnection.removeStateChangeHandler(tempUnavailableStateHandler);
            return Promise.reject(errMsg);
        }

        let audionetInitResponse;
        try {
            audionetInitResponse = await this.promiseToRunAudioInit();
        } catch (initError) {
            let errMsg = `\`audionet.init\` command failed! Error:\n${initError.error}`;
            try {
                await this.disconnectFromHiFiMixer();
            } catch (errorClosing) {
                errMsg += `\nAdditionally, there was an error trying to close the failed connection. Error:\n${errorClosing}`;
            }
            this._raviSignalingConnection.removeStateChangeHandler(tempUnavailableStateHandler);
            return Promise.reject(errMsg);
        }

        this._raviSignalingConnection.removeStateChangeHandler(tempUnavailableStateHandler);

        this._raviSession.getCommandController().addBinaryHandler((data: any) => { this.handleRAVISessionBinaryData(data) }, true);

        return Promise.resolve(audionetInitResponse);
    }

    /**
     * Disconnects from the Mixer. Closes the RAVI Signaling Connection and the RAVI Session.
     * @returns A Promise that _always_ Resolves with a "success" status string.
     */
    async disconnectFromHiFiMixer(): Promise<string> {
        async function close(thingToClose: (RaviSignalingConnection | RaviSession), nameOfThingToClose: string, closedState: string) {
            if (thingToClose) {
                let state = thingToClose.getState();
                if (!thingToClose || state === closedState) {
                    HiFiLogger.log(`The RAVI ${nameOfThingToClose} was already closed.`);
                } else {
                    try {
                        if (thingToClose instanceof RaviSignalingConnection) {
                            await thingToClose.closeRAVISignalingConnection();
                        } else if (thingToClose instanceof RaviSession) {
                            await thingToClose.closeRAVISession();
                        }
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

        await close(this._raviSignalingConnection, "Signaling Connection", RaviSignalingStates.CLOSED);
        await close(this._raviSession, "Session", RaviSessionStates.CLOSED);

        this._resetMixerInfo();

        await this._setMutedByAdmin(false, MuteReason.INTERNAL);

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
     * Sets the input audio stream to "muted" by _either_:
     * 1. Calling `stop()` on all of the `MediaStreamTrack`s associated with the user's input audio stream OR
     * 2. Setting `track.enabled = false|true` on all of the tracks on the user's input audio stream (the default behavior)
     * 
     * Method 1 will work if and only if:
     * 1. The developer has set the `tryToStopMicStream` argument to this function to `true` AND
     * 2. The application code is running in the browser context (not the NodeJS context) AND
     * 3. The user's browser gives the user the ability to permanently allow a website to access the user's microphone
     *    and provides the `navigator.permissions` and `navigator.permissions.query` objects/methods.
     *    (Refer to https://developer.mozilla.org/en-US/docs/Web/API/Permissions - as of March 2021, this
     *    list does not include Safari on desktop or iOS.)
     * 
     * Reasons to use Method 1:
     * - Bluetooth Audio I/O devices will switch modes between mono out and stereo out when the user is muted,
     * which yields significantly improved audio output quality and proper audio spatialization.
     * - When the user is muted, the browser will report that their microphone is not in use, which can improve
     * user trust in the application.
     * 
     * Reasons _not_ to use Method 1:
     * - Because Method 1 requires re-obtaining an audio input stream via `getUserMedia()`, there is a small delay
     * between the moment the user un-mutes and when the user is able to be heard by other users in the Space.
     * - If a user is using a Bluetooth Audio I/O device, there is a delay between the moment the user un-mutes
     * and when a user can hear other users in a Space due to the fact that the Bluetooth audio device must
     * switch I/O profiles.
     * - Not all browsers support the `navigator.permissions` API
     * 
     * @param newMutedValue If `true`, the input audio stream will be muted. If `false`, the input stream will be unmuted.
     * @param tryToStopMicStream If `false`, this function will use Method 2 described above to mute or unmute the input audio stream. If `true`, this function will use Method 1.
     * @returns `true` if the stream was successfully muted/unmuted, `false` if it was not.
     */
    async setInputAudioMuted(newMutedValue: boolean, tryToStopMicStream: boolean = false): Promise<boolean> {
        return await this._setMuted(newMutedValue, tryToStopMicStream, MuteReason.CLIENT);
    }

    async _setMutedByAdmin(mutedByAdmin: boolean, muteReason: MuteReason): Promise<boolean> {
        // For now:
        // - Admin muting should mute the client, and prevent the client from unmuting
        // - Admin unmuting should not unmute the client, but simply allow the client to unmute
        // - When the connection ends, the client is allowed to unmute, which for now is equivalent to an admin unmute
        this._adminPreventsInputAudioUnmuting = mutedByAdmin;
        return await this._setMuted(mutedByAdmin || this._lastSuccessfulInputAudioMutedValue, false, muteReason);
    }

    async _setMuted(newMutedValue: boolean, tryToStopMicStream: boolean, muteReason: MuteReason): Promise<boolean> {
        let success = true;
        if (muteReason == MuteReason.CLIENT) {
            if (this._adminPreventsInputAudioUnmuting && !newMutedValue) {
                HiFiLogger.warn(`Couldn't set mute state: Muted by admin.`);
                success = false;
            }
        }
        if (success) {
            success = await this._trySetInputAudioMuted(newMutedValue, tryToStopMicStream);
        }
        if (success) {
            this._lastSuccessfulInputAudioMutedValue = newMutedValue;
        }

        if (this.onMuteChanged) {
            this.onMuteChanged(new MuteChangedEvent({
                success: success,
                targetInputAudioMutedValue: newMutedValue,
                currentInputAudioMutedValue: this._lastSuccessfulInputAudioMutedValue,
                adminPreventsInputAudioUnmuting: this._adminPreventsInputAudioUnmuting,
                muteReason: muteReason
            }));
        }
        return success;
    }

    async _trySetInputAudioMuted(newMutedValue: boolean, tryToStopMicStream: boolean): Promise<boolean> {
        let streamController = this._raviSession.getStreamController();
        if (this._raviSession && streamController) {
            let hasMicPermission = false;

            if (typeof (navigator) !== "undefined" && navigator.permissions && navigator.permissions.query) {
                let result: PermissionStatus;
                try {
                    result = await navigator.permissions.query({ name: 'microphone' });
                } catch { }
                if (result && result.state === "granted") {
                    hasMicPermission = true;
                }
            }

            if (!tryToStopMicStream || !hasMicPermission || typeof self === 'undefined') {
                // Developer has explicitly or implicitly set `tryToStopMicStream` to `false` OR
                // we're in the NodeJS context OR
                // the user hasn't granted or can't grant permanent mic permissions to our script...
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
     * Sets the state of the current connection, and
     * fires the onChange handler if that state has, in fact, changed.
     * @param state
     */
    _setCurrentHiFiConnectionState(state: HiFiConnectionStates): void {
        if (this._currentHiFiConnectionState !== state) {
            this._currentHiFiConnectionState = state;
            if (this.onConnectionStateChanged) {
                this.onConnectionStateChanged(this._currentHiFiConnectionState);
            }
        }
    }

    /**
     * Return the current state of the connection.
     */
    getCurrentHiFiConnectionState(): HiFiConnectionStates {
        return this._currentHiFiConnectionState;
    }

    /**
     * Fires when the RAVI Signaling State changes.
     * @param event 
     */
    async onRAVISignalingStateChanged(event: any): Promise<void> {
        HiFiLogger.log(`New RAVI signaling state: \`${event.state}\``);
        switch (event.state) {
            case RaviSignalingStates.UNAVAILABLE:
                this._setCurrentHiFiConnectionState(HiFiConnectionStates.Unavailable);
                try {
                    await this.disconnectFromHiFiMixer();
                } catch (errorClosing) {
                    HiFiLogger.log(`Error encountered while trying to close the connection. Error:\n${errorClosing}`);
                }
                break;
        }
    }

    /**
     * Fires when the RAVI Session State changes.
     * @param event
     */
    async onRAVISessionStateChanged(event: any): Promise<void> {
        HiFiLogger.log(`New RAVI session state: \`${event.state}\``);
        switch (event.state) {
            case RaviSessionStates.CONNECTED:
                this._mixerPeerKeyToStateCacheDict = {};
                this._setCurrentHiFiConnectionState(HiFiConnectionStates.Connected);
                break;
            case RaviSessionStates.DISCONNECTED:
                if (this._currentHiFiConnectionState === HiFiConnectionStates.Unavailable) {
                    break;
                }
                this._setCurrentHiFiConnectionState(HiFiConnectionStates.Disconnected);
                try {
                    await this.disconnectFromHiFiMixer();
                } catch (errorClosing) {
                    HiFiLogger.log(`Error encountered while trying to close the connection. Error:\n${errorClosing}`);
                }
                break;
            case RaviSessionStates.FAILED:
                if (this._currentHiFiConnectionState === HiFiConnectionStates.Unavailable) {
                    break;
                }
                this._setCurrentHiFiConnectionState(HiFiConnectionStates.Failed);
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
     * @param currentHifiAudioAPIData - The new user data that we want to send to the High Fidelity Audio API server.
     * @returns If this operation is successful, returns `{ success: true, stringifiedDataForMixer: <the raw data that was transmitted to the server>}`. If unsuccessful, returns
     * `{ success: false, error: <an error message> }`.
     */
    _transmitHiFiAudioAPIDataToServer(currentHifiAudioAPIData: HiFiAudioAPIData, previousHifiAudioAPIData?: HiFiAudioAPIData): any {
        if (!this.mixerInfo["connected"] || !this._raviSession) {
            return {
                success: false,
                error: `Can't transmit data to mixer; not connected to mixer.`
            };
        }

        let dataForMixer: any = {};

        // if a position is specified with valid components, let's consider adding position payload
        if (currentHifiAudioAPIData.position && (typeof (currentHifiAudioAPIData.position.x) === "number")
            && (typeof (currentHifiAudioAPIData.position.y) === "number")
            && (typeof (currentHifiAudioAPIData.position.z) === "number")) {
            // Detect the position components which have really changed compared to the previous state known from the server
            let changedComponents: { x: boolean, y: boolean, z: boolean, changed: boolean } = { x: false, y: false, z: false, changed: false };
            if (previousHifiAudioAPIData && previousHifiAudioAPIData.position) {
                if (currentHifiAudioAPIData.position.x !== previousHifiAudioAPIData.position.x) {
                    changedComponents.x = true;
                    changedComponents.changed = true;
                }
                if (currentHifiAudioAPIData.position.y !== previousHifiAudioAPIData.position.y) {
                    changedComponents.y = true;
                    changedComponents.changed = true;
                }
                if (currentHifiAudioAPIData.position.z !== previousHifiAudioAPIData.position.z) {
                    changedComponents.z = true;
                    changedComponents.changed = true;
                }
            } else {
                changedComponents.x = true;
                changedComponents.y = true;
                changedComponents.z = true;
                changedComponents.changed = true;
            }

            // Some position components have changed, let's fill in the payload
            if (changedComponents.changed) {
                let translatedPosition = currentHifiAudioAPIData.position;
                if (this._coordFrameUtil != null) {
                    // convert the received position from HiFi- to World-frame
                    translatedPosition = this._coordFrameUtil.WorldPositionToHiFi(translatedPosition);
                }

                // Position data is sent in millimeters integers to reduce JSON size.
                if (changedComponents.x) {
                    dataForMixer["x"] = Math.round(translatedPosition.x * 1000);
                }
                if (changedComponents.y) {
                    dataForMixer["y"] = Math.round(translatedPosition.y * 1000);
                }
                if (changedComponents.z) {
                    dataForMixer["z"] = Math.round(translatedPosition.z * 1000);
                }
            }
        }

        // if orientation is specified with valid components, let's consider adding orientation payload
        if (currentHifiAudioAPIData.orientationQuat && (typeof (currentHifiAudioAPIData.orientationQuat.w) === "number")
            && (typeof (currentHifiAudioAPIData.orientationQuat.x) === "number")
            && (typeof (currentHifiAudioAPIData.orientationQuat.y) === "number")
            && (typeof (currentHifiAudioAPIData.orientationQuat.z) === "number")) {
            // Detect the orientation components which have really changed compared to the previous state known from the server
            let changedComponents: { w: boolean, x: boolean, y: boolean, z: boolean, changed: boolean } = { w: false, x: false, y: false, z: false, changed: false };
            if (previousHifiAudioAPIData && previousHifiAudioAPIData.orientationQuat) {
                if (currentHifiAudioAPIData.orientationQuat.w !== previousHifiAudioAPIData.orientationQuat.w) {
                    changedComponents.w = true;
                    changedComponents.changed = true;
                }
                if (currentHifiAudioAPIData.orientationQuat.x !== previousHifiAudioAPIData.orientationQuat.x) {
                    changedComponents.x = true;
                    changedComponents.changed = true;
                }
                if (currentHifiAudioAPIData.orientationQuat.y !== previousHifiAudioAPIData.orientationQuat.y) {
                    changedComponents.y = true;
                    changedComponents.changed = true;
                }
                if (currentHifiAudioAPIData.orientationQuat.z !== previousHifiAudioAPIData.orientationQuat.z) {
                    changedComponents.z = true;
                    changedComponents.changed = true;
                }
            } else {
                changedComponents.w = true;
                changedComponents.x = true;
                changedComponents.y = true;
                changedComponents.z = true;
                changedComponents.changed = true;
            }

            // Some orientation components have changed, let's fill in the payload
            if (changedComponents.changed) {
                let translatedOrientation = currentHifiAudioAPIData.orientationQuat;
                if (this._coordFrameUtil != null) {
                    translatedOrientation = this._coordFrameUtil.WorldOrientationToHiFi(translatedOrientation);
                }

                // The mixer expects Quaternion to be mulitiplied by 1000.
                if (changedComponents.w) {
                    dataForMixer["W"] = translatedOrientation.w * 1000;
                }
                if (changedComponents.x) {
                    dataForMixer["X"] = translatedOrientation.x * 1000;
                }
                if (changedComponents.y) {
                    dataForMixer["Y"] = translatedOrientation.y * 1000;
                }
                // if (changedComponents.z) {
                // Need to send Z all the time at the moment until we merge the fix https://github.com/highfidelity/audionet-hifi/pull/271
                dataForMixer["Z"] = translatedOrientation.z * 1000;
                //}
            }
        }

        if (typeof (currentHifiAudioAPIData.volumeThreshold) === "number") {
            dataForMixer["T"] = currentHifiAudioAPIData.volumeThreshold;
        }

        if (typeof (currentHifiAudioAPIData.hiFiGain) === "number") {
            dataForMixer["g"] = Math.max(0, currentHifiAudioAPIData.hiFiGain);
        }

        if (typeof (currentHifiAudioAPIData.userAttenuation) === "number") {
            dataForMixer["a"] = currentHifiAudioAPIData.userAttenuation;
        }

        if (typeof (currentHifiAudioAPIData.userRolloff) === "number") {
            dataForMixer["r"] = Math.max(0, currentHifiAudioAPIData.userRolloff);
        }

        if (typeof(currentHifiAudioAPIData._otherUserGainQueue) == "object") {
            let changedUserGains: OtherUserGainMap = {};
            let idToGains = Object.entries(currentHifiAudioAPIData._otherUserGainQueue);
            let previousOtherUserGains = previousHifiAudioAPIData ? previousHifiAudioAPIData._otherUserGainQueue : undefined;
            for (const idToGain of idToGains) {
                let hashedVisitId = idToGain[0];
                let gain = idToGain[1];
                if (!(typeof(gain) == "number")) {
                    continue;
                }
                if (previousOtherUserGains && previousOtherUserGains[hashedVisitId] === gain) {
                    continue;
                }
                changedUserGains[hashedVisitId] = gain;
            }

            if (Object.entries(changedUserGains).length) {
                dataForMixer["V"] = changedUserGains;
            }
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
