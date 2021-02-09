/**
 * This module pertains to 3D Axis configuation. Modify your 3D axis configuration when constructing a new [[HiFiCommunicator]] object.
 * @packageDocumentation
 */

import { HiFiLogger } from "../utilities/HiFiLogger";
import { OrientationEuler3D, Point3D } from "./HiFiAudioAPIData";

export enum HiFiAxes {
    PositiveX = "Positive X",
    NegativeX = "Negative X",
    PositiveY = "Positive Y",
    NegativeY = "Negative Y",
    PositiveZ = "Positive Z",
    NegativeZ = "Negative Z"
}

export enum HiFiHandedness {
    RightHand = "Right Hand",
    LeftHand = "Left Hand"
}

export class HiFiAxisConfiguration {
    rightAxis: HiFiAxes;
    leftAxis: HiFiAxes;

    intoScreenAxis: HiFiAxes;
    outOfScreenAxis: HiFiAxes;

    upAxis: HiFiAxes;
    downAxis: HiFiAxes;

    handedness: HiFiHandedness;

    constructor({rightAxis, leftAxis, intoScreenAxis, outOfScreenAxis, upAxis, downAxis, handedness }: {rightAxis: HiFiAxes, leftAxis: HiFiAxes, intoScreenAxis: HiFiAxes, outOfScreenAxis: HiFiAxes, upAxis: HiFiAxes, downAxis: HiFiAxes, handedness: HiFiHandedness }) {
        Object.assign(this, { rightAxis, leftAxis, intoScreenAxis, outOfScreenAxis, upAxis, downAxis, handedness });
    }
}

/**
 * Contains the application's 3D axis configuration. By default:
 * - `+x` is to the right and `-x` is to the left
 * - `+y` is into the screen and `-y` is out of the screen towards the user
 * - `+z` is up and `-z` is down
 * - The coordinate system is right-handed.
 */
export let ourHiFiAxisConfiguration = new HiFiAxisConfiguration({
    rightAxis: HiFiAxes.PositiveX,
    leftAxis: HiFiAxes.NegativeX,
    intoScreenAxis: HiFiAxes.PositiveY,
    outOfScreenAxis: HiFiAxes.NegativeY,
    upAxis: HiFiAxes.PositiveZ,
    downAxis: HiFiAxes.NegativeZ,
    handedness: HiFiHandedness.RightHand,
});

export class HiFiAxisUtilities {
    static verify(axisConfiguration: HiFiAxisConfiguration) {
        let isValid = true;

        // START left/right axis error checking
        if (axisConfiguration.rightAxis === HiFiAxes.PositiveX && axisConfiguration.leftAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.rightAxis}, and Left Axis is ${axisConfiguration.leftAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.leftAxis === HiFiAxes.PositiveX && axisConfiguration.rightAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.rightAxis}, and Left Axis is ${axisConfiguration.leftAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.rightAxis === HiFiAxes.PositiveY && axisConfiguration.leftAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.rightAxis}, and Left Axis is ${axisConfiguration.leftAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.leftAxis === HiFiAxes.PositiveY && axisConfiguration.rightAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.rightAxis}, and Left Axis is ${axisConfiguration.leftAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.rightAxis === HiFiAxes.PositiveZ && axisConfiguration.leftAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.rightAxis}, and Left Axis is ${axisConfiguration.leftAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.leftAxis === HiFiAxes.PositiveZ && axisConfiguration.rightAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.rightAxis}, and Left Axis is ${axisConfiguration.leftAxis}!`);
            isValid = false;
        }
        // END left/right axis error checking

        // START into-screen/out-of-screen axis error checking
        if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveX && axisConfiguration.outOfScreenAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.intoScreenAxis}, and Left Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveX && axisConfiguration.intoScreenAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.intoScreenAxis}, and Left Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveY && axisConfiguration.outOfScreenAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.intoScreenAxis}, and Left Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveY && axisConfiguration.intoScreenAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.intoScreenAxis}, and Left Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveZ && axisConfiguration.outOfScreenAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.intoScreenAxis}, and Left Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveZ && axisConfiguration.intoScreenAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.intoScreenAxis}, and Left Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        // END into-screen/out-of-screen axis error checking

        // START up/down axis error checking
        if (axisConfiguration.upAxis === HiFiAxes.PositiveX && axisConfiguration.downAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.upAxis}, and Left Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.downAxis === HiFiAxes.PositiveX && axisConfiguration.upAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.upAxis}, and Left Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.upAxis === HiFiAxes.PositiveY && axisConfiguration.downAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.upAxis}, and Left Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.downAxis === HiFiAxes.PositiveY && axisConfiguration.upAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.upAxis}, and Left Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.upAxis === HiFiAxes.PositiveZ && axisConfiguration.downAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.upAxis}, and Left Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.downAxis === HiFiAxes.PositiveZ && axisConfiguration.upAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nRight Axis is ${axisConfiguration.upAxis}, and Left Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }
        // END up/down axis error checking

        if (!(axisConfiguration.handedness === HiFiHandedness.RightHand || axisConfiguration.handedness === HiFiHandedness.LeftHand)) {
            HiFiLogger.error(`Invalid axis configuration!\nHandedness is ${axisConfiguration.handedness}!`);
            isValid = false;
        }

        return isValid;
    }

    /**
     * ⚠ WARNING ⚠ The code in this function might be wrong, because 3D math is really hard. The default configuration works fine,
     * but it's challenging to verify that other configurations work as expected until we have a better 3D example app.
     * TODO: Verify that this is actually doing what we want for it to be doing.
     * 
     * The HiFi Axis Configuration must have been verified using `HiFiAxisConfiguration.verify()` before this function is called.
     * Otherwise, undefined behavior will occur.
     * 
     * @param axisConfiguration 
     * @param inputPoint3D 
     */
    static translatePoint3DToMixerSpace(axisConfiguration: HiFiAxisConfiguration, inputPoint3D: Point3D): Point3D {
        let retval = new Point3D();

        let inputXIsNumber = typeof (inputPoint3D.x) === "number";
        let inputYIsNumber = typeof (inputPoint3D.y) === "number";
        let inputZIsNumber = typeof (inputPoint3D.z) === "number";

        if (axisConfiguration.rightAxis === HiFiAxes.PositiveX && inputXIsNumber) {
            retval.x = inputPoint3D.x;
        } else if (axisConfiguration.leftAxis === HiFiAxes.PositiveX && inputXIsNumber) {
            retval.x = -inputPoint3D.x;
        } else if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveX && inputYIsNumber) {
            retval.x = inputPoint3D.y;
        } else if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveX && inputYIsNumber) {
            retval.x = -inputPoint3D.y;
        } else if (axisConfiguration.upAxis === HiFiAxes.PositiveX && inputZIsNumber) {
            retval.x = inputPoint3D.z;
        } else if (axisConfiguration.downAxis === HiFiAxes.PositiveX && inputZIsNumber) {
            retval.x = -inputPoint3D.z;
        }

        if (axisConfiguration.rightAxis === HiFiAxes.PositiveY && inputXIsNumber) {
            retval.y = inputPoint3D.x;
        } else if (axisConfiguration.leftAxis === HiFiAxes.PositiveY && inputXIsNumber) {
            retval.y = -inputPoint3D.x;
        } else if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveY && inputYIsNumber) {
            retval.y = inputPoint3D.y;
        } else if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveY && inputYIsNumber) {
            retval.y = -inputPoint3D.y;
        } else if (axisConfiguration.upAxis === HiFiAxes.PositiveY && inputZIsNumber) {
            retval.y = inputPoint3D.z;
        } else if (axisConfiguration.downAxis === HiFiAxes.PositiveY && inputZIsNumber) {
            retval.y = -inputPoint3D.z;
        }

        if (axisConfiguration.rightAxis === HiFiAxes.PositiveZ && inputXIsNumber) {
            retval.z = inputPoint3D.x;
        } else if (axisConfiguration.leftAxis === HiFiAxes.PositiveZ && inputXIsNumber) {
            retval.z = -inputPoint3D.x;
        } else if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveZ && inputYIsNumber) {
            retval.z = inputPoint3D.y;
        } else if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveZ && inputYIsNumber) {
            retval.z = -inputPoint3D.y;
        } else if (axisConfiguration.upAxis === HiFiAxes.PositiveZ && inputZIsNumber) {
            retval.z = inputPoint3D.z;
        } else if (axisConfiguration.downAxis === HiFiAxes.PositiveZ && inputZIsNumber) {
            retval.z = -inputPoint3D.z;
        }
            
        return retval;
    }

    /**
     * ⚠ WARNING ⚠ The code in this function might be wrong, because 3D math is really hard. The default configuration works fine,
     * but it's challenging to verify that other configurations work as expected until we have a better 3D example app.
     * TODO: Verify that this is actually doing what we want for it to be doing.
     * 
     * @param axisConfiguration 
     * @param inputOrientationEuler3D 
     */
    static translateOrientationEuler3DToMixerSpace(axisConfiguration: HiFiAxisConfiguration, inputOrientationEuler3D: OrientationEuler3D): OrientationEuler3D {
        let retval = new OrientationEuler3D();

        if (typeof (inputOrientationEuler3D.pitchDegrees) !== "number") {
            inputOrientationEuler3D.pitchDegrees = 0;
        }
        if (typeof (inputOrientationEuler3D.yawDegrees) !== "number") {
            inputOrientationEuler3D.yawDegrees = 0;
        }
        if (typeof (inputOrientationEuler3D.rollDegrees) !== "number") {
            inputOrientationEuler3D.rollDegrees = 0;
        }

        if (axisConfiguration.handedness === HiFiHandedness.RightHand) {
            retval.pitchDegrees = inputOrientationEuler3D.pitchDegrees;
            retval.yawDegrees = inputOrientationEuler3D.yawDegrees;
            retval.rollDegrees = inputOrientationEuler3D.rollDegrees;
        } else if (axisConfiguration.handedness === HiFiHandedness.LeftHand) {
            retval.pitchDegrees = inputOrientationEuler3D.pitchDegrees;
            retval.yawDegrees = -inputOrientationEuler3D.yawDegrees;
            retval.rollDegrees = inputOrientationEuler3D.rollDegrees;
        }

        return retval;
    }
}
