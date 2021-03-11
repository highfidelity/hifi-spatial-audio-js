/**
 * This module pertains to 3D Axis configuation. Modify your 3D axis configuration when constructing a new [[HiFiCommunicator]] object.
 * @packageDocumentation
 */

import { HiFiLogger } from "../utilities/HiFiLogger";
import { OrientationQuat3D, Point3D, OrientationEuler3DOrder, OrientationEuler3D } from "./HiFiAudioAPIData";

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

/**
 * The axis configuration describes the 3d frame of reference in which are expressed the position and orientation of the HifiCommunicator peers.
 * All position and orientation send or received from the api calls are expected to be expressed using that space convention.
 * On the wire and in the mixer, the HiFi Spatial Audio system is using a single unified convention called 'MixerSpace' which is the same as the 
 * default value, see {@link ourHiFiAxisConfiguration}.
 * 
 * When converting the orientationEuler, to or from the quaternion representation, the Library relies on the HiFiCommunicator's axisConfiguration
 * to apply the expected convention and correct conversion.
 * The 'eulerOrder' field of the axis configuration is used for this conversion.
 * 
 * ⚠ WARNING ⚠ 
 * The axis configuration fields (rightAxis, leftAxis, intoScreenAxis, outOfScreenAxis, upAxis, downAxis, handedness) are not in use yet
 * Only the default value for this fields will result in the expected behavior.
 * The eulerOrder field is working correclty and can be configured at the creation of the HiFiCommunicator
 */
export class HiFiAxisConfiguration {
    rightAxis: HiFiAxes;
    leftAxis: HiFiAxes;

    intoScreenAxis: HiFiAxes;
    outOfScreenAxis: HiFiAxes;

    upAxis: HiFiAxes;
    downAxis: HiFiAxes;

    handedness: HiFiHandedness;

    eulerOrder: OrientationEuler3DOrder;

    constructor({rightAxis, leftAxis, intoScreenAxis, outOfScreenAxis, upAxis, downAxis, handedness, eulerOrder}: {rightAxis: HiFiAxes, leftAxis: HiFiAxes, intoScreenAxis: HiFiAxes, outOfScreenAxis: HiFiAxes, upAxis: HiFiAxes, downAxis: HiFiAxes, handedness: HiFiHandedness, eulerOrder: OrientationEuler3DOrder }) {
        Object.assign(this, { rightAxis, leftAxis, intoScreenAxis, outOfScreenAxis, upAxis, downAxis, handedness, eulerOrder });
    }
}

/**
 * Contains the application's 3D axis configuration. By default:
 * - `+x` is to the right and `-x` is to the left
 * - `+y` is up and `-y` is down
 * - `+z` is back and `-z` is front
 * - The coordinate system is right-handed.
 * - Euler order is `OrientationEuler3DOrder.YawPitchRoll`
 */
export let ourHiFiAxisConfiguration = new HiFiAxisConfiguration({
    rightAxis: HiFiAxes.PositiveX,
    leftAxis: HiFiAxes.NegativeX,
    intoScreenAxis: HiFiAxes.PositiveY,
    outOfScreenAxis: HiFiAxes.NegativeY,
    upAxis: HiFiAxes.PositiveZ,
    downAxis: HiFiAxes.NegativeZ,
    handedness: HiFiHandedness.RightHand,
    eulerOrder: OrientationEuler3DOrder.YawPitchRoll,
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
            HiFiLogger.error(`Invalid axis configuration!\nIntoScreen Axis is ${axisConfiguration.intoScreenAxis}, and OutOfScreen Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveX && axisConfiguration.intoScreenAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nIntoScreen Axis is ${axisConfiguration.intoScreenAxis}, and OutOfScreen Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveY && axisConfiguration.outOfScreenAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nIntoScreen Axis is ${axisConfiguration.intoScreenAxis}, and OutOfScreen Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveY && axisConfiguration.intoScreenAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nIntoScreen Axis is ${axisConfiguration.intoScreenAxis}, and OutOfScreen Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.intoScreenAxis === HiFiAxes.PositiveZ && axisConfiguration.outOfScreenAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nIntoScreen Axis is ${axisConfiguration.intoScreenAxis}, and OutOfScreen Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.outOfScreenAxis === HiFiAxes.PositiveZ && axisConfiguration.intoScreenAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nIntoScreen Axis is ${axisConfiguration.intoScreenAxis}, and OutOfScreen Axis is ${axisConfiguration.outOfScreenAxis}!`);
            isValid = false;
        }
        // END into-screen/out-of-screen axis error checking

        // START up/down axis error checking
        if (axisConfiguration.upAxis === HiFiAxes.PositiveX && axisConfiguration.downAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nUp Axis is ${axisConfiguration.upAxis}, and Down Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.downAxis === HiFiAxes.PositiveX && axisConfiguration.upAxis !== HiFiAxes.NegativeX) {
            HiFiLogger.error(`Invalid axis configuration!\nUp Axis is ${axisConfiguration.upAxis}, and Down Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.upAxis === HiFiAxes.PositiveY && axisConfiguration.downAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nUp Axis is ${axisConfiguration.upAxis}, and Down Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.downAxis === HiFiAxes.PositiveY && axisConfiguration.upAxis !== HiFiAxes.NegativeY) {
            HiFiLogger.error(`Invalid axis configuration!\nUp Axis is ${axisConfiguration.upAxis}, and Down Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }

        if (axisConfiguration.upAxis === HiFiAxes.PositiveZ && axisConfiguration.downAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nUp Axis is ${axisConfiguration.upAxis}, and Down Axis is ${axisConfiguration.downAxis}!`);
            isValid = false;
        }
        if (axisConfiguration.downAxis === HiFiAxes.PositiveZ && axisConfiguration.upAxis !== HiFiAxes.NegativeZ) {
            HiFiLogger.error(`Invalid axis configuration!\nUp Axis is ${axisConfiguration.upAxis}, and Down Axis is ${axisConfiguration.downAxis}!`);
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
     * ⚠ WARNING ⚠ The code in this function IS wrong.
     * TODO: implement the function, just a NO OP at the moment.
     * 
     * @param axisConfiguration 
     * @param inputPoint3D 
     */
    static translatePoint3DToMixerSpace(axisConfiguration: HiFiAxisConfiguration, inputPoint3D: Point3D): Point3D {
        let retval = new Point3D();
        /*
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
        */
        retval = inputPoint3D;
        return retval;
    }

    /**
     * ⚠ WARNING ⚠ The code in this function IS wrong.
     * TODO: implement the function, just a NO OP at the moment.
     * 
     * @param axisConfiguration 
     * @param inputOrientationQuat3D 
     */
    static translatePoint3DFromMixerSpace(axisConfiguration: HiFiAxisConfiguration, mixerPoint3D: Point3D): Point3D {
        let retval = new Point3D();
        retval = mixerPoint3D;
        return retval;
    }

    /**
     * ⚠ WARNING ⚠ The code in this function IS wrong.
     * TODO: implement the function, just a NO OP at the moment.
     * 
     * @param axisConfiguration 
     * @param inputOrientationQuat3D 
     */
    static translateOrientationQuat3DToMixerSpace(axisConfiguration: HiFiAxisConfiguration, inputOrientationQuat3D: OrientationQuat3D): OrientationQuat3D {
        let retval = new OrientationQuat3D();
        retval = inputOrientationQuat3D;
        return retval;
    }

    /**
     * ⚠ WARNING ⚠ The code in this function IS wrong.
     * TODO: implement the function, just a NO OP at the moment.
     * 
     * @param axisConfiguration 
     * @param inputOrientationQuat3D 
     */
    static translateOrientationQuat3DFromMixerSpace(axisConfiguration: HiFiAxisConfiguration, mixerOrientationQuat3D: OrientationQuat3D): OrientationQuat3D {
        let retval = new OrientationQuat3D();
        retval = mixerOrientationQuat3D;
        return retval;
    }
}
