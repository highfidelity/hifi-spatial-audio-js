import { HiFiMixerSession } from "../../../../src/classes/HiFiMixerSession";
import { HiFiConnectionStates, HiFiConnectionAttemptResult } from "../../../../src/classes/HiFiCommunicator";
import { sleep } from '../../../testUtilities/testUtils';

test(`brand new mixer session can't connect`, async () => {

    const stateChangeCallback = jest.fn();
    let newMixerSession = new HiFiMixerSession({
    onConnectionStateChanged: stateChangeCallback
    });
    const failureResult:HiFiConnectionAttemptResult = {
        "error": "Couldn't connect: `this.webRTCAddress` is falsey!",
        "success": false,
        disableReconnect: false,
    };
    const disconnectResult:HiFiConnectionAttemptResult = {
        "error": "Successfully disconnected",
        "success": true,
        disableReconnect: false,
    };
    newMixerSession.connectToHiFiMixer({ webRTCSessionParams: {} });
    await sleep(1000);
    expect(stateChangeCallback).toHaveBeenCalledTimes(2);
    expect(stateChangeCallback).toHaveBeenCalledWith(HiFiConnectionStates.Failed, failureResult);
    expect(stateChangeCallback).toHaveBeenCalledWith(HiFiConnectionStates.Disconnected, disconnectResult);
});
