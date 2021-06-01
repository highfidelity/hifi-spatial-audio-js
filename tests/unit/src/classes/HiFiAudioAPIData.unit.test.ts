import { HiFiAudioAPIData } from "../../../../src/classes/HiFiAudioAPIData";

describe('HiFiAudioAPIData', () => {
    test('verifies default members of a new HiFiAudioAPIData are null', () => {
        let newHiFiAudioAPIData = new HiFiAudioAPIData();
        expect(newHiFiAudioAPIData.position).toBeNull();
        expect(newHiFiAudioAPIData.orientationQuat).toBeNull();
        expect(newHiFiAudioAPIData.orientationEuler).toBeNull();
    });

    test('verifies default members of a new HiFiAudioAPIData are null', () => {
        let newHiFiAudioAPIData = new HiFiAudioAPIData({
            position: undefined,
            orientationEuler: undefined
        });
        expect(newHiFiAudioAPIData.position).toBeNull();
        expect(newHiFiAudioAPIData.orientationQuat).toBeNull();
        expect(newHiFiAudioAPIData.orientationEuler).toBeNull();
    });
});
