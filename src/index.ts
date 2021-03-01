declare var HIFI_API_VERSION: string;

import { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, OrientationEuler3D, OrientationQuat3D, Point3D, yawPitchRollToQuaternion, yawPitchRollFromQuaternion} from "./classes/HiFiAudioAPIData";
import { HiFiCommunicator, HiFiConnectionStates, HiFiUserDataStreamingScopes } from "./classes/HiFiCommunicator";
import { AvailableUserDataSubscriptionComponents, UserDataSubscription } from "./classes/HiFiUserDataSubscription";
import { HiFiLogLevel, HiFiLogger } from "./utilities/HiFiLogger";
import { getBestAudioConstraints, preciseInterval } from "./utilities/HiFiUtilities";
import { HiFiConstants } from "./constants/HiFiConstants";
import { HiFiAxes, HiFiHandedness, HiFiAxisConfiguration } from "./classes/HiFiAxisConfiguration";

let isBrowserContext = typeof self !== 'undefined';
if (isBrowserContext) {
    exports.HiFiAPIVersion = HIFI_API_VERSION;
}

exports.HiFiCommunicator = HiFiCommunicator;
exports.HiFiConnectionStates = HiFiConnectionStates;
exports.HiFiUserDataStreamingScopes = HiFiUserDataStreamingScopes;

exports.AvailableUserDataSubscriptionComponents = AvailableUserDataSubscriptionComponents;
exports.UserDataSubscription = UserDataSubscription;

exports.ReceivedHiFiAudioAPIData = ReceivedHiFiAudioAPIData;
exports.HiFiAudioAPIData = HiFiAudioAPIData;
exports.Point3D = Point3D;
exports.OrientationEuler3D = OrientationEuler3D;
exports.OrientationQuat3D = OrientationQuat3D;
exports.yawPitchRollToQuaternion = yawPitchRollToQuaternion;
exports.yawPitchRollFromQuaternion = yawPitchRollFromQuaternion;

exports.HiFiLogger = HiFiLogger;
exports.HiFiLogLevel = HiFiLogLevel;

exports.getBestAudioConstraints = getBestAudioConstraints;
exports.preciseInterval = preciseInterval;

exports.HiFiConstants = HiFiConstants;

exports.HiFiAxes = HiFiAxes;
exports.HiFiHandedness = HiFiHandedness;
exports.HiFiAxisConfiguration = HiFiAxisConfiguration;