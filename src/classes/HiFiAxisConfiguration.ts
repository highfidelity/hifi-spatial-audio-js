/**
 * This module pertains to 3D Axis configuation. Modify your 3D axis configuration when constructing a new [[HiFiCommunicator]] object.
 * @packageDocumentation
 */

import { HiFiLogger } from "../utilities/HiFiLogger";
import { OrientationQuat3D, Point3D, OrientationEuler3DOrder, OrientationEuler3D } from "./HiFiAudioAPIData";

export enum CoordinateAxesConvention {
    // Yup 8 possibilities
    // 4 Right handed Yup
    X_right_Y_up_Z_back_RH = 0, //"YUP_0_RH", // Same as Mixer space
    X_back_Y_up_Z_left_RH,     // = "YUP_1_RH", // <=> rotate around Y 90deg    : x z => +z -x 
    X_left_Y_up_Z_front_RH,     // = "YUP_2_RH", // <=> rotate around Y 180deg  : x z => -x -z 
    X_front_Y_up_Z_right_RH,     // = "YUP_3_RH", // <=> rotate around Y -90deg : x z => -z +x 

    // 4 Left handed Yup
    X_right_Y_up_Z_front_LH,     // = "YUP_0_LH", // YUO_0_RH xyz <=> X=x Y=y Z=-z
    X_front_Y_up_Z_left_LH,     // = "YUP_1_LH", // YUP_0_LH <=> rotate around Y 90deg 
    X_left_Y_up_Z_back_LH,     // = "YUP_2_LH", // YUP_0_LH <=> rotate around Y 180deg
    X_back_Y_up_Z_right_LH,     // = "YUP_3_LH", // YUP_0_LH <=> rotate around Y -90deg

    // Zup: Same as Yup, y becomes Z, x becomes Y, and z becomes X
    X_back_Y_right_Z_up_RH,     // = "ZUP_0_RH",   // YUO_0_RH xyz <=> X=z Y=x Z=y
    X_left_Y_back_Z_up_RH,     // = "ZUP_1_RH",    // ZUP_0_RH <=> rotate around Z 90deg
    X_front_Y_left_Z_up_RH,     // = "ZUP_2_RH",   // ZUP_0_RH <=> rotate around Z 180deg
    X_right_Y_front_Z_up_RH,     // = "ZUP_3_RH",  // ZUP_0_RH <=> rotate around Z -90deg

    X_front_Y_right_Z_up_LH,     // = "ZUP_0_LH",   // YUO_0_LH xyz <=> X=z Y=x Z=y
    X_left_Y_front_Z_up_LH,     // = "ZUP_1_LH",    // ZUP_0_LH <=> rotate around Z 90deg
    X_back_Y_left_Z_up_LH,     // = "ZUP_2_LH",     // ZUP_0_LH <=> rotate around Z 180deg
    X_right_Y_back_Z_up_LH,     // = "ZUP_3_LH",    // ZUP_0_LH <=> rotate around Z -90deg


    // same with X up ?
    // same with -X up ?
    // same with -Y up ?
    // same with -Z up ?
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
    static ConvertPosFromDefaultSpace: Array< (p: Point3D) => Point3D> = [
        (p: Point3D) => { return p; },
        (p: Point3D) => { return { x: +p.z, y: p.y, z: -p.x}; },
        (p: Point3D) => { return { x: -p.x, y: p.y, z: -p.z}; },
        (p: Point3D) => { return { x: -p.z, y: p.y, z: +p.x}; },
        
        (p: Point3D) => { return { x: +p.x, y: p.y, z: -p.z}; },
        (p: Point3D) => { return { x: -p.z, y: p.y, z: -p.x}; },
        (p: Point3D) => { return { x: -p.x, y: p.y, z: +p.z}; },
        (p: Point3D) => { return { x: +p.z, y: p.y, z: +p.x}; },
    ];
    static ConvertPosToDefaultSpace: Array< (p: Point3D) => Point3D> = [
        (p: Point3D) => { return p; },
        (p: Point3D) => { return { x: -p.z, y: p.y, z: +p.x}; },
        (p: Point3D) => { return { x: +p.x, y: p.y, z: +p.z}; },
        (p: Point3D) => { return { x: +p.z, y: p.y, z: -p.x}; },
        
        (p: Point3D) => { return { x: -p.x, y: p.y, z: +p.z}; },
        (p: Point3D) => { return { x: +p.z, y: p.y, z: +p.x}; },
        (p: Point3D) => { return { x: +p.x, y: p.y, z: -p.z}; },
        (p: Point3D) => { return { x: -p.z, y: p.y, z: -p.x}; },
    ];
    static ConvertQuatFromDefaultSpace: Array< (q: OrientationQuat3D) => OrientationQuat3D> = [
        (q: OrientationQuat3D) => { return q; },

    ];
    static ConvertQuatToDefaultSpace: Array< (q: OrientationQuat3D) => OrientationQuat3D> = [
        (q: OrientationQuat3D) => { return q; },

    ];

    axesConvention: CoordinateAxesConvention;
    eulerOrder: OrientationEuler3DOrder;

    _convertPosFromDefaultSpace: (p: Point3D) => Point3D;
    _convertPosToDefaultSpace: (p: Point3D) => Point3D;
    _convertQuatFromDefaultSpace: (q: OrientationQuat3D) => OrientationQuat3D;
    _convertQuatToDefaultSpace: (q: OrientationQuat3D) => OrientationQuat3D;
    
    constructor({axesConvention, eulerOrder}: {axesConvention: CoordinateAxesConvention, eulerOrder: OrientationEuler3DOrder }) {
        Object.assign(this, { axesConvention, eulerOrder});
        this._convertPosFromDefaultSpace = HiFiAxisConfiguration.ConvertPosFromDefaultSpace[axesConvention];
        this._convertPosToDefaultSpace = HiFiAxisConfiguration.ConvertPosToDefaultSpace[axesConvention];
        this._convertQuatFromDefaultSpace = HiFiAxisConfiguration.ConvertQuatFromDefaultSpace[axesConvention];
        this._convertQuatToDefaultSpace = HiFiAxisConfiguration.ConvertQuatToDefaultSpace[axesConvention];
    }

  /*  constructor({rightAxis, leftAxis, intoScreenAxis, outOfScreenAxis, upAxis, downAxis, handedness, eulerOrder}: {rightAxis: HiFiAxes, leftAxis: HiFiAxes, intoScreenAxis: HiFiAxes, outOfScreenAxis: HiFiAxes, upAxis: HiFiAxes, downAxis: HiFiAxes, handedness: HiFiHandedness, eulerOrder: OrientationEuler3DOrder }) {
        Object.assign(this, { rightAxis, leftAxis, intoScreenAxis, outOfScreenAxis, upAxis, downAxis, handedness, eulerOrder });
    }*/
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
    axesConvention: CoordinateAxesConvention.X_right_Y_up_Z_back_RH,
    eulerOrder: OrientationEuler3DOrder.YawPitchRoll,
});

export class HiFiAxisUtilities {
    static verify(axisConfiguration: HiFiAxisConfiguration) {
        let isValid = true;

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
        /*let retval = new Point3D();
        retval = inputPoint3D;
        return retval;
*/
        return axisConfiguration._convertPosToDefaultSpace(inputPoint3D);

    }

    /**
     * ⚠ WARNING ⚠ The code in this function IS wrong.
     * TODO: implement the function, just a NO OP at the moment.
     * 
     * @param axisConfiguration 
     * @param inputOrientationQuat3D 
     */
    static translatePoint3DFromMixerSpace(axisConfiguration: HiFiAxisConfiguration, mixerPoint3D: Point3D): Point3D {
       // let retval = new Point3D();
       // retval = mixerPoint3D;

        return axisConfiguration._convertPosFromDefaultSpace(mixerPoint3D);
       // return retval;
    }

    /**
     * ⚠ WARNING ⚠ The code in this function IS wrong.
     * TODO: implement the function, just a NO OP at the moment.
     * 
     * @param axisConfiguration 
     * @param inputOrientationQuat3D 
     */
    static translateOrientationQuat3DToMixerSpace(axisConfiguration: HiFiAxisConfiguration, inputOrientationQuat3D: OrientationQuat3D): OrientationQuat3D {
      /*  let retval = new OrientationQuat3D();
        retval = inputOrientationQuat3D;
        return retval;*/

        return axisConfiguration._convertQuatToDefaultSpace(inputOrientationQuat3D);

    }

    /**
     * ⚠ WARNING ⚠ The code in this function IS wrong.
     * TODO: implement the function, just a NO OP at the moment.
     * 
     * @param axisConfiguration 
     * @param inputOrientationQuat3D 
     */
    static translateOrientationQuat3DFromMixerSpace(axisConfiguration: HiFiAxisConfiguration, mixerOrientationQuat3D: OrientationQuat3D): OrientationQuat3D {
      /*  let retval = new OrientationQuat3D();
        retval = mixerOrientationQuat3D;
        return retval;*/
        return axisConfiguration._convertQuatFromDefaultSpace(mixerOrientationQuat3D);
    }
}
