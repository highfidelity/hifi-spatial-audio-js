/**
 * This Module contains classes relevant to data about a user in the virtual 3D environment.
 * @packageDocumentation
 */

import { recursivelyDiffObjects } from "../utilities/HiFiUtilities";

/**
 * Instantiations of this class define a position in 3D space. The position of a user affects the way the mixed spatial
 * audio is heard by the user.
 */
export class Point3D {
    /**
     * By default, +x is to the right and -x is to the left. Units for this member variable are **meters**.
     */
    x: number;
    /**
     * By default, +y is into the screen and -y is out of the screen towards the user. Units for this member variable are **meters**.
     */
    y: number;
    /**
     * By default, +z is up and -z is down. Units for this member variable are **meters**.
     */
    z: number;

    /**
     * Construct a new `Point3D` object. All parameters are optional. Unset parameters will be set to `null`. Remember, all units for member variables are `meters`.
     */
    constructor({ x = null, y = null, z = null }: { x?: number, y?: number, z?: number } = {}) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

/**
 * Instantiations of this class define an orientation in 3D space. A user's orientation in 3D space
 * affects the way the mixed spatial audio is heard by the user. Additionally, orientation affects the way
 * a user's audio input propagates through a space: speakers facing directly towards a listener will sound louder than
 * speakers facing away from a listener. By default, the axis configuration is set up to be right-handed.
 */
export class OrientationEuler3D {
    /**
     * Consider an aircraft: "Pitch" is defined as "nose up/down about the axis running from wing to wing".
     * **Negative pitch** means that the aircraft moves its nose **closer to the ground**.
     * **Positive pitch** means that the aircraft moves its nose **away from the ground**.
     * Units here are degrees.
     */
    pitchDegrees: number;
    /**
     * Consider an aircraft: "Yaw" is defined as "nose left/right about the axis running up and down".
     * **Negative yaw** means that the aircraft will rotate **clockwise** when viewing the aircraft from above.
     * **Positive yaw** means that the aircraft will rotate **counter-clockwise** when viewing the aircraft from above.
     * Units here are degrees.
     */
    yawDegrees: number;
    /**
     * Consider an aircraft: "Roll" is defined as "rotation about the axis running from nose to tail".
     * **Positive roll** means that the aircraft's **right wing will move closer to the ground**.
     * **Negative roll** means that the aircraft's **left wing will move closer to the ground**.
     * Units here are degrees.
     */
    rollDegrees: number;

    /**
     * Construct a new `OrientationEuler3D` object. All parameters are optional. Unset parameters will be set to `0`. Remember, all units for member variables are `degrees`.
     */
    constructor({ pitchDegrees = 0, yawDegrees = 0, rollDegrees = 0 }: { pitchDegrees?: number, yawDegrees?: number, rollDegrees?: number } = {}) {
        this.pitchDegrees = pitchDegrees;
        this.yawDegrees = yawDegrees;
        this.rollDegrees = rollDegrees;
    }
}

/**
 * Instantiations of this class define an orientation in 3D space in Quaternion format. A user's orientation in 3D space
 * affects the way the mixed spatial audio is heard by the user. Additionally, orientation affects the way
 * a user's audio input propagates through a space: speakers facing directly towards a listener will sound louder than
 * speakers facing away from a listener.
 */
export class OrientationQuat3D {
    w: number;
    x: number;
    y: number;
    z: number

    /**
     * Construct a new `OrientationQuat3D` object. All parameters are required.
     */
    constructor({ w = 1, x = 0, y = 0, z = 0 }: { w?: number, x?: number, y?: number, z?: number } = {}) {
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

/**
 * Instantiations of this class contain all of the data that is possible to **send to AND receive from** the High Fidelity Audio API Server.
 * All member data inside this `class` can be sent to the High Fidelity Audio API Server. See below for more details.
 * 
 * See {@link ReceivedHiFiAudioAPIData} for data that can't be sent to the Server, but rather can only be received from the Server (i.e. `volumeDecibels`).
 * 
 * Member data of this class that is sent to the Server will affect the final mixed spatial audio for all listeners in the server's virtual space.
 */
export class HiFiAudioAPIData {
    position: Point3D;
    orientationEuler: OrientationEuler3D;
    orientationQuat: OrientationQuat3D;
    hiFiGain: number;
    userAttenuation: number;
    userRolloff: number;

    /**
     * 
     * @param __namedParameters
     * @param position If you don't supply a `position` when constructing instantiations of this class, `position` will be `null`.
     * 
     * ✔ The client sends `position` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `position` data to all clients connected to a server during "peer updates".
     * @param orientationEuler If you don't supply an `orientationEuler` when constructing instantiations of this class, `orientationEuler` will be `null`.
     * 
     * ✔ The client sends `orientationEuler` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `orientationEuler` data to all clients connected to a server during "peer updates".
     * @param orientationQuat If you don't supply an `orientationQuat` when constructing instantiations of this class, `orientationQuat` will be `null`.
     * 
     * ✔ The client sends `orientationQuat` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `orientationQuat` data to all clients connected to a server during "peer updates".

     * @param hiFiGain This value affects how loud User A will sound to User B at a given distance in 3D space.
     * This value also affects the distance at which User A can be heard in 3D space.
     * Higher values for User A means that User A will sound louder to other users around User A, and it also means that User A will be audible from a greater distance.
     * If you don't supply an `hiFiGain` when constructing instantiations of this class, `hiFiGain` will be `null`.
     * 
     * ✔ The client sends `hiFiGain` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `hiFiGain` data to all clients connected to a server during "peer updates".

     * @param userAttenuation This value affects how far a user's sound will travel in 3D space, without affecting the user's loudness.
     * By default, there is a global attenuation value (set for a given space) that applies to all users in a space. This default space
     * attenuation is usually 0.5, which represents a reasonable approximation of a real-world fall-off in sound over distance.
     * Lower numbers represent less attenuation (i.e. sound travels farther); higher numbers represent more attenuation (i.e. sound drops
     * off more quickly).
     * 
     * When setting this value for an individual user, the following holds:
     *   - Positive numbers should be between 0 and 1, and they represent a logarithmic attenuation. This range is recommended, as it is
     * more natural sounding.  Smaller numbers represent less attenuation, so a number such as 0.2 can be used to make a particular 
     * user's audio travel farther than other users', for instance in "amplified" concert type settings. Similarly, an extremely 
     * small non-zero number (e.g. 0.00001) can be used to effectively turn off attenuation for a given user within a reasonably 
     * sized space, resulting in a "broadcast mode" where the user can be heard throughout most of the space regardless of their location
     * relative to other users. (Note: The actual value "0" is used internally to represent the default; for setting minimal attenuation, 
     * small non-zero numbers should be used instead. See also "userRolloff" below.)
     *   - Negative attenuation numbers are used to represent linear attenuation, and are a somewhat artificial, non-real-world concept. However,
     * this setting can be used as a blunt tool to easily test attenuation, and tune it aggressively in extreme circumstances. When using linear 
     * attenuation, the setting is the distance in meters at which the audio becomes totally inaudible.
     *
     * If you don't supply an `userAttenuation` when constructing instantiations of this class, `userAttenuation` will be `null` and the
     * default will be used.
     * 
     * ✔ The client sends `userAttenuation` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ❌ The server never sends `userAttenuation` data.
     *
     * @param userRolloff This value represents the progressive high frequency roll-off in meters, a measure of how the higher frequencies 
     * in a user's sound are dampened as the user gets further away. By default, there is a global roll-off value (set for a given space), currently 12.5 
     * meters, which applies to all users in a space. This value represents the distance for a 1kHz rolloff. Values in the range of 
     * 12 to 32 meters provide a more "enclosed" sound, in which high frequencies tend to be dampened over distance as they are 
     * in the real world. Generally changes to roll-off values should be made for the entire space rather than for individual users, but
     * extremely high values (e.g. 99999) should be used in combination with "broadcast mode"-style userAttenuation settings to cause the
     * broadcasted voice to sound crisp and "up close" even at very large distances.
     *
     * If you don't supply an `userRolloff` when constructing instantiations of this class, `userRolloff` will be `null`.
     * 
     * ✔ The client sends `userRolloff` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ❌ The server never sends `userRolloff` data.
     */
    constructor({ position = null, orientationEuler = null, orientationQuat = null, hiFiGain = null, userAttenuation = null, userRolloff = null }: { position?: Point3D, orientationEuler?: OrientationEuler3D, orientationQuat?: OrientationQuat3D, hiFiGain?: number, userAttenuation?: number, userRolloff?: number } = {}) {
        this.position = position;
        this.orientationQuat = orientationQuat;
        this.orientationEuler = orientationEuler;
        this.hiFiGain = hiFiGain;
        this.userAttenuation = userAttenuation;
        this.userRolloff = userRolloff;
    }

    /**
     * Used internally for getting the minimal set of data to transmit to the server.
     * @param otherHiFiData The "other" Audio API Data against which we want to compare.
     * @returns The differences between this Audio API Data and the "other" Audio API Data in `HiFiAudioAPIData` format. 
     */
    diff(otherHiFiData: HiFiAudioAPIData): HiFiAudioAPIData {
        let currentHiFiAudioAPIDataObj: any = {
            "position": Object.assign({}, this.position),
            "orientationEuler": Object.assign({}, this.orientationEuler),
            "orientationQuat": Object.assign({}, this.orientationQuat),
        };
        if (typeof (this.hiFiGain) === "number") {
            currentHiFiAudioAPIDataObj["hiFiGain"] = this.hiFiGain;
        }
        if (typeof (this.userAttenuation) === "number") {
            currentHiFiAudioAPIDataObj["userAttenuation"] = this.userAttenuation;
        }
        if (typeof (this.userRolloff) === "number") {
            currentHiFiAudioAPIDataObj["userRolloff"] = this.userRolloff;
        }

        let otherHiFiDataObj: any = {
            "position": Object.assign({}, otherHiFiData.position),
            "orientationEuler": Object.assign({}, otherHiFiData.orientationEuler),
            "orientationQuat": Object.assign({}, otherHiFiData.orientationQuat),
        };
        if (typeof (otherHiFiData.hiFiGain) === "number") {
            otherHiFiDataObj["hiFiGain"] = otherHiFiData.hiFiGain;
        }
        if (typeof (otherHiFiData.userAttenuation) === "number") {
            otherHiFiDataObj["userAttenuation"] = otherHiFiData.userAttenuation;
        }
        if (typeof (otherHiFiData.userRolloff) === "number") {
            otherHiFiDataObj["userRolloff"] = otherHiFiData.userRolloff;
        }

        let diffObject = recursivelyDiffObjects(currentHiFiAudioAPIDataObj, otherHiFiDataObj);

        let returnValue = new HiFiAudioAPIData();

        if (diffObject.position && (typeof (diffObject.position.x) === "number" || typeof (diffObject.position.y) === "number" || typeof (diffObject.position.z) === "number")) {
            // returnValue.position = new Point3D(diffObject.position);
            // We need to pass the full position data until the mixer can handle fragmented coordinates 
            returnValue.position = new Point3D(otherHiFiData.position);
        }

        if (diffObject.orientationEuler && (typeof (diffObject.orientationEuler.pitchDegrees) === "number" || typeof (diffObject.orientationEuler.yawDegrees) === "number" || typeof (diffObject.orientationEuler.rollDegrees) === "number")) {
            returnValue.orientationEuler = new OrientationEuler3D(diffObject.orientationEuler);
        }

        if (diffObject.orientationQuat && (typeof (diffObject.orientationQuat.w) === "number" || typeof (diffObject.orientationQuat.x) === "number" || typeof (diffObject.orientationQuat.y) === "number" || typeof (diffObject.orientationQuat.z) === "number")) {
            returnValue.orientationQuat = new OrientationQuat3D(diffObject.orientationQuat);
        }

        if (typeof (diffObject.hiFiGain) === "number") {
            returnValue.hiFiGain = diffObject.hiFiGain;
        }
        if (typeof (diffObject.userAttenuation) === "number") {
            returnValue.userAttenuation = diffObject.userAttenuation;
        }
        if (typeof (diffObject.userRolloff) === "number") {
            returnValue.userRolloff = diffObject.userRolloff;
        }

        return returnValue;
    }
}

/**
 * Instantiations of this class contain all of the data that is possible to **receive from** the High Fidelity Audio API Server.
 * See below for more details.
 * 
 * See {@link HiFiAudioAPIData} for data that can both be sent to and received from the Server (i.e. `position`).
 */
export class ReceivedHiFiAudioAPIData extends HiFiAudioAPIData {
    providedUserID: string;
    hashedVisitID: string;
    volumeDecibels: number;
    
    /**
     * 
     * @param params 
     * @param params.providedUserID This User ID is an arbitrary string provided by an application developer which can be used to identify the user associated with a client.
     * We recommend that this `providedUserID` is unique across all users, but the High Fidelity API will not enforce uniqueness across clients for this value.
     * @param params.hashedVisitID This string is a hashed version of the random UUID that is generated automatically.
     * A connecting client sends this value as the `session` key inside the argument to the `audionet.init` command.
     * It is used to identify a given client across a cloud of mixers and is guaranteed ("guaranteed" given the context of random UUIDS) to be unique.
     * Application developers should not need to interact with or make use of this value, unless they want to use it internally for tracking or other purposes.
     * This value cannot be set by the application developer.
     * @param params.volumeDecibels The current volume of the user in decibels.
     * ❌ The client never sends `volumeDecibels` data to the server.
     * ✔ The server sends `volumeDecibels` data to all clients connected to a server during "peer updates".
     */
    constructor(params: { providedUserID?: string, hashedVisitID?: string, volumeDecibels?: number, position?: Point3D, orientationEuler?: OrientationEuler3D, orientationQuat?: OrientationQuat3D, hiFiGain?: number } = {}) {
        super(params);
        this.providedUserID = params.providedUserID;
        this.hashedVisitID = params.hashedVisitID;
        this.volumeDecibels = params.volumeDecibels;
    }
}
