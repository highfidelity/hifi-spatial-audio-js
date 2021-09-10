/**
 * This Module contains classes relevant to data about a user in the virtual 3D environment.
 * @packageDocumentation
 */

import { Vector3 as Point3D, Quaternion } from "../utilities/HiFiMath";

export { Point3D, Quaternion };

/**
 * Instantiations of this class define a map between hashed visit IDs and the gains of other users.
 * You can use this in {@link HiFiCommunicator.setOtherUserGainsForThisConnection} to change the gains of other users as perceived by the current connection, providing a more comfortable listening experience for the client. If you need to perform moderation actions on the server side, use the {@link https://docs.highfidelity.com/rest/latest/index.html|Administrative REST API}.
 *
 * Internally, this class is used to keep track of which other user gain changes need to be sent to the server.
 */
export type OtherUserGainMap = { [key: string]: number };

/**
 * Instantiations of this class contain all of the data that is possible to **send to AND receive from** the High Fidelity Audio API Server.
 * All member data inside this `class` can be sent to the High Fidelity Audio API Server. See below for more details.
 * 
 * See {@link ReceivedHiFiAudioAPIData} for data that can't be sent to the Server, but rather can only be received from the Server (i.e. `volumeDecibels`).
 * 
 * Member data of this class that is sent to the Server will affect the final mixed spatial audio for all listeners in the server's virtual space.
 */
export class HiFiAudioAPIData {
    /**
     * If you don't supply a `position` when constructing instantiations of this class, `position` will be `null`.
     * 
     * ✔ The client sends `position` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `position` data to all clients connected to a server during "peer updates".
     */
    position: Point3D;
    /**
     * If you don't supply an `orientation` when constructing instantiations of this class, `orientation` will be `null`.
     * 
     * ✔ The client sends `orientation` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `orientation` data to all clients connected to a server during "peer updates".
     */
    orientation: Quaternion;
    /**
     * A volume level below this value is considered background noise and will be smoothly gated off.
     * The floating point value is specified in dBFS (decibels relative to full scale) with values between -96 dB (indicating no gating)
     * and 0 dB (effectively muting the input from this user). It is in the same decibel units as the VolumeDecibels component of UserDataSubscription.
     * Setting this value to `NaN` or `null` will cause the volume threshold from the space to be used instead.
     * 
     * **COMPATIBILITY WARNING:** In the future, the High Fidelity Audio API server will only fall back to the space volume threshold
     * if the threshold is `NaN`.
     *
     * If you don't supply a `volumeThreshold` when constructing instantiations of this class, the previous value of `volumeThreshold` will
     * be used. If `volumeThreshold` has never been supplied, the volume threshold of the space will be used instead.
     */
    volumeThreshold: number;
    /**
     * This value affects how loud User A will sound to User B at a given distance in 3D space.
     * This value also affects the distance at which User A can be heard in 3D space.
     * Higher values for User A means that User A will sound louder to other users around User A, and it also means that User A will be audible from a greater distance.
     * If you don't supply an `hiFiGain` when constructing instantiations of this class, `hiFiGain` will be `null`.
     * 
     * ✔ The client sends `hiFiGain` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ❌ The server does not send `hiFiGain` data to all clients as part of "peer updates".
     */
    hiFiGain: number;
    /**
     * This value affects how far a user's sound will travel in 3D space, without affecting the user's loudness.
     * By default, there is a global attenuation value (set for a given space) that applies to all users in a space. This default space
     * attenuation is usually 0.5, which represents a reasonable approximation of a real-world fall-off in sound over distance.
     * 
     * When setting this value for an individual user, the following holds:
     *   - A value of `NaN` or 0 causes the user to inherit the global attenuation for a space, or, if zones are defined for the space,
     * the attenuation settings at the user's position. **COMPATIBILITY WARNING:** In the future, the High Fidelity Audio API server
     * will only fall back to the space/zone attenuation if the user attenuation is `NaN`.
     *   - Positive numbers between 0 and 1 (excluding 0) represent logarithmic attenuation. This range is recommended, as it is
     * more natural sounding.  Smaller numbers represent less attenuation, so a number such as 0.2 can be used to make a particular 
     * user's audio travel farther than other users', for instance in "amplified" concert type settings. A number such as 0.02 will
     * make the user's audio travel even farther.
     *  - A value of near 0, such as 0.001, will greatly reduce attenuation for a given user, resulting effectively in a "broadcast mode" where the user can be
     * heard throughout the entire space regardless of their location relative to other users.
     *   - Negative attenuation numbers are used to represent linear attenuation, and are a somewhat artificial, non-real-world concept. However,
     * this setting can be used as a blunt tool to easily test attenuation, and tune it aggressively in extreme circumstances. When using linear 
     * attenuation, the setting is the distance in meters at which the audio becomes totally inaudible.
     *
     * If you don't supply a `userAttenuation` when constructing instantiations of this class, the previous value of `userAttenuation` will
     * be used. If `userAttenuation` has never been supplied, the attenuation of the space will be used instead.
     * 
     * ✔ The client sends `userAttenuation` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ❌ The server never sends `userAttenuation` data.
     */
    userAttenuation: number;
    /**
     * @param userRolloff This value represents the progressive high frequency roll-off in meters, a measure of how the higher frequencies 
     * in a user's sound are dampened as the user gets further away. By default, there is a global roll-off value (set for a given space), currently 16 
     * meters, which applies to all users in a space. This value represents the distance for a 1kHz rolloff. Values in the range of 
     * 12 to 32 meters provide a more "enclosed" sound, in which high frequencies tend to be dampened over distance as they are 
     * in the real world. Generally changes to roll-off values should be made for the entire space rather than for individual users, but
     * extremely high values (e.g. 99999) should be used in combination with "broadcast mode"-style userAttenuation settings to cause the
     * broadcasted voice to sound crisp and "up close" even at very large distances.
     *
     * A `userRolloff` of `NaN` or 0 will cause the user to inherit the global frequency rolloff for the space, or, if zones are defined
     * for the space, the frequency rolloff settings at the user's position.
     * 
     * **COMPATIBILITY WARNING:** In the future, the High Fidelity Audio API server will only fall back to the space/zone rolloff
     * if the user rolloff is `NaN`.
     *
     * If you don't supply a `userRolloff` when constructing instantiations of this class, the previous value of `userRolloff` will
     * be used. If `userRolloff` has never been supplied, the frequency rolloff of the space will be used instead.
     * 
     * ✔ The client sends `userRolloff` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ❌ The server never sends `userRolloff` data.
     */
    userRolloff: number;

    /*
     * This is an internal class and it is not recommended for normal usage of the API.
     *
     * See instead {@link HiFiCommunicator.setOtherUserGainsForThisConnection}, which allows you to set the desired gains for one or more users as perceived by this client only. If you need to perform moderation actions on the server side, use the {@link https://docs.highfidelity.com/rest/latest/index.html|Administrative REST API}.
     *
     * Internally, this variable is used to keep track of which other user gain changes need to be sent to the server. The keys are hashed visit IDs, and the values are gains.
     */
    /** @internal */
    _otherUserGainQueue: OtherUserGainMap;
    
    constructor({ position = null, orientation = null, volumeThreshold = null, hiFiGain = null, userAttenuation = null, userRolloff = null }: { position?: Point3D, orientation?: Quaternion, volumeThreshold?: number, hiFiGain?: number, userAttenuation?: number, userRolloff?: number } = {}) {
        this.position = position;
        this.orientation = orientation;
        this.volumeThreshold = volumeThreshold;
        this.hiFiGain = hiFiGain;
        this.userAttenuation = userAttenuation;
        this.userRolloff = userRolloff;
        this._otherUserGainQueue = {};
    }
}

/**
 * Instantiations of this class contain all of the data that is possible to **receive from** the High Fidelity Audio API Server.
 * See below for more details.
 * 
 * See {@link HiFiAudioAPIData} for data that can both be sent to and received from the Server (i.e. `position`).
 */
export class ReceivedHiFiAudioAPIData extends HiFiAudioAPIData {
    /**
     * This User ID is an arbitrary string provided by an application developer which can be used to identify the user associated with a client.
     * We recommend that this `providedUserID` is unique across all users, but the High Fidelity API will not enforce uniqueness across clients for this value.
     */
    providedUserID: string;
    /**
     * This string is a hashed version of the random UUID that is generated automatically.
     * 
     * A connecting client sends this value as the `session` key inside the argument to the `audionet.init` command.
     * 
     * It is used to identify a given client across a cloud of mixers and is guaranteed ("guaranteed" given the context of random UUIDS) to be unique.
     * Application developers should not need to interact with or make use of this value, unless they want to use it internally for tracking or other purposes.
     * 
     * This value cannot be set by the application developer.
     */
    hashedVisitID: string;
    /**
     * The current volume of the user in decibels.
     * 
     * ❌ The client never sends `volumeDecibels` data to the server.
     * 
     * ✔ The server sends `volumeDecibels` data to all clients connected to a server during "peer updates".
     */
    volumeDecibels: number;

    /**
     * Indicates that the peer is providing stereo audio.
     *
     * The server sends `isStereo` data to all clients connected to a server during "peer updates".
     */
    isStereo: boolean;
    
    constructor(params: { providedUserID?: string, hashedVisitID?: string, volumeDecibels?: number, position?: Point3D, orientation?: Quaternion, isStereo?: boolean } = {}) {
        super(params);
        this.providedUserID = params.providedUserID;
        this.hashedVisitID = params.hashedVisitID;
        this.volumeDecibels = params.volumeDecibels;
        this.isStereo = params.isStereo;
    }
}
