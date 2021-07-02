import { HiFiCommunicator } from "../../../../src/classes/HiFiCommunicator";
import { HiFiConstants } from "../../../../src/constants/HiFiConstants";

test(`the default members of a new HiFiCommunicator instantiation`, () => {
    let newHiFiCommunicator = new HiFiCommunicator();
    expect(newHiFiCommunicator.transmitRateLimitTimeoutMS).toBe(HiFiConstants.DEFAULT_TRANSMIT_RATE_LIMIT_TIMEOUT_MS);
    newHiFiCommunicator.disconnectFromHiFiAudioAPIServer();
});
