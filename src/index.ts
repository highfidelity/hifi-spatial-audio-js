declare var HIFI_API_VERSION: string;

// Check for browser compatibility
import { checkBrowserCompatibility } from "./utilities/HiFiUtilities";
let isBrowserContext = typeof self !== 'undefined';
if (isBrowserContext) {
    exports.HiFiAPIVersion = HIFI_API_VERSION;
    exports.apiVersion = HIFI_API_VERSION;
    exports.checkBrowserCompatibility = checkBrowserCompatibility;
    checkBrowserCompatibility();
}

import { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, OrientationEuler3D, OrientationQuat3D, Point3D, eulerToQuaternion, eulerFromQuaternion} from "./classes/HiFiAudioAPIData";
import { HiFiCommunicator, HiFiConnectionStates, HiFiUserDataStreamingScopes } from "./classes/HiFiCommunicator";
import { AvailableUserDataSubscriptionComponents, UserDataSubscription } from "./classes/HiFiUserDataSubscription";
import { HiFiLogLevel, HiFiLogger } from "./utilities/HiFiLogger";
import { getBestAudioConstraints, preciseInterval } from "./utilities/HiFiUtilities";
import { HiFiConstants } from "./constants/HiFiConstants";
import { HiFiAxes, HiFiHandedness, HiFiAxisConfiguration } from "./classes/HiFiAxisConfiguration";

// Verbosity can be good sometimes!
// The first section of `exports` here expose the Client Library's entry points
// using verbose language. This usually means that every entry point is prepented with `HiFi`.
// Doing this helps reduce namespace collisions in user applications.
// Some people don't want to type `HiFi` every time they want to use our Client Library,
// so we also offer shorter synonyms for every Library entry point.
// Scroll down to check out those shorter synonyms.

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
exports.eulerToQuaternion = eulerToQuaternion;
exports.eulerFromQuaternion = eulerFromQuaternion;

exports.HiFiLogger = HiFiLogger;
exports.HiFiLogLevel = HiFiLogLevel;

exports.getBestAudioConstraints = getBestAudioConstraints;
exports.preciseInterval = preciseInterval;

exports.HiFiConstants = HiFiConstants;

exports.HiFiAxes = HiFiAxes;
exports.HiFiHandedness = HiFiHandedness;
exports.HiFiAxisConfiguration = HiFiAxisConfiguration;


// Short synonyms for the above start here!
// Please let us know if any of these `exports` cause namespace collisions
// in your application.

exports.Communicator = HiFiCommunicator;
exports.ConnectionStates = HiFiConnectionStates;
exports.UserDataStreamingScopes = HiFiUserDataStreamingScopes;

exports.AvailableUserDataSubscriptionComponents = AvailableUserDataSubscriptionComponents;
exports.UserDataSubscription = UserDataSubscription;

exports.ReceivedAudioAPIData = ReceivedHiFiAudioAPIData;
exports.AudioAPIData = HiFiAudioAPIData;
exports.Point3D = Point3D;
exports.OrientationEuler3D = OrientationEuler3D;
exports.OrientationQuat3D = OrientationQuat3D;

exports.Logger = HiFiLogger;
exports.LogLevel = HiFiLogLevel;

exports.getBestAudioConstraints = getBestAudioConstraints;
exports.preciseInterval = preciseInterval;

exports.Constants = HiFiConstants;

exports.Axes = HiFiAxes;
exports.Handedness = HiFiHandedness;
exports.AxisConfiguration = HiFiAxisConfiguration;