/**
 * Code in this module is used internally by the [[HiFiCommunicator]] object to manage the connection between client and server.
 * Developers do not need to and should not consider this module when writing their applications.
 * @packageDocumentation
 */

import { HiFiAudioAPIData, OrientationQuat3D, Point3D, ReceivedHiFiAudioAPIData, OtherUserGainMap } from "./HiFiAudioAPIData";
import { HiFiCoordinateFrameUtil } from "../utilities/HiFiCoordinateFrameUtil"; 
import { HiFiLogger } from "../utilities/HiFiLogger";
import { HiFiConnectionStates, HiFiUserDataStreamingScopes, HiFiConnectionAttemptResult } from "./HiFiCommunicator";

import { RaviUtils } from "../libravi/RaviUtils";
import { RaviSession, RaviSessionStates, WebRTCSessionParams, CustomSTUNandTURNConfig } from "../libravi/RaviSession";
import { RaviSignalingConnection, RaviSignalingStates } from "../libravi/RaviSignalingConnection";
import { Diagnostics } from "../diagnostics/diagnostics";
import pako from 'pako'

const isBrowser = typeof window !== 'undefined';
// Since we're initializing a MediaStream, we need to
// do it using the correct cross-platform class (node or browser)
let xMediaStream = isBrowser && window.MediaStream;
if (!isBrowser) {
    try {
        xMediaStream = require('wrtc').MediaStream;
    } catch (e) {
        ; // Remains falsey. Don't report, don't log
    }
}

const INIT_TIMEOUT_MS = 5000;
const PERSONAL_VOLUME_ADJUST_TIMEOUT_MS = 5000;

type ConnectionStateChangeHandler = (state: HiFiConnectionStates, result: HiFiConnectionAttemptResult) => void;

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
     * And since we are caching that one value, we are also caching the full state for all known peers.
     * This allows us to optimize the received stream of changed data for a given peer from the server to just the necessary bits
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
     * A MediaStream that persists across reconnection attempts; we add the
     * actual output tracks to this when the RAVI session connects.
     */
    private _outputAudioMediaStream: MediaStream;

    /**
     * Only valid for users covered by a user data subscription. Remains constant at disconnect until the next connect.
     */
    public concurrency:number = 0;

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
     */
    onConnectionStateChanged: ConnectionStateChangeHandler;

    /**
     * If the World coordinate system is NOT compatible with the HiFi coordindate frame used by the mixer
     * then configure a HiFiCoordinateFrameUtil to transform to and from HiFi-frame.
     *
     * The World-frame is compatible iff:
     * (1) It is right-handed
     * (2) It uses the Y-axis (positive or negative, doesn't matter) for the UP direction.
     *
     * For all other cases create a HiFiCoordinateFrameUtil.
     *
     */
    _coordFrameUtil: HiFiCoordinateFrameUtil;

    /**
     * Contains information about the mixer to which we are currently connected.
     */
    mixerInfo: any;

    /**
     * Track whether or not we're in the process of attempting to connect. (This is
     * a little bit hacky, but given the maze of twisty callbacks and Promises, it
     * seems the most sane way to avoid double-connecting.) The HiFiCommunicator
     * does set its meta-state to "Connecting" or "Reconnecting" when we're in the
     * larger overall "trying to connect" process, but that's true the entire time
     * when we're generally connecting, retrying, waiting for a retry, etc.
     * This boolean is `true` ONLY if this particular HiFiMixerSession is actively
     * in the process of trying to connect.
     */
    _tryingToConnect: boolean;
    
    /**
     * Don't attempt a reconnect if kicked or the space is shut down.  This value is
     * used internally and may change depending on server activity.
     */
    _disableReconnect: boolean;

    /**
     * Used for diagnostics
     */
    private _getUserFacingConnectionState: Function;
    private _raviDiagnostics: Diagnostics;
    private _hifiDiagnostics: Diagnostics;

    /**
     * 
     * @param __namedParameters
     * @param userDataStreamingScope - See {@link HiFiUserDataStreamingScopes}.
     * 
     * If set to `false`, User Data Subscriptions will serve no purpose.
     * @param onUserDataUpdated - The function to call when the server sends user data to the client. Irrelevant if `userDataStreamingScope` is `HiFiUserDataStreamingScopes.None`.
     * @param onUsersDisconnected - The function to call when the server sends user data about peers who just disconnected to the client.
     * @param onConnectionStateChanged - The function to call when the connection state of the HiFiMixerSession changes. (In practice, this is always the HiFiCommunicator's
     * `_manageConnection` method, which does the heavy lifting).
     * @param onMuteChanged - The function to call when the server sends a "mute" message to the client
     * @param getUserFacingConnectionState - The function to call (specifically this is a function on the HiFiCommunicator object that's using this HiFiMixerSession)
     * that will allow access to the connection state as seen by the user (i.e. the "meta-state" that gets tracked by the HiFiCommunicator). TODO: This is
     * here only because the diagnostics code (which only has a reference to the MixerSesssion) needs access to that "user-facing state" (and this class's
     * `_onConnectionStateChange` needs to examine it to decide when to call the diagnostics code), NOT because this class actually has a need for it.
     * (The `_onConnectionStateChange` method can just blindly call the passed change handler if it wants to, without checking for a "real" change.)
     * So, if/when we remove diagnostics code (or if we want to approach this some other way) we could get rid of the `getUserFacingConnectionState`
     * parameter without affecting the functionality at all.
     */
    constructor({
        userDataStreamingScope = HiFiUserDataStreamingScopes.All,
        onUserDataUpdated,
        onUsersDisconnected,
        onConnectionStateChanged,
        onMuteChanged,
        getUserFacingConnectionState,
        coordFrameUtil
    }: {
        userDataStreamingScope?: HiFiUserDataStreamingScopes,
        onUserDataUpdated?: Function,
        onUsersDisconnected?: Function,
        onConnectionStateChanged?: ConnectionStateChangeHandler,
        onMuteChanged?: OnMuteChangedCallback,
        getUserFacingConnectionState?: Function
        coordFrameUtil?: HiFiCoordinateFrameUtil
    }) {
        this.webRTCAddress = undefined;
        this.userDataStreamingScope = userDataStreamingScope;
        this.onUserDataUpdated = onUserDataUpdated;
        this.onUsersDisconnected = onUsersDisconnected;
        this._mixerPeerKeyToStateCacheDict = {};
        this._lastSuccessfulInputAudioMutedValue = false;
        this.onMuteChanged = onMuteChanged;
        this._getUserFacingConnectionState = getUserFacingConnectionState;
        this._disableReconnect = false;
        this._coordFrameUtil = coordFrameUtil;

        RaviUtils.setDebug(false);

        this._raviSignalingConnection = new RaviSignalingConnection();
        this._raviSession = new RaviSession();
        this._raviSession.getCommandController().addBinaryHandler((data: any) => {
            this.handleRAVISessionBinaryData(data)
        }, true);

        this.onConnectionStateChanged = onConnectionStateChanged;

        // Create an empty output media stream that will persist across reconnects
        this._outputAudioMediaStream = new xMediaStream();

        this._tryingToConnect = false;
        this._resetMixerInfo();
        this._raviDiagnostics = new Diagnostics({label: 'ravi', session: this, ravi: this._raviSession});
        this._hifiDiagnostics = new Diagnostics({label: 'app', session: this, ravi: this._raviSession,
                                                 // The first is the standard way to tell, but browser have bugs in which they don't fire.
                                                 // The second is enough for all known browser bugs, except for Safari desktop closing a visible tab.
                                                 fireOn: ['visibilitychange', 'pagehide', 'beforeunload']});
    }

    /**
     * Sends the command `audionet.init` to the mixer.
     * 
     * @returns If this operation is successful, the Promise will resolve with `{ success: true, audionetInitResponse: <The response to `audionet.init` from the server in Object format>}`.
     * If unsuccessful, the Promise will reject with `{ success: false, error: <an error message> }`.
     */
    async promiseToRunAudioInit(currentHifiAudioAPIData? : HiFiAudioAPIData): Promise<HiFiConnectionAttemptResult> {
        return new Promise((resolve, reject) => {
            let initData = {
                primary: true,
                // The mixer will hash this randomly-generated UUID, then disseminate it to all clients via `peerData.e`.
                visit_id: this._raviSession.getUUID(),
                session: this._raviSession.getUUID(), // Still required for old mixers. Will eventually go away.
                streaming_scope: this.userDataStreamingScope,
                is_input_stream_stereo: this._inputAudioMediaStreamIsStereo
            };

            if (currentHifiAudioAPIData) {
                let initialDataToSend = this._getDataToTransmitToMixer(currentHifiAudioAPIData);
                initData = { ...initData, ...initialDataToSend };
            }

            let commandController = this._raviSession.getCommandController();
            if (!commandController) {
                return reject({
                    success: false,
                    error: `Couldn't connect to mixer: no \`commandController\`!`
                });
            }

            let initTimeout = setTimeout(async () => {
                let errMsg = `Couldn't connect to mixer: Call to \`init\` timed out!`
                return reject({
                    success: false,
                    error: errMsg,
                    disableReconnect: this._disableReconnect
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
                    return resolve({
                        success: true,
                        audionetInitResponse: parsedResponse,
                        disableReconnect: this._disableReconnect
                    });
                } catch (e) {
                    return reject({
                        success: false,
                        error: `Couldn't parse init response! Parse error:\n${e}`,
                        disableReconnect: this._disableReconnect
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
                        // TODO: remove the entry from the peer state cache -- is this OK?
                        //delete this._mixerPeerKeyToStateCacheDict[mixerPeerKey];
                        break;
                    }
                }

                allDeletedUserData.push(deletedUserData);
            }

            // TODO: remove the entry from the peer state cache
            this.concurrency -= allDeletedUserData.length;
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
                // If it is a known peer, we should have an entry for it in the cache dict
                if (this._mixerPeerKeyToStateCacheDict[peerKeys[itr]]) {
                    userDataCache = this._mixerPeerKeyToStateCacheDict[peerKeys[itr]] as ReceivedHiFiAudioAPIData;
                }
                // if not let's create it.
                else {
                    userDataCache = new ReceivedHiFiAudioAPIData();
                    this._mixerPeerKeyToStateCacheDict[peerKeys[itr]] = userDataCache;
                    this.concurrency += 1;
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
                } else if (instructionName === "terminate") {
                    // all reasons for termination currently should result in a disconnect
                    // so that the client doesn't try to automatically reconnect.  Reasons
                    // will be either kick or user timeout.
                    this._disableReconnect = true;
                    this._disconnectFromHiFiMixer();
                }
            }
        }
    }

    /**
     * Connect to the Mixer given `this.webRTCAddress`.
     * 
     * @param __namedParameters
     * @param webRTCSessionParams - Parameters passed to the RAVI session when opening that session.
     * @returns void. Use the callback function to get information about errors upon failure, or the response from `audionet.init` when successful
     */
    connectToHiFiMixer({ webRTCSessionParams, customSTUNandTURNConfig, timeout, initData }: { webRTCSessionParams?: WebRTCSessionParams, customSTUNandTURNConfig?: CustomSTUNandTURNConfig, timeout?: number, initData?: HiFiAudioAPIData }): void {

        if (this._tryingToConnect) {
            HiFiLogger.warn("`HiFiMixerSession.connectToHiFiMixer()` was called, but is already in the process of connecting. No action will be taken.");
            return;
        }

        if (this.mixerInfo["connected"]) {
            let msg = `Already connected! If a reconnect is needed, please hang up and try again.`;
            this._onConnectionStateChange(HiFiConnectionStates.Connected, { success: true, error: msg, disableReconnect: this._disableReconnect });
            return;
        }

        if (!this.webRTCAddress) {
            let errMsg = `Couldn't connect: \`this.webRTCAddress\` is falsey!`;
            // this._onConnectionStateChange will attempt a clean-up disconnect for us
            this._onConnectionStateChange(HiFiConnectionStates.Failed, { success: false, error: errMsg, disableReconnect: this._disableReconnect });
            return;
        }

        let mixerIsUnavailable = false;
        const tempUnavailableStateHandler = (event: any) => {
            if (event && event.state === RaviSignalingStates.UNAVAILABLE) {
                mixerIsUnavailable = true;
                let message = `High Fidelity server is at capacity; service is unavailable.`;
                this._onConnectionStateChange(HiFiConnectionStates.Unavailable, { success: false, error: message, disableReconnect: this._disableReconnect });
                this._raviSignalingConnection.removeStateChangeHandler(tempUnavailableStateHandler);
                this._raviSession.closeRAVISession();
            }
        }
        this._raviSignalingConnection.addStateChangeHandler(tempUnavailableStateHandler);

        // Because we manually handle the state changes in the Promise chain, we need
        // to make sure the main change handlers aren't ALSO trying to handle 'em
        this._raviSignalingConnection.removeStateChangeHandler(this.onRAVISignalingStateChanged);
        this._raviSession.removeStateChangeHandler(this.onRAVISessionStateChanged);

        // This `Promise.resolve()` is just here for formatting and reading sanity
        // for the below Promise chain.
        this._tryingToConnect = true;
        Promise.resolve()
        .then(() => {
            HiFiLogger.log(`Opening signaling connection`);
            return this._raviSignalingConnection.openRAVISignalingConnection(this.webRTCAddress)
            .catch((errorOpeningSignalingConnection) => {
                let errMsg = `Couldn't open signaling connection to \`${this.webRTCAddress.slice(0, this.webRTCAddress.indexOf("token="))}<token redacted>\`! Error:\n${RaviUtils.safelyPrintable(errorOpeningSignalingConnection)}`;
                throw(errMsg);
            });
        })
        .then((value) => {
            HiFiLogger.log(`Signaling connection open; starting RAVI session`);
            return this._raviSession.openRAVISession({ signalingConnection: this._raviSignalingConnection, timeout: timeout, params: webRTCSessionParams, customStunAndTurn: customSTUNandTURNConfig })
            .catch((errorOpeningRAVISession) => {
                let errMsg = `Couldn't open RAVI session associated with \`${this.webRTCAddress.slice(0, this.webRTCAddress.indexOf("token="))}<token redacted>\`! Error:\n${RaviUtils.safelyPrintable(errorOpeningRAVISession)}`;
                if (mixerIsUnavailable) {
                    errMsg = `High Fidelity server is at capacity; service is unavailable.`;
                    this._onConnectionStateChange(HiFiConnectionStates.Unavailable, { success: false, error: errMsg, disableReconnect: this._disableReconnect });
                }
                throw(errMsg);
            });
        })
        .then((value) => {
            HiFiLogger.log(`Session open; running audionet.init`);
            return this.promiseToRunAudioInit(initData)
            .catch((errorRunningAudionetInit) => {
                let errMsg = `Connected, but was then unable to communicate the \`audionet.init\` message to the server. Error:\n${RaviUtils.safelyPrintable(errorRunningAudionetInit)}`;
                throw(errMsg);
            });
        })
        .then((value) => {
            HiFiLogger.log(`audionet.init run; calling state change handler for connected`);
            this._onConnectionStateChange(HiFiConnectionStates.Connected, value);
        })
        .then((value) => {
            // We're done with the connection process and can now set the state change handlers
            // on the core RAVI objects. (Before this point -- i.e. in the Promise chain -- we
            // were handling these state changes ourselves by following the thens/catches on the
            // promises).
            this._raviSignalingConnection.addStateChangeHandler(this.onRAVISignalingStateChanged);
            this._raviSession.addStateChangeHandler(this.onRAVISessionStateChanged);
        })
        .catch((error) => {
            // No matter what happens up there, we want to go to a failed state
            // and pass along the error message. `this._onConnectionStateChange`
            // will disconnect and clean up for us.
            this._onConnectionStateChange(HiFiConnectionStates.Failed, { success: false, error: error, disableReconnect: this._disableReconnect });
        })
        .finally(() => {
            this._raviSignalingConnection.removeStateChangeHandler(tempUnavailableStateHandler);
            this.concurrency = 0;
            this._tryingToConnect = false;
        });

    }

    /**
     * Disconnects from the Mixer. Closes the RAVI Signaling Connection and the RAVI Session.
     * @returns A Promise that _always_ Resolves with a "success" status string.
     */
    async disconnectFromHiFiMixer(): Promise<string> {
        this._raviDiagnostics.noteExplicitApplicationClose();
        this._hifiDiagnostics.noteExplicitApplicationClose();
        return this._disconnectFromHiFiMixer();
    }
    async _disconnectFromHiFiMixer(): Promise<string> {
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
                        HiFiLogger.warn(`The RAVI ${nameOfThingToClose} didn't close successfully from state ${state}! Error:\n${RaviUtils.safelyPrintable(e)}`);
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

        this._onConnectionStateChange(HiFiConnectionStates.Disconnected, { success: true, error: "Successfully disconnected", disableReconnect: this._disableReconnect });

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
                        let errMsg = `Attempt to call \`audionet.init\` for change in stereo status failed! Error:\n${RaviUtils.safelyPrintable(initError.error)}`;
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
        return this._outputAudioMediaStream;
    }
    /**
     * Examines the underlying connection objects to determine
     * whether or not we believe the connection to be, well,
     * connected.
     */
    isConnected(): boolean {
        return this._raviSession.getState() === RaviSessionStates.CONNECTED &&
               this._raviSignalingConnection.getState() === RaviSignalingStates.OPEN;
    }

    /**
     * Return the current state of the connection.
     */
    getCurrentHiFiConnectionState(): HiFiConnectionStates {
        if (this._getUserFacingConnectionState) {
            return this._getUserFacingConnectionState();
        } else {
            return undefined;
        }
    }

    /**
     * Fire the onChange handler for a state operation
     * @param state
     */
    async _onConnectionStateChange(state: HiFiConnectionStates, result: HiFiConnectionAttemptResult): Promise<void> {
        if (this.getCurrentHiFiConnectionState() !== state) {
            if (this.onConnectionStateChanged) {
                this.onConnectionStateChanged(state, result);
            }
            if (state === HiFiConnectionStates.Connected) {
                this._raviDiagnostics.prime(this.mixerInfo.visit_id_hash);
                this._hifiDiagnostics.prime(this.mixerInfo.visit_id_hash);
                this._copyAudioTracksFromRavi();
            } else {
                this._hifiDiagnostics.fire();
            }
        }

        if (state === HiFiConnectionStates.Failed) {
            try {
                await this.disconnectFromHiFiMixer();
            } catch (errorClosing) {
                HiFiLogger.log(`Error encountered while trying to close the connection. Error:\n${RaviUtils.safelyPrintable(errorClosing)}`);
            }
        }
    }

    /**
     * Fires when the RAVI Signaling State changes.
     * @param event 
     */
    onRAVISignalingStateChanged = (async function(event: any) : Promise<void> {
        HiFiLogger.log(`New RAVI signaling state: \`${event.state}\``);
        switch (event.state) {
            case RaviSignalingStates.UNAVAILABLE:
                this._disableReconnect = true;
                this._onConnectionStateChange(HiFiConnectionStates.Unavailable, { success: false, error: `High Fidelity server is at capacity; service is unavailable.`, disableReconnect: this._disableReconnect });
                try {
                    await this._disconnectFromHiFiMixer();
                } catch (errorClosing) {
                    HiFiLogger.log(`Error encountered while trying to close the connection. Error:\n${RaviUtils.safelyPrintable(errorClosing)}`);
                }
                break;
        }
    }).bind(this);

    /**
     * This method is meant to be called once the connection state reaches "Connected".
     * It removes any existing tracks from the persistent `this._outputAudioMediaStream`
     * and replaces them with the tracks that are currently on the RAVI stream controller.
     */
    _copyAudioTracksFromRavi() {
        let currentAudioTracks = this._outputAudioMediaStream.getAudioTracks();
        let raviAudioTracks = undefined;
        let streamController = this._raviSession.getStreamController();

        if (streamController && streamController.getAudioStream()) {
            raviAudioTracks = streamController.getAudioStream().getAudioTracks();
        }

        if (raviAudioTracks) {
            HiFiLogger.log(`Resetting this._outputAudioMediaStream tracks to the current RAVI audio tracks.`);
            currentAudioTracks.forEach(f => this._outputAudioMediaStream.removeTrack(f));
            raviAudioTracks.forEach(f => this._outputAudioMediaStream.addTrack(f));
        }
    }
    /**
     * Fires when the RAVI Session State changes.
     * @param event
     */
    onRAVISessionStateChanged = (async function(event:any) : Promise<void> {
        HiFiLogger.log(`New RAVI session state: \`${event.state}\``);
        let message = undefined;
        this._raviDiagnostics.fire();
        switch (event.state) {
            case RaviSessionStates.CONNECTED:
                HiFiLogger.log(`RaviSession connected; waiting for results of audionet.init`);
                this._copyAudioTracksFromRavi();
                break;
            case RaviSessionStates.CLOSED:
                message = "RaviSession has been closed; connection to High Fidelity servers has been disconnected";
                this._onConnectionStateChange(HiFiConnectionStates.Disconnected, { success: true, error: message, disableReconnect: this._disableReconnect });
                break;
            case RaviSessionStates.DISCONNECTED:
            case RaviSessionStates.FAILED:
                message = "RaviSession has disconnected unexpectedly";
                this._onConnectionStateChange(HiFiConnectionStates.Failed, { success: false, error: message, disableReconnect: this._disableReconnect });
                try {
                    await this._disconnectFromHiFiMixer();
                } catch (errorClosing) {
                    HiFiLogger.log(`Error encountered while trying to close the connection. Error:\n${RaviUtils.safelyPrintable(errorClosing)}`);
                }
                break;
        }
    }).bind(this);

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
     * This method converts the HiFiAudioAPIData structure into the format needed by the mixer.
     */
    _getDataToTransmitToMixer(currentHifiAudioAPIData: HiFiAudioAPIData, previousHifiAudioAPIData?: HiFiAudioAPIData): any {
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

        if (typeof (currentHifiAudioAPIData.volumeThreshold) === "number" ||
            currentHifiAudioAPIData.volumeThreshold === null) {
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
        return dataForMixer;
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

        let dataForMixer = this._getDataToTransmitToMixer(currentHifiAudioAPIData, previousHifiAudioAPIData);

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
        this._mixerPeerKeyToStateCacheDict = {};
    }
}
