import { HiFiAudioAPIData } from "../../../../src/classes/HiFiAudioAPIData";

describe('HiFiAudioAPIData', () => {
    test('verifies default members of a new HiFiAudioAPIData are null', () => {
        let newHiFiAudioAPIData = new HiFiAudioAPIData();
        expect(newHiFiAudioAPIData.position).toBeNull();
        expect(newHiFiAudioAPIData.orientation).toBeNull();
    });

    test('verifies default members of a new HiFiAudioAPIData are null', () => {
        let newHiFiAudioAPIData = new HiFiAudioAPIData({
            position: undefined,
        });
        expect(newHiFiAudioAPIData.position).toBeNull();
        expect(newHiFiAudioAPIData.orientation).toBeNull();
    });
});
