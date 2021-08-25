/**
 * This Module contains a utility for easy transforms from World- to HiFi-frame.
 * @packageDocumentation
 */

import { Matrix3, Quaternion, Vector3 } from "./HiFiMath";

/**
 * HiFi Spatial Audio uses a right-handed Cartesian coordinate system
 * with FORWARD pointing along negative Z-axis and UP along positive Y-axis.
 *
 * If the World uses an incompatible coordinate system then it may be necessary
 * to convert World-frame Position into the HiFi-frame.  HiFiCoordinateFrameUtil
 * is a helper class for making it easy to convert from one frame to another.
 *
 * The World-frame is compatible whith the HiFi-frame IFF:  
 * (1) It is right-handed
 * (2) It uses the Y-axis (positive or negative, doesn't matter) for the UP direction.
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
     * @param isRight - true if World-frame is a right-handed coordinate frame (the default), else false.
     *
     * How to know if your coordinate frame is right- or left-handed?
     * If Z = vector_cross_product(X, Y) as per the right-hand rule
     * (from your physics or 3D geometry class)
     * then it is right-handed, else it must be left-handed.
     */
    constructor(forward: Vector3, up: Vector3, isRight = true) {
        // We assemble a Matrix3: worldToCanonical which transforms World-frame Point3Ds
        // to a hypothentical canonical-frame (e.g. fwd=x-axis, up=y-axis, right=z-axis).
        // It is just the matrix of the three cardinal directions as rows:
        //
        // | <-forward-> |
        // | <-  up   -> |
        // | <- right -> |
        //
        let right = Vector3.cross(forward, up);
        if (!isRight) {
            // Note: for left-handed systems we reflect 'right' to actually be 'left'
            right.negate();
        }
        let worldToCanonical = new Matrix3(forward, up, right);

        // Similarly we create another Matrix3: canonicalToHifi
        // using HiFi's directions (forward, up, and right)
        // but this time we transpose it to get the inverse.
        let canonicalToHifi = new Matrix3(
            new Vector3({x:0, y:0, z:-1}),
            new Vector3({x:0, y:1, z:0}),
            new Vector3({x:1, y:0, z:0}));
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
    WorldPositionToHiFi(position: Vector3): Vector3 {
        return this._worldToHifi.transformVector(position);
    }

    /**
     * @param position - Position in HiFi-frame
     * @returns Position in World-frame.
     */
    HiFiPositionToWorld(position: Vector3): Vector3 {
        return this._hifiToWorld.transformVector(position);
    }

    /**
     * @param orientation - Orientation in World-frame
     * @returns Orientation in HiFi-frame.
     */
    WorldOrientationToHiFi(orientation: Quaternion): Quaternion {
        // The best way to understand this math is to remember:
        // this matrix operates from the LEFT on a hypothetical columnar Vector3 on the RIGHT.
        // which would start in the HiFi-frame and as the three matrices operate on it...
        // (1) it is transformed into the World-frame
        // (2) where it rotated by the world-frame Orientation
        // (3) and finally transformed back into the HiFi-frame

        // newOrientation = worldToHifi * orientation * hifiToWorld
        let m = Matrix3.fromQuaternion(orientation);
        m = Matrix3.multiply(m, this._hifiToWorld);
        m = Matrix3.multiply(this._worldToHifi, m);
        return Matrix3.toQuaternion(m);
    }

    /**
     * @param orientation - Orientation in HiFi-frame
     * @returns Orientation in World-frame.
     */
    HiFiOrientationToWorld(orientation: Quaternion): Quaternion {
        // similar to WorldOrientationToHiFi()...
        let m = Matrix3.fromQuaternion(orientation);
        m = Matrix3.multiply(m, this._worldToHifi);
        m = Matrix3.multiply(this._hifiToWorld, m);
        return Matrix3.toQuaternion(m);
    }

    /**
     * Some World-frame configurations are 100% compatible with the HiFi-Frame and
     * don't require any transform: the audio will sound correct using World-frame
     * coordinates.  The World-frame is 100% compatible if the following conditions
     * are met:
     * (1) World-frame is a right-handed coordinate system
     * (2) World-frame UP is parallel to the y-axis (doesn't matter whether it points
     *     along the + or - y-direction).
     *
     * @returns True if the World-frame config satisfies both of the above conditions.
     */
    WorldIsCompatibleWithHifi() : boolean {
        // check to see if both world and hifi use Y-axis as up
        let ALMOST_ZERO = 1.0e-3;
        let y_axis = new Vector3({x: 0.0, y: 1.0, z: 0.0});
        let hifi_y = this._worldToHifi.transformVector(y_axis);
        if (Math.abs(1.0 - Math.abs(Vector3.dot(y_axis, hifi_y))) > ALMOST_ZERO) {
            // world-up is not along +/- y-axis
            return false;
        }

        // check to see if Z cross X points along +Y
        // which only happens in a right-handed coordinate frame
        let x_axis = new Vector3({x: 1.0, y: 0.0, z: 0.0});
        let z_axis = new Vector3({x: 0.0, y: 0.0, z: 1.0});
        let hifi_x = this._worldToHifi.transformVector(x_axis);
        let hifi_z = this._worldToHifi.transformVector(z_axis);
        let hifi_z_cross_x = Vector3.cross(hifi_z, hifi_x);
        return Math.abs(1.0 - Vector3.dot(hifi_z_cross_x, hifi_y)) < ALMOST_ZERO;
    }
}
