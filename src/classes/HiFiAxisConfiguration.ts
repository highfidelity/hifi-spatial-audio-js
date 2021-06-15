/**
 * This module pertains to 3D Axis configuation. Modify your 3D axis configuration when constructing a new [[HiFiCommunicator]] object.
 * @packageDocumentation
 */

import { HiFiLogger } from "../utilities/HiFiLogger";
import { Point3D } from "./HiFiAudioAPIData";

export enum HiFiHandedness {
    RightHand = "Right Hand",
    LeftHand = "Left Hand"
}

/**
 * The WorldFrameConfiguration is used to describe the coordinate frame of the World.
 * The HiFiCommunicator uses it to construct a HiFiCoordinateFrameUtil to help do the
 * math between World and HiFi coordinate frames.
 */
export class WorldFrameConfiguration {
    /**
     * The 'forward' direction in the World-frame.
     * Must have length=1 and be orthogonal to 'up'.
     */
    forward: Point3D;

    /**
     * The 'up' direction in the World-frame.
     * Must have length=1 and be orthogonal to 'forward'.
     */
    up: Point3D;

    /**
     * Whether the World-frame is a right- or left-handed coordinate system.
     *
     * How to determine the handedness of the World coordindate system?
     * If Z = vector_cross_product(X, Y) as per the right-hand rule
     * (from your physics or 3D geometry class)
     * then it is right-handed, else it is left-handed.
     */
    handedness: HiFiHandedness;

    constructor(forward: Point3D, up: Point3D, handedness: HiFiHandedness) {
        this.forward = forward;
        this.up = up;
        this.handedness = handedness;
    }

    static isValid(config: WorldFrameConfiguration) {
        // forward and up must be unitary
        let valid = true;
        if (Point3D.dot(config.forward, config.forward) != 1.0) {
            HiFiLogger.error("Invalid axis configuration: forward direction is not unitary");
            valid = false;
        }
        if (Point3D.dot(config.forward, config.forward) != 1.0) {
            HiFiLogger.error("Invalid axis configuration: up direction is not unitary");
            valid = false;
        }
        // forward and up must be orthogonal to each other
        if (Point3D.dot(config.forward, config.up) != 0.0) {
            HiFiLogger.error("Invalid axis configuration: forward and up directions are not orthogonal");
            valid = false;
        }
        return valid;
    }
}
