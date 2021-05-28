/**
 * This Module contains classes relevant to data about a user in the virtual 3D environment.
 * @packageDocumentation
 */

import { HiFiUtilities } from "../utilities/HiFiUtilities";


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

    /**
     * Returns the vector dot product between two Point3Ds.
     */
    static dot(a: Point3D, b: Point3D): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    /**
     * Returns the vector cross product between two Point3Ds.
     */
    static cross(a: Point3D, b: Point3D): Point3D {
        return new Point3D({x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x});
    }

    /**
      * Negates this Point3D.
      */
    negate() {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
    }
}

class Matrix3 {
    a: Point3D;
    b: Point3D;
    c: Point3D;

    /**
     * The values in the Matrix3 are stored in three Point3D rows:
     *
     * |  <- a -> |
     * |  <- b -> |
     * |  <- c -> |
     *
     */
    constructor(a: Point3D, b: Point3D, c: Point3D) {
        this.a = new Point3D({x: a.x, y: a.y, z: a.z});
        this.b = new Point3D({x: b.x, y: b.y, z: b.z});
        this.c = new Point3D({x: c.x, y: c.y, z: c.z});
    }

    /** 
     * Operate from the **left** on a columnar Point3D on the **right**.
     * Performs an afine transformation on the Point3D and
     * returns the transformed Point3D in the destination coordinate system.
     */
    transform(point: Point3D): Point3D {
        let p = new Point3D();
        p.x = Point3D.dot(this.a, point);
        p.y = Point3D.dot(this.b, point);
        p.z = Point3D.dot(this.c, point);
        return p;
    }

    /**
     * Flip the Matrix3 about the diagonal axis.
     *
     * | ax  ay  az |       | ax  bx  cx |
     * | bx  by  bz |  -->  | ay  by  cy |
     * | cx  cy  cz |       | az  bz  cz |
     *
     */
    transpose() {
        var temp = this.a.y;
        this.a.y = this.b.x;
        this.b.x = temp;
        temp = this.a.z;
        this.a.z = this.c.x;
        this.c.x = temp;
        temp = this.b.z;
        this.b.z = this.c.y;
        this.c.y = temp;
    }

    /**
     * Multiply the two matrices: f * g
     * Returns a new Matrix3 that represents their product.
     */
    static multiply(f: Matrix3, g: Matrix3): Matrix3 {
        let a =  new Point3D({
            x: f.a.x * g.a.x + f.a.y * g.b.x + f.a.z * g.c.x,
            y: f.a.x * g.a.y + f.a.y * g.b.y + f.a.z * g.c.y,
            z: f.a.x * g.a.z + f.a.y * g.b.z + f.a.z * g.c.z});
        let b = new Point3D({
            x: f.b.x * g.a.x + f.b.y * g.b.x + f.b.z * g.c.x,
            y: f.b.x * g.a.y + f.b.y * g.b.y + f.b.z * g.c.y,
            z: f.b.x * g.a.z + f.b.y * g.b.z + f.b.z * g.c.z});
        let c = new Point3D({
            x: f.c.x * g.a.x + f.c.y * g.b.x + f.c.z * g.c.x,
            y: f.c.x * g.a.y + f.c.y * g.b.y + f.c.z * g.c.y,
            z: f.c.x * g.a.z + f.c.y * g.b.z + f.c.z * g.c.z});

        return new Matrix3(a, b, c);
    }

    static FromQuaternion(q: OrientationQuat3D): Matrix3 {
        // from https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToMatrix/hamourus.htm
        let sqw = q.w * q.w; 
        let sqx = q.x * q.x; 
        let sqy = q.y * q.y; 
        let sqz = q.z * q.z; 

        // rotation matrix is scaled by quaternion length squared
        // so we can avoid a sqrt operation by multiplying each matrix element by inverse square length
        let invs = 1 / (sqx + sqy + sqz + sqw); 
 
        let a = new Point3D();
        let b = new Point3D();
        let c = new Point3D();
        a.x = ( sqx - sqy - sqz + sqw) * invs; 
        b.y = (-sqx + sqy - sqz + sqw) * invs; 
        c.z = (-sqx - sqy + sqz + sqw) * invs; 
 
        let tmp1 = q.x * q.y; 
        let tmp2 = q.z * q.w; 
        b.x = 2.0 * (tmp1 + tmp2) * invs; 
        a.y = 2.0 * (tmp1 - tmp2) * invs; 
 
        tmp1 = q.x * q.z; 
        tmp2 = q.y * q.w; 
        c.x = 2.0 * (tmp1 - tmp2) * invs; 
        a.z = 2.0 * (tmp1 + tmp2) * invs; 

        tmp1 = q.y * q.z; 
        tmp2 = q.x * q.w; 
        c.y = 2.0 * (tmp1 + tmp2) * invs; 
        b.z = 2.0 * (tmp1 - tmp2) * invs; 

        return new Matrix3(a, b, c);
    }

    static ToQuaternion(m: Matrix3): OrientationQuat3D {
        // from https://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/
        let q = new OrientationQuat3D();
        q.w = Math.sqrt(Math.max(0, 1 + m.a.x + m.b.y + m.c.z )) / 2;
        q.x = Math.sqrt(Math.max(0, 1 + m.a.x - m.b.y - m.c.z )) / 2;
        q.y = Math.sqrt(Math.max(0, 1 - m.a.x + m.b.y - m.c.z )) / 2;
        q.z = Math.sqrt(Math.max(0, 1 - m.a.x - m.b.y + m.c.z )) / 2;
        if (m.c.y - m.b.z < 0) {
            q.x *= -1;
        }
        if (m.a.z - m.c.x < 0) {
            q.y *= -1;
        }
        if (m.b.x - m.a.y < 0) {
            q.z *= -1;
        }
        return q;
    }
}

/**
 * HiFi Spatial Audio uses a right-handed Cartesian coordinate system
 * with FORWARD pointing along negative Z-axis and UP along positive Y-axis.
 *
 * If the World uses a different coordinate system then it will be necessary
 * to convert World-frame Position into the HiFi-frame.
 * HiFiCoordinateFrameUtil is a helper class for this scenario.
 *
 * To build a HiFiCoordinateFrameUtil instance you must present three arguments:
 * (1) The normalized FORWARD axis in the World-frame
 * (2) The normalized UP axis in the World-frame
 * (3) Whether it is a RIGHT- or LEFT-handed coordinate system
 */
export class HiFiCoordinateFrameUtil {
    _worldToHifi: Matrix3;
    _hifiToWorld: Matrix3;

    /**
     * Construct a HiFiCoordinateFrameUtil to easily transform into and out of the coordinate frame
     * used for HiFi Spatial Audio calculations.
     *
     * @param forward - the World-frame FORWARD direction.
     * @param up - the World-frame Up direction.
     * @param isLeft - true if World-frame is a left-handed coordinate frame, else false (the default)
     *
     * How to know if your coordinate frame is left-handed?
     * If Z = vector_cross_product(X, Y) as per the right-hand rule
     * (from your physics or 3D geometry class)
     * then it is right-handed, else it must be left-handed.
     */
    constructor(forward: Point3D, up: Point3D, isLeft = false) {
        // We assemble a Matrix3: worldToCanonical which transforms World-frame Point3Ds
        // to a hypothentical canonical-frame (e.g. fwd=x-axis, up=y-axis, right=z-axis).
        // It is just the matrix of the three cardinal directions as rows:
        //
        // | <-forward-> |
        // | <-  up   -> |
        // | <- right -> |
        //
        let right = Point3D.cross(forward, up);
        if (isLeft) {
            // Note: for left-handed systems we reflect 'right' to actually be 'left'
            right.negate();
        }
        let worldToCanonical = new Matrix3(forward, up, right);

        // Similarly we create another Matrix3: canonicalToHifi
        // using HiFi's directions (forward, up, and right)
        // but this time we transpose it to get the inverse.
        let canonicalToHifi = new Matrix3(
            new Point3D({x:0, y:0, z:-1}),
            new Point3D({x:0, y:1, z:0}),
            new Point3D({x:1, y:0, z:0}));
        canonicalToHifi.transpose();

        // The final Matrix is: canonicalToHifi * worldToCanonical 
        this._worldToHifi = Matrix3.multiply(canonicalToHifi, worldToCanonical);

        // For convenience we cache the transposed matrix for transforming in the other direction
        this._hifiToWorld = new Matrix3(this._worldToHifi.a, this._worldToHifi.b, this._worldToHifi.c);
        this._hifiToWorld.transpose();
    }

    /**
     * @param position - Position in World-frame
     * @returns Position in HiFi-frame.
     */
    WorldPositionToHiFi(position: Point3D): Point3D {
        return this._worldToHifi.transform(position);
    }

    /**
     * @param position - Position in HiFi-frame
     * @returns Position in World-frame.
     */
    HiFiPositionToWorld(position: Point3D): Point3D {
        return this._hifiToWorld.transform(position);
    }

    /**
     * @param orientation - Orientation in World-frame
     * @returns Orientation in HiFi-frame.
     */
    WorldOrientationToHiFi(orientation: OrientationQuat3D): OrientationQuat3D {
        // The best way to understand this math is to remember:
        // this matrix operates from the LEFT on a hypothetical columnar Point3D on the RIGHT
        // this hypothetical Point3D is in the HiFi-frame and as the three matrices operate on it...
        // (1) it gets transformed into the World-frame
        // (2) the world-frame Orientation rotates it
        // (3) it gets transformed back into the HiFi-frame
        // The hypothetical result would be:
        // the HiFi-frame Point3D has been rotated by whatever world-frame oriention equivalent in the HiFi-frame

        // newOrientation = worldToHifi * orientation * hifiToWorld
        let m = Matrix3.FromQuaternion(orientation);
        m = Matrix3.multiply(m, this._hifiToWorld);
        m = Matrix3.multiply(this._worldToHifi, m);
        return Matrix3.ToQuaternion(m);
    }

    /**
     * @param orientation - Orientation in HiFi-frame
     * @returns Orientation in World-frame.
     */
    HiFiOrientationToWorld(orientation: OrientationQuat3D): OrientationQuat3D {
        // similar to WorldOrientationToHiFi()...
        let m = Matrix3.FromQuaternion(orientation);
        m = Matrix3.multiply(m, this._worldToHifi);
        m = Matrix3.multiply(this._hifiToWorld, m);
        return Matrix3.ToQuaternion(m);
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
        this.w = HiFiUtilities.clampNonan(w, -1, 1, 1);
        this.x = HiFiUtilities.clampNonan(x, -1, 1, 0);
        this.y = HiFiUtilities.clampNonan(y, -1, 1, 0);
        this.z = HiFiUtilities.clampNonan(z, -1, 1, 0);
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
        yaw = Math.asin( HiFiUtilities.clampNormalized(r02) );
        if ( Math.abs( r02 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( -r12, r22);
            roll = Math.atan2( -r01, r00);
        } else {
            pitch = Math.atan2(r21, r11);
        }       
    } break;
    case OrientationEuler3DOrder.YawPitchRoll: {
        pitch = Math.asin( HiFiUtilities.clampNormalized(-r12) );
        if ( Math.abs( r12 ) < ONE_MINUS_EPSILON ) {
            yaw = Math.atan2(r02, r22);
            roll = Math.atan2(r10, r11);
        } else {
            yaw = Math.atan2(-r20, r00);
        } 
    } break;
    case OrientationEuler3DOrder.RollPitchYaw: {
        pitch = Math.asin( HiFiUtilities.clampNormalized(r21) );
        if ( Math.abs( r21 ) < ONE_MINUS_EPSILON ) {
            yaw = Math.atan2(-r20, r22);
            roll = Math.atan2(-r01, r11);
        } else {
            roll = Math.atan2(r10, r00);
        }
    } break;
    case OrientationEuler3DOrder.RollYawPitch: {
        yaw = Math.asin( HiFiUtilities.clampNormalized(-r20) );
        if ( Math.abs( r20 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( r21, r22);
            roll = Math.atan2( r10, r00);
        } else {
            roll = Math.atan2( -r01, r11);
        }  
    } break;
    case OrientationEuler3DOrder.YawRollPitch: {
        roll = Math.asin( HiFiUtilities.clampNormalized(r10) );
        if ( Math.abs( r10 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( -r12, r11);
            yaw = Math.atan2( -r20, r00);
        } else {
            yaw = Math.atan2( r02, r22);
        }
    } break;
    case OrientationEuler3DOrder.PitchRollYaw: {
        roll = Math.asin( HiFiUtilities.clampNormalized(-r01) );
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
     * and 0 dB (effectively muting the input from this user). It is in the same decibel units as the VolumeDecibels component of UserDataSubscription.
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

    /*
     * This is an internal class and it is not recommended for normal usage of the API.
     *
     * See instead {@link HiFiCommunicator.setOtherUserGainsForThisConnection}, which allows you to set the desired gains for one or more users as perceived by this client only. If you need to perform moderation actions on the server side, use the {@link https://docs.highfidelity.com/rest/latest/index.html|Administrative REST API}.
     *
     * Internally, this variable is used to keep track of which other user gain changes need to be sent to the server. The keys are hashed visit IDs, and the values are gains.
     */
    /** @internal */
    _otherUserGainQueue: OtherUserGainMap;
    
    constructor({ position = null, orientationQuat = null, orientationEuler = null, volumeThreshold = null, hiFiGain = null, userAttenuation = null, userRolloff = null }: { position?: Point3D, orientationQuat?: OrientationQuat3D, orientationEuler?: OrientationEuler3D, volumeThreshold?: number, hiFiGain?: number, userAttenuation?: number, userRolloff?: number } = {}) {
        this.position = position;
        this.orientationQuat = orientationQuat;
        this.orientationEuler = orientationEuler;
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
    
    constructor(params: { providedUserID?: string, hashedVisitID?: string, volumeDecibels?: number, position?: Point3D, orientationQuat?: OrientationQuat3D, isStereo?: boolean } = {}) {
        super(params);
        this.providedUserID = params.providedUserID;
        this.hashedVisitID = params.hashedVisitID;
        this.volumeDecibels = params.volumeDecibels;
        this.isStereo = params.isStereo;
    }
}
