import { HiFiAudioAPIData, OrientationEuler3D, Point3D } from "../../../src/classes/HiFiAudioAPIData";

describe('Point3D', () => {
    test('verifies default members of a new Point3D are null', () => {
        let newPoint3D = new Point3D();
        expect(newPoint3D.x).toBeNull();
        expect(newPoint3D.y).toBeNull();
        expect(newPoint3D.z).toBeNull();
    });
    
    test('allows us to only set the x component of a new Point3D', () => {
        let newPoint3D = new Point3D({x: 5});
        expect(newPoint3D.x).toBe(5);
        expect(newPoint3D.y).toBeNull();
        expect(newPoint3D.z).toBeNull();
    });
});

describe('OrientationEuler3D', () => {
    test('verifies default members of a new OrientationEuler3D are 0', () => {
        let newOrientationEuler3D = new OrientationEuler3D();
        expect(newOrientationEuler3D.pitchDegrees).toBe(0);
        expect(newOrientationEuler3D.yawDegrees).toBe(0);
        expect(newOrientationEuler3D.rollDegrees).toBe(0);
    });
    
    test('allows us to only set the pitchDegrees component of a new OrientationEuler3D', () => {
        let newOrientationEuler3D = new OrientationEuler3D({pitchDegrees: 25});
        expect(newOrientationEuler3D.pitchDegrees).toBe(25);
        expect(newOrientationEuler3D.yawDegrees).toBe(0);
        expect(newOrientationEuler3D.rollDegrees).toBe(0);
    });
});

describe('HiFiAudioAPIData', () => {
    test('verifies default members of a new HiFiAudioAPIData are null', () => {
        let newHiFiAudioAPIData = new HiFiAudioAPIData();
        expect(newHiFiAudioAPIData.position).toBeNull();
        expect(newHiFiAudioAPIData.orientationEuler).toBeNull();
        expect(newHiFiAudioAPIData.orientationQuat).toBeNull();
    });

    test('the HiFiAudioAPIData.diff() function', () => {
        let data1 = new HiFiAudioAPIData({
            position: new Point3D({x: 0, y: 4})
        });
        let data2 = new HiFiAudioAPIData();

        let diff1 = data1.diff(data2);
        expect(diff1.position).toBeNull();
        expect(diff1.orientationEuler).toBeNull();
        expect(diff1.orientationQuat).toBeNull();
        
        let diff2 = data2.diff(data1);
        expect(diff2.position.x).toBe(0);
        expect(diff2.position.y).toBe(4);
        expect(diff2.position.z).toBeNull();
        expect(diff2.orientationEuler).toBeNull();
        expect(diff2.orientationQuat).toBeNull();
    });
});