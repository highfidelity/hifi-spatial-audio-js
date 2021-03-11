/**
 * This Module contains classes relevant to data about a user in the virtual 3D environment.
 * @packageDocumentation
 */


function nonan(v: number, ifnan: number ): number {
    return (isNaN(v) ? ifnan : v);
}

function clamp(v: number, min: number, max: number): number {
    // if v is Nan returns Nan
    return (v > max ? max : ( v < min ? min :v));
}

function clampNonan(v: number, min: number, max: number, ifnan: number): number {
    return (v > max ? max : ( v < min ? min : nonan(v, ifnan)));
}

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
     * Construct a new `Point3D` object. All parameters are optional. Unset parameters will be set to `0`. Remember, all units for member variables are `meters`.
     */
    constructor({ x = 0, y = 0, z = 0 }: { x?: number, y?: number, z?: number } = {}) {
        this.x = x;
        this.y = y;
        this.z = z;
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
    z: number;

    /**
     * Construct a new `OrientationQuat3D` object.
     */
    constructor({ w = 1, x = 0, y = 0, z = 0 }: { w?: number, x?: number, y?: number, z?: number } = {}) {
        this.w = clampNonan(w, -1, 1, 1);
        this.x = clampNonan(x, -1, 1, 0);
        this.y = clampNonan(y, -1, 1, 0);
        this.z = clampNonan(z, -1, 1, 0);
    }
}


// helper function that keeps an angle expressed in degrees in the range ]-360, 360[
function sanitizeAngleDegrees(v: number): number {
    // in the case v is Infinity or Nan,  let's special case
    if (isNaN(v) || v === Infinity) {
        return 0;
    } else if (v === -Infinity) {
        return -0;
    } else {
        // bring the value in the range ]-360, 360[
        // if v is < 0 then it will cycle in ]-360, 0]
        // if v is > 0 then it will cycle in [0, 360[
        return v % 360;
    }
}

/**
 * Instantiations of this class define an orientation in 3D space represented by euler angles.
 * This is an alternative to the quaternion representation for orientation when updating the client
 * or when receiving the updates about the other clients in the space.
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
        this.pitchDegrees = sanitizeAngleDegrees(pitchDegrees);
        this.yawDegrees = sanitizeAngleDegrees(yawDegrees);
        this.rollDegrees = sanitizeAngleDegrees(rollDegrees);
    }
}

/**
 * Aside from the 3 angles Yaw, Pitch, Roll defining an orientation, euler angles requires 
 * to define the order in witch the individual yaw, pitch roll rotations are combined.
 * There are 6 orders possible identified by the HiFiEulerOrder enum.
 * 
 *  For example, the order YawPitchRoll is describing the following sequence
 *  starting from the base 3d frame,
 *  1/ Yaw, rotating around the vertical axis
 *  2/ Pitch, rotating around the right axis 
 *  3/ Roll, rotating around the front axis
 *  the resulting 3d frame orientation is relative to the base frame.
 */
export enum OrientationEuler3DOrder {
    PitchYawRoll = "PitchYawRoll",
    YawPitchRoll = "YawPitchRoll",
    RollPitchYaw = "RollPitchYaw",
    RollYawPitch = "RollYawPitch",
    YawRollPitch = "YawRollPitch",
    PitchRollYaw = "PitchRollYaw",
}

/**
 * Compute the orientation quaternion from the specified euler angles.
 * The resulting quaternion is the rotation transforming from combining the euler angles rotations in the specified order
 * 
 * For example, the order YawPitchRoll is computed as follow:
 *  starting from the base 3d frame,
 *  1/ Yaw, rotating around the vertical axis
 *  2/ Pitch, rotating around the right axis 
 *  3/ Roll, rotating around the front axis
 *  the resulting 3d frame orientation is relative to the base frame.
 *  The resulting rotation is defining the 'rotated' space relative to the 'base' space.
 *  A vector Vr in "rotated' space and its equivalent value Vb in the'base' space is computed as follow:
 *  Vb = [P][Y][R] Vr
 * 
 * @param euler - The euler angles.
 * @param order - The euler order convention.
 * 
 * @return The end resulting quaternion defined from the euler angles combination
 */
export function eulerToQuaternion(euler: OrientationEuler3D, order: OrientationEuler3DOrder): OrientationQuat3D {
    // compute the individual euler angle rotation quaternion terms sin(angle/2) and cos(aangle/2)
    const HALF_DEG_TO_RAD = 0.5 * Math.PI / 180.0;
    let cos = { P: Math.cos(euler.pitchDegrees * HALF_DEG_TO_RAD), Y: Math.cos(euler.yawDegrees * HALF_DEG_TO_RAD), R: Math.cos(euler.rollDegrees * HALF_DEG_TO_RAD)};
    let sin = { P: Math.sin(euler.pitchDegrees * HALF_DEG_TO_RAD), Y: Math.sin(euler.yawDegrees * HALF_DEG_TO_RAD), R: Math.sin(euler.rollDegrees * HALF_DEG_TO_RAD)};

    // the computed quaternion components for the 6 orders are based on the same pattern
    // q.x = ax +/- bx 
    // q.y = ay +/- by 
    // q.z = az +/- bz 
    // q.w = aw +/- bw 

    let ax = sin.P * cos.Y * cos.R;
    let ay = cos.P * sin.Y * cos.R;
    let az = cos.P * cos.Y * sin.R;
    let aw = cos.P * cos.Y * cos.R;

    let bx = cos.P * sin.Y * sin.R;
    let by = sin.P * cos.Y * sin.R;
    let bz = sin.P * sin.Y * cos.R;
    let bw = sin.P * sin.Y * sin.R;

    switch (order) {
    // from 'base' space rotate Pitch, then Yaw then Roll
    // Resulting rotation is defining the 'rotated' space relative to the 'base' space.
    // A vector Vr in "rotated' space and its equivalent value Vb in the'base' space is computed as follow:
    // Vb = [P][Y][R] Vr
    case OrientationEuler3DOrder.PitchYawRoll: {
        return new OrientationQuat3D({
                x: ax + bx,
                y: ay - by,
                z: az + bz,
                w: aw - bw,
            });
        } break;

    // From 'base' space rotate Yaw, then Pitch then Roll...
    case OrientationEuler3DOrder.YawPitchRoll: {
        return new OrientationQuat3D({
                x: ax + bx,
                y: ay - by,
                z: az - bz,
                w: aw + bw,
            });
        } break;
 
    // From 'base' space rotate Roll, then Pitch then Yaw...
    case OrientationEuler3DOrder.RollPitchYaw: {
        return new OrientationQuat3D({
                x: ax - bx,
                y: ay + by,
                z: az + bz,
                w: aw - bw,
            });
        } break;
 
    // From 'base' space rotate Roll, then Yaw then Pitch...
    case OrientationEuler3DOrder.RollYawPitch: {
        return new OrientationQuat3D({
                x: ax - bx,
                y: ay + by,
                z: az - bz,
                w: aw + bw,
            });
        } break;
  
    // From 'base' space rotate Yaw, then Roll then Pitch...
    case OrientationEuler3DOrder.YawRollPitch: {
        return new OrientationQuat3D({
                x: ax + bx,
                y: ay + by,
                z: az - bz,
                w: aw - bw,
            });
        } break;
  
    // From 'base' space rotate Pitch, then Roll then Yaw...
    case OrientationEuler3DOrder.PitchRollYaw: {
        return new OrientationQuat3D({
                x: ax - bx,
                y: ay - by,
                z: az + bz,
                w: aw + bw,
            });
        } break;
    }    
}

/**
 * Compute the orientation euler decomposition from the specified quaternion.
 * The resulting euler is the rotation transforming from combining the euler angles rotations in the specified order
 * 
 * For example, the order YawPitchRoll is computed as follow:
 *  starting from the base 3d frame,
 *  1/ Yaw, rotating around the vertical axis
 *  2/ Pitch, rotating around the right axis 
 *  3/ Roll, rotating around the front axis
 *  the resulting 3d frame orientation is relative to the base frame.
 *  The resulting rotation is defining the 'rotated' space relative to the 'base' space.
 *  A vector Vr in "rotated' space and its equivalent value Vb in the'base' space is computed as follow:
 *  Vb = [P][Y][R] Vr
 * 
 * @param quat - The orientation quaternion.
 * @param order - The euler order convention.
 * 
 * @return The end resulting quaternion defined from the euler angles combination
 */
export function eulerFromQuaternion(quat: OrientationQuat3D, order: OrientationEuler3DOrder): OrientationEuler3D {
    // We need to convert the quaternion to the equivalent mat3x3
    let qx2 = quat.x * quat.x;
    let qy2 = quat.y * quat.y;
    let qz2 = quat.z * quat.z;
    // let qw2 = quat.w * quat.w; we could choose to use it instead of the 1 - 2* term...
    let qwx = quat.w * quat.x;
    let qwy = quat.w * quat.y;
    let qwz = quat.w * quat.z;
    let qxy = quat.x * quat.y;
    let qyz = quat.y * quat.z;
    let qxz = quat.z * quat.x;
    // ROT Mat33 =  {  1 - 2qy2 - 2qz2  |  2(qxy - qwz)    |  2(qxz + qwy)  }
    //              {  2(qxy + qwz)     |  1 - 2qx2 - 2qz2 |  2(qyz - qwx)  }
    //              {  2(qxz - qwy)     |  2(qyz + qwx)    |  1 - 2qx2 - 2qy2  }
    let r00 = 1.0 - 2.0 * (qy2 + qz2);
    let r10 = 2.0 * (qxy + qwz);
    let r20 = 2.0 * (qxz - qwy);

    let r01 = 2.0 * (qxy - qwz);
    let r11 = 1.0 - 2.0 * (qx2 + qz2); 
    let r21 = 2.0 * (qyz + qwx);
   
    let r02 = 2.0 * (qxz + qwy);
    let r12 = 2.0 * (qyz - qwx);
    let r22 = 1.0 - 2.0 * (qx2 + qy2); 

    // then depending on the euler rotation order decomposition, we extract the angles 
    // from the base vector components
    let pitch = 0;
    let yaw = 0;
    let roll = 0;
    const ONE_MINUS_EPSILON = 0.9999999;
    switch (order) {
    case OrientationEuler3DOrder.PitchYawRoll: {
        yaw = Math.asin( r02 );
        if ( Math.abs( r02 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( -r12, r22);
            roll = Math.atan2( -r01, r00);
        } else {
            pitch = Math.atan2(r21, r11);
        }       
    } break;
    case OrientationEuler3DOrder.YawPitchRoll: {
        pitch = Math.asin(-r12);
        if ( Math.abs( r12 ) < ONE_MINUS_EPSILON ) {
            yaw = Math.atan2(r02, r22);
            roll = Math.atan2(r10, r11);
        } else {
            yaw = Math.atan2(-r20, r00);
        } 
    } break;
    case OrientationEuler3DOrder.RollPitchYaw: {
        pitch = Math.asin(r21);
        if ( Math.abs( r21 ) < ONE_MINUS_EPSILON ) {
            yaw = Math.atan2(-r20, r22);
            roll = Math.atan2(-r01, r11);
        } else {
            roll = Math.atan2(r10, r00);
        }
    } break;
    case OrientationEuler3DOrder.RollYawPitch: {
        yaw = Math.asin( -r20 );
        if ( Math.abs( r20 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( r21, r22);
            roll = Math.atan2( r10, r00);
        } else {
            roll = Math.atan2( -r01, r11);
        }  
    } break;
    case OrientationEuler3DOrder.YawRollPitch: {
        roll = Math.asin( r10 );
        if ( Math.abs( r10 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( -r12, r11);
            yaw = Math.atan2( -r20, r00);
        } else {
            yaw = Math.atan2( r02, r22);
        }
    } break;
    case OrientationEuler3DOrder.PitchRollYaw: {
        roll = Math.asin( -r01 );
        if ( Math.abs( r01 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( r21, r11);
            yaw = Math.atan2( r02, r00);
        } else {
            yaw = Math.atan2( -r12, r22);
        }
    } break;
    }    
    const RAD_TO_DEG = 180.0 / Math.PI;
    return new OrientationEuler3D({ pitchDegrees: RAD_TO_DEG * pitch, yawDegrees: RAD_TO_DEG * yaw, rollDegrees: RAD_TO_DEG * roll });
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
    /**
     * If you don't supply a `position` when constructing instantiations of this class, `position` will be `null`.
     * 
     * ✔ The client sends `position` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `position` data to all clients connected to a server during "peer updates".
     */
    position: Point3D;
    /**
     * If you don't supply an `orientationQuat` when constructing instantiations of this class, `orientationQuat` will be `null`.
     * 
     * ✔ The client sends `orientationQuat` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ✔ The server sends `orientationQuat` data to all clients connected to a server during "peer updates".
     */
    orientationQuat: OrientationQuat3D;
    /**
     * For convenience, a Euler representation of the orientation is supported.
     * This is an alternative way to specify the `orientationQuat` field in the `HiFiAudioAPIData` that is sent to or received from the server.
     * 
     *  ✔ When using euler representation to update the client orientation, the equivalent Quaternion is evaluated in `_updateUserData()`
     * 
     *  ✔ When requesting orientation Euler from server updates, the Euler representation is evaluated in `_handleUserDataUpdates()`
     */
    orientationEuler: OrientationEuler3D;
    /**
     * A volume level below this value is considered background noise and will be smoothly gated off.
     * The floating point value is specified in dBFS (decibels relative to full scale) with values between -96 dB (indicating no gating)
     * and 0 dB. It is in the same decibel units as the VolumeDecibels component of UserDataSubscription.
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
     * ✔ The server sends `hiFiGain` data to all clients connected to a server during "peer updates".
     */
    hiFiGain: number;
    /**
     * This value affects how far a user's sound will travel in 3D space, without affecting the user's loudness.
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
     * If you don't supply an `userRolloff` when constructing instantiations of this class, `userRolloff` will be `null`.
     * 
     * ✔ The client sends `userRolloff` data to the server when `_transmitHiFiAudioAPIDataToServer()` is called.
     * 
     * ❌ The server never sends `userRolloff` data.
     */
    userRolloff: number;
    
    constructor({ position = null, orientationQuat = null, orientationEuler = null, volumeThreshold = null, hiFiGain = null, userAttenuation = null, userRolloff = null }: { position?: Point3D, orientationQuat?: OrientationQuat3D, orientationEuler?: OrientationEuler3D, volumeThreshold?: number, hiFiGain?: number, userAttenuation?: number, userRolloff?: number } = {}) {
        this.position = position;
        this.orientationQuat = orientationQuat;
        this.orientationEuler = orientationEuler;
        this.volumeThreshold = volumeThreshold;
        this.hiFiGain = hiFiGain;
        this.userAttenuation = userAttenuation;
        this.userRolloff = userRolloff;
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
    
    constructor(params: { providedUserID?: string, hashedVisitID?: string, volumeDecibels?: number, position?: Point3D, orientationQuat?: OrientationQuat3D, hiFiGain?: number } = {}) {
        super(params);
        this.providedUserID = params.providedUserID;
        this.hashedVisitID = params.hashedVisitID;
        this.volumeDecibels = params.volumeDecibels;
    }
}
