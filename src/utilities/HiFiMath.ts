/**
 * This Module contains a minimal set of 3D math utilities.
 * @packageDocumentation
 */

import { HiFiUtilities } from "./HiFiUtilities";

const MIN_NORMALIZABLE_SQUARE_LENGTH = 1.0e-15;
const RADIANS_TO_DEGREES = 180.0 / Math.PI;
const DEGREES_TO_RADIANS = Math.PI / 180.0;

/**
 * A point in 3D space.
 */
export class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor({ x = 0, y = 0, z = 0 }: { x?: number, y?: number, z?: number } = {}) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    negate() {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    length2(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    static add(a: Vector3, b: Vector3) {
        return new Vector3({x: a.x + b.x, y: a.y + b.y, z: a.z + b.z});
    }

    static subtract(a: Vector3, b: Vector3) {
        return new Vector3({x: a.x + b.x, y: a.y + b.y, z: a.z + b.z});
    }

    static scale(s: number, b: Vector3) {
        return new Vector3({x: s * b.x, y: s * b.y, z: s * b.z});
    }

    static dot(a: Vector3, b: Vector3): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static cross(a: Vector3, b: Vector3): Vector3 {
        return new Vector3({x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x});
    }

    static distance(a: Vector3, b: Vector3): number {
        let x = b.x - a.x;
        let y = b.y - a.y;
        let z = b.z - a.z;
        return Math.sqrt(x*x + y*y + z*z);
    }

    static distance2(a: Vector3, b: Vector3): number {
        let x = b.x - a.x;
        let y = b.y - a.y;
        let z = b.z - a.z;
        return x*x + y*y + z*z;
    }
}

/**
 * A Quaternion for 3D rotations.
 */
export class Quaternion {
    w: number;
    x: number;
    y: number;
    z: number;

    constructor({ w = 1.0, x = 0, y = 0, z = 0 }: { w?: number, x?: number, y?: number, z?: number } = {}) {
        this.w = w;
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /**
     * @param angle - angle of rotation in radians
     * @param axis - axis of rotation (does not need to be unitary)
     * @returns Quaternion representing a rotation of angle about axis.
     */
    static fromAngleAxis(angle: number, axis: Vector3): Quaternion {
        let q = new Quaternion();
        let L2 = axis.length2();
        if (L2 > MIN_NORMALIZABLE_SQUARE_LENGTH) {
            let c = Math.cos(0.5 * angle);
            let s_over_L = Math.sin(0.5 * angle) / Math.sqrt(L2);
            q.w = c;
            q.x = axis.x * s_over_L;
            q.y = axis.y * s_over_L;
            q.z = axis.z * s_over_L;
        }
        return q;
    }

    /**
     * @returns Angle of rotation in radians
     */
    getAngle() {
        let angle = 0.0;
        let length2 = Quaternion.dot(this, this);
        if (length2 > MIN_NORMALIZABLE_SQUARE_LENGTH) {
            // we use abs() to compute the positive angle
            // (e.g. we chose the axis such that angle is positive)
            angle = Math.abs(2.0 * Math.acos(this.w / Math.sqrt(length2)));
        }
        return angle;
    }

    /**
     * @returns normalized axis of shortest positive rotation
     */
    getAxis() {
        let axis = new Vector3();
        let imaginaryLength2 = this.x * this.x + this.y * this.y + this.z * this.z;
        if (imaginaryLength2 > MIN_NORMALIZABLE_SQUARE_LENGTH) {
            let imaginaryLength = Math.sqrt(imaginaryLength2);
            axis.x = this.x / imaginaryLength;
            axis.y = this.y / imaginaryLength;
            axis.z = this.z / imaginaryLength;
            let wholeLength = Math.sqrt(imaginaryLength + this.w * this.w);
            let angle = 2.0 * Math.acos(this.w / wholeLength);
            if (angle < 0.0) {
                // we choose the axis that corresponds to positive angle
                axis.negate();
            }
        }
        return axis;
    }

    /**
     * @returns Euler angle decomposition object: {yaw:, pitch:, roll:}
     * where:
     *   yaw = degrees rotation about 'up' axis
     *   pitch = degrees rotation about yawed 'right' axis
     *   roll = degrees rotation about yawed and pitched 'forward' axis
     */
    getEulerAngles() {
        let forward = new Vector3({x: 0.0, y: 0.0, z: -1.0});
        let rotatedForward = this.rotateVector(forward);

        let yaw = 0.0;
        let projectedLengthSquared = rotatedForward.x * rotatedForward.x + rotatedForward.z * rotatedForward.z;
        let right = new Vector3({x: 1.0, y: 0.0, z: 0.0});
        if (projectedLengthSquared > MIN_NORMALIZABLE_SQUARE_LENGTH) {
            // rotatedForward has a non-zero component in the horizontal plane
            // and we use that projection to compute the angle
            yaw = Math.acos(Vector3.dot(forward, rotatedForward) / Math.sqrt(projectedLengthSquared)); 
            if (Vector3.dot(rotatedForward, right) > 0.0) {
                yaw *= -1;
            }
        } else {
            // rotatedForward points along vertical axis and has no projection on the horizontal plane
            // however the "rotatedRight" axis effectively lies on the horizontal plane
            // and we can extract the azimuthal angle from its projection there
            let rotatedRight = this.rotateVector(right);
            projectedLengthSquared = rotatedRight.x * rotatedRight.x + rotatedRight.z * rotatedRight.z;
            yaw = Math.acos(Vector3.dot(rotatedRight, right) / Math.sqrt(projectedLengthSquared)); 
            if (Vector3.dot(rotatedRight, forward) < 0.0) {
                yaw *= -1;
            }
        }

        let pitch = Math.asin(rotatedForward.y);

        // For "roll": rotatedUp direction lives on a plane spanned by two unit vectors: yawedRight and pitchedUp
        // We can compute "roll" using trigonometry once we decompose rotatedUp onto that plane
        let up = new Vector3({ x: 0.0, y: 1.0, z: 0.0 });
        let rotatedUp = this.rotateVector(up);
        let yawedRight = new Vector3({ x: Math.cos(yaw), y: 0.0, z: -Math.sin(yaw) });
        let pitchedUp = Vector3.cross(yawedRight, rotatedForward); // note, this is already unitary
        let roll = Math.atan2( Vector3.dot(rotatedUp, yawedRight), Vector3.dot(rotatedUp, pitchedUp));

        // convert all angles to degrees
        yaw *= RADIANS_TO_DEGREES;
        pitch *= RADIANS_TO_DEGREES;
        roll *= RADIANS_TO_DEGREES;

        return {"yaw": yaw, "pitch": pitch, "roll": roll};
    }

    /**
     * @returns Azimuthal angle of rotation in degrees, also known as the "yaw about 'up'"
     */
    getAzimuth() {
        let forward = new Vector3({x: 0.0, y: 0.0, z: -1.0});
        let rotatedForward = this.rotateVector(forward);
        let azimuth = 0.0;
        let projectedLengthSquared = rotatedForward.x * rotatedForward.x + rotatedForward.z * rotatedForward.z;
        let right = new Vector3({x: 1.0, y: 0.0, z: 0.0});
        if (projectedLengthSquared > MIN_NORMALIZABLE_SQUARE_LENGTH) {
            // rotatedForward has a non-zero component in the horizontal plane
            // and we use that projection to compute the angle
            azimuth = Math.acos(Vector3.dot(forward, rotatedForward) / Math.sqrt(projectedLengthSquared)); 
            if (Vector3.dot(rotatedForward, right) > 0.0) {
                azimuth *= -1;
            }
        } else {
            // rotatedForward points along vertical axis and has no projection on the horizontal plane
            // however the "rotatedRight" axis effectively lies on the horizontal plane
            // and we can extract the azimuthal angle from its projection there
            let rotatedRight = this.rotateVector(right);
            projectedLengthSquared = rotatedRight.x * rotatedRight.x + rotatedRight.z * rotatedRight.z;
            azimuth = Math.acos(Vector3.dot(rotatedRight, right) / Math.sqrt(projectedLengthSquared)); 
            if (Vector3.dot(rotatedRight, forward) < 0.0) {
                azimuth *= -1;
            }
        }
        // finally, convert from radians to degrees
        return azimuth * RADIANS_TO_DEGREES;
    }

    /**
     * @returns Elevation angle of rotation in degrees, also known as the "pitch from horizontal plane"
     */ 
    getElevation() {
        let forward = new Vector3({x: 0.0, y: 0.0, z: -1.0});
        let rotatedForward = this.rotateVector(forward);
        return RADIANS_TO_DEGREES * Math.asin(rotatedForward.y);
    }

    /**
     * @returns Quaternion representing a rotation of yaw, pitch, roll about successive local axes: up, right, forward
     * @param yaw - angle in degrees rotation about local-up
     * @param pitch - angle in degrees rotation about local-right
     * @param roll - angle in degrees rotation about local-forward
     */
    static fromEulerAngles({yaw = 0, pitch = 0, roll= 0 }: { yaw?: number, pitch?: number, roll?: number } = {}) {
        let upAxis = new Vector3({ x: 0.0, y: 1.0, z: 0.0 });
        let rightAxis = new Vector3({ x: 1.0, y: 0.0, z: 0.0 });
        let forwardAxis = new Vector3({ x: 0.0, y: 0.0, z: -1.0 });

        let qYaw = Quaternion.fromAngleAxis(yaw * DEGREES_TO_RADIANS, upAxis);
        let pitchAxis = qYaw.rotateVector(rightAxis);
        let qPitch = Quaternion.fromAngleAxis(pitch * DEGREES_TO_RADIANS, pitchAxis);
        let rollAxis = qPitch.rotateVector(qYaw.rotateVector(forwardAxis));
        let qRoll = Quaternion.fromAngleAxis(roll * DEGREES_TO_RADIANS, rollAxis);

        return Quaternion.multiply(qRoll, Quaternion.multiply(qPitch, qYaw));
    }

    /**
     * @returns Yaw angle of rotation in degrees, also known as the "azimuth"
     */
    getYaw() {
        return this.getAzimuth();
    }

    /**
     * @returns Pitch angle of rotation in degrees, also known as the "elevation"
     */
    getPitch() {
        return this.getElevation();
    }

    /**
     * @returns the dot product of two Quaternions
     */
    static dot(p: Quaternion, q: Quaternion): number {
        return p.w * q.w + p.x * q.x + p.y * q.y + p.z * q.z;
    }
    
    /**
     * Normalize this Quaternion to have unitary length.
     */
    normalize() {
        let L2 = this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z;
        if (L2 > MIN_NORMALIZABLE_SQUARE_LENGTH) {
            let inv_L = 1.0 / Math.sqrt(L2);
            this.w *= inv_L
            this.x *= inv_L;
            this.y *= inv_L;
            this.z *= inv_L;
        }
    }

    /**
     * @returns the rotated vector
     */
    rotateVector(v: Vector3): Vector3 {
        return Matrix3.fromQuaternion(this).transformVector(v);
    }

    /**
     * @returns Product of two quaternions: a * b
     * @param a - quaternion on the left
     * @param b - quaternion on the right
     */
    static multiply(a: Quaternion, b: Quaternion): Quaternion {
        return new Quaternion({
            w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
            x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
            y: a.w * b.y + a.y * b.w + a.z * b.x - a.x * b.z,
            z: a.w * b.z + a.z * b.w + a.x * b.y - a.y * b.x
        });
    }
}

export class Matrix3 {
    a: Vector3;
    b: Vector3;
    c: Vector3;

    /**
     * The values in the Matrix3 are stored in three Vector3 rows:
     *
     * |  <- a -> |
     * |  <- b -> |
     * |  <- c -> |
     *
     */
    constructor(a: Vector3, b: Vector3, c: Vector3) {
        this.a = new Vector3({x: a.x, y: a.y, z: a.z});
        this.b = new Vector3({x: b.x, y: b.y, z: b.z});
        this.c = new Vector3({x: c.x, y: c.y, z: c.z});
    }

    /** 
     * Operate from the **left** on a columnar Vector3 on the **right**.
     * Performs an afine transformation on the Vector3 and returns the result.
     */
    transformVector(point: Vector3): Vector3 {
        let p = new Vector3();
        p.x = Vector3.dot(this.a, point);
        p.y = Vector3.dot(this.b, point);
        p.z = Vector3.dot(this.c, point);
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
     * Multiply the two matrices: f * g and return their product.
     */
    static multiply(f: Matrix3, g: Matrix3): Matrix3 {
        let a =  new Vector3({
            x: f.a.x * g.a.x + f.a.y * g.b.x + f.a.z * g.c.x,
            y: f.a.x * g.a.y + f.a.y * g.b.y + f.a.z * g.c.y,
            z: f.a.x * g.a.z + f.a.y * g.b.z + f.a.z * g.c.z});
        let b = new Vector3({
            x: f.b.x * g.a.x + f.b.y * g.b.x + f.b.z * g.c.x,
            y: f.b.x * g.a.y + f.b.y * g.b.y + f.b.z * g.c.y,
            z: f.b.x * g.a.z + f.b.y * g.b.z + f.b.z * g.c.z});
        let c = new Vector3({
            x: f.c.x * g.a.x + f.c.y * g.b.x + f.c.z * g.c.x,
            y: f.c.x * g.a.y + f.c.y * g.b.y + f.c.z * g.c.y,
            z: f.c.x * g.a.z + f.c.y * g.b.z + f.c.z * g.c.z});

        return new Matrix3(a, b, c);
    }

    /**
     * return the rotation part of the Quaternion in Matrix3 form
     */
    static fromQuaternion(q: Quaternion): Matrix3 {
        // from https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToMatrix/hamourus.htm
        let sqw = q.w * q.w; 
        let sqx = q.x * q.x; 
        let sqy = q.y * q.y; 
        let sqz = q.z * q.z; 

        // rotation matrix is scaled by quaternion length squared
        // so we can avoid a sqrt operation by multiplying each matrix element by inverse square length
        let invs = 1.0 / (sqx + sqy + sqz + sqw); 
 
        let a = new Vector3();
        let b = new Vector3();
        let c = new Vector3();
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

    /**
     * return the rotation part of the Matrix3 in Quaternion form
     */
    static toQuaternion(m: Matrix3): Quaternion {
        // from https://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/
        let q = new Quaternion();
        q.w = Math.sqrt(Math.max(0.0, 1.0 + m.a.x + m.b.y + m.c.z )) / 2.0;
        q.x = Math.sqrt(Math.max(0.0, 1.0 + m.a.x - m.b.y - m.c.z )) / 2.0;
        q.y = Math.sqrt(Math.max(0.0, 1.0 - m.a.x + m.b.y - m.c.z )) / 2.0;
        q.z = Math.sqrt(Math.max(0.0, 1.0 - m.a.x - m.b.y + m.c.z )) / 2.0;
        if (m.c.y - m.b.z < 0.0) {
            q.x *= -1.0;
        }
        if (m.a.z - m.c.x < 0.0) {
            q.y *= -1.0;
        }
        if (m.b.x - m.a.y < 0.0) {
            q.z *= -1.0;
        }
        return q;
    }
}

// helper function that keeps an angle expressed in degrees in the range ]-360, 360[
function sanitizeAngleDegrees(v: number): number {
    // in the case v is Infinity or Nan,  let's special case
    if (isNaN(v) || v === Infinity) {
        return 0.0;
    } else if (v === -Infinity) {
        return -0.0;
    } else {
        // bring the value in the range ]-360, 360[
        // if v is < 0 then it will cycle in ]-360, 0]
        // if v is > 0 then it will cycle in [0, 360[
        return v % 360.0;
    }
}

