declare var HIFI_API_VERSION: string;

import { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, OrientationEuler3D, OrientationQuat3D, Point3D } from "./classes/HiFiAudioAPIData";
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

if (isBrowserContext) {
    exports.apiVersion = HIFI_API_VERSION;
}

exports.communicator = HiFiCommunicator;
exports.connectionStates = HiFiConnectionStates;
exports.userDataStreamingScopes = HiFiUserDataStreamingScopes;

exports.availableUserDataSubscriptionComponents = AvailableUserDataSubscriptionComponents;
exports.userDataSubscription = UserDataSubscription;

exports.receivedAudioAPIData = ReceivedHiFiAudioAPIData;
exports.audioAPIData = HiFiAudioAPIData;
exports.point3D = Point3D;
exports.orientationEuler3D = OrientationEuler3D;
exports.orientationQuat3D = OrientationQuat3D;

exports.logger = HiFiLogger;
exports.logLevel = HiFiLogLevel;

exports.getBestAudioConstraints = getBestAudioConstraints;
exports.preciseInterval = preciseInterval;

exports.constants = HiFiConstants;

exports.axes = HiFiAxes;
exports.handedness = HiFiHandedness;
exports.axisConfiguration = HiFiAxisConfiguration;