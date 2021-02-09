import { HiFiMixerSession } from "../../../src/classes/HiFiMixerSession";

test(`brand new mixer session can't connect`, () => {
    let newMixerSession = new HiFiMixerSession({});
    return expect(newMixerSession.connect()).rejects.toBeDefined();
});