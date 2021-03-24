declare var HIFI_API_VERSION: string;

// Check for browser compatibility
import { HiFiUtilities } from "./utilities/HiFiUtilities";
export { HiFiUtilities };
HiFiUtilities.checkBrowserCompatibility();
let apiVersion = typeof (HIFI_API_VERSION) === "string" ? HIFI_API_VERSION : "unknown";
export { apiVersion as hiFiAPIVersion }; 
export { apiVersion }; 


// Verbosity can be good sometimes!
// The first section of `export`s here expose the Client Library's entry points
// using verbose language. This usually means that every entry point is prepented with `HiFi`.
// Doing this helps reduce namespace collisions in user applications.
// Some people don't want to type `HiFi` every time they want to use our Client Library,
// so we also offer shorter synonyms for every Library entry point.
// Scroll down to check out those shorter synonyms.
export { HiFiAudioAPIData, ReceivedHiFiAudioAPIData, OrientationEuler3D, OrientationQuat3D, Point3D, eulerToQuaternion, eulerFromQuaternion} from "./classes/HiFiAudioAPIData";
export { HiFiCommunicator, HiFiConnectionStates, HiFiUserDataStreamingScopes } from "./classes/HiFiCommunicator";
export { AvailableUserDataSubscriptionComponents, UserDataSubscription } from "./classes/HiFiUserDataSubscription";
export { HiFiLogLevel, HiFiLogger } from "./utilities/HiFiLogger";
export { HiFiConstants } from "./constants/HiFiConstants";
export { HiFiAxes, HiFiHandedness, HiFiAxisConfiguration } from "./classes/HiFiAxisConfiguration";

// Here are various explicit exports from within the `HiFiUtilities` class for convenience.
let getBestAudioConstraints = HiFiUtilities.getBestAudioConstraints;
export { getBestAudioConstraints };
let preciseInterval = HiFiUtilities.preciseInterval;
export { preciseInterval };

// Short synonyms for the above start here!
// Please let us know if any of these `exports` cause namespace collisions
// in your application.
export { HiFiCommunicator as Communicator, HiFiConnectionStates as ConnectionStates, HiFiUserDataStreamingScopes as UserDataStreamingScopes } from "./classes/HiFiCommunicator";
export { ReceivedHiFiAudioAPIData as ReceivedAudioAPIData, HiFiAudioAPIData as AudioAPIData } from "./classes/HiFiAudioAPIData";
export { HiFiLogger as Logger, HiFiLogLevel as LogLevel } from "./utilities/HiFiLogger";
export { HiFiUtilities as Utilities } from "./utilities/HiFiUtilities";
export { HiFiConstants as Constants } from "./constants/HiFiConstants";
export { HiFiAxes as Axes, HiFiHandedness as Handedness, HiFiAxisConfiguration as AxisConfiguration } from "./classes/HiFiAxisConfiguration";
