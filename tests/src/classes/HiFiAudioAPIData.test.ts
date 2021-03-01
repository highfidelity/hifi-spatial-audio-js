import { HiFiAudioAPIData, OrientationQuat3D, OrientationEuler3D, Point3D, yawPitchRollToQuaternion, yawPitchRollFromQuaternion } from "../../../src/classes/HiFiAudioAPIData";

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

describe('OrientationQuat3D', () => {
    test('verifies default members of a new OrientationQuat3D are 1 0 0 0', () => {
        let newOrientationQuat3D = new OrientationQuat3D();
        expect(newOrientationQuat3D.w).toBe(1);
        expect(newOrientationQuat3D.x).toBe(0);
        expect(newOrientationQuat3D.y).toBe(0);
        expect(newOrientationQuat3D.z).toBe(0);
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

function test_yawPitchRollFromQuaternion(
    inEuler: {P?: number, Y?: number, R?: number},
    outQuat: {w: number, x: number, y: number, z: number}) {
    let euler3D = new OrientationEuler3D({pitchDegrees: inEuler.P, yawDegrees: inEuler.Y, rollDegrees: inEuler.R});
    expect(euler3D.pitchDegrees).toBe(inEuler.P ?? 0);
    expect(euler3D.yawDegrees).toBe(inEuler.Y ?? 0);
    expect(euler3D.rollDegrees).toBe(inEuler.R ?? 0);

    let newOrientationQuat3D = yawPitchRollToQuaternion(euler3D);
    expect(newOrientationQuat3D.w).toBeCloseTo(outQuat.w, 5);
    expect(newOrientationQuat3D.x).toBeCloseTo(outQuat.x, 5);
    expect(newOrientationQuat3D.y).toBeCloseTo(outQuat.y, 5);
    expect(newOrientationQuat3D.z).toBeCloseTo(outQuat.z, 5);

    let newOrientationEuler3D = yawPitchRollFromQuaternion(newOrientationQuat3D);
    expect(newOrientationEuler3D.pitchDegrees).toBeCloseTo(inEuler.P ?? 0, 5);
    expect(newOrientationEuler3D.yawDegrees).toBeCloseTo(inEuler.Y ?? 0, 5);
    expect(newOrientationEuler3D.rollDegrees).toBeCloseTo(inEuler.R ?? 0, 5);   
}

describe('Orientation_EulerToFromQuat', () => {
    test('verifies yawPitchRollToOrientation identity', () => {
        let euler3D = new OrientationEuler3D();
        let newOrientationQuat3D = yawPitchRollToQuaternion(euler3D);
        expect(newOrientationQuat3D.w).toBe(1);
        expect(newOrientationQuat3D.x).toBe(0);
        expect(newOrientationQuat3D.y).toBe(0);
        expect(newOrientationQuat3D.z).toBe(0);

        let newOrientationEuler3D = yawPitchRollFromQuaternion(newOrientationQuat3D);
        expect(newOrientationEuler3D.pitchDegrees).toBe(0);
        expect(newOrientationEuler3D.yawDegrees).toBeCloseTo(0);
        expect(newOrientationEuler3D.rollDegrees).toBe(0);

        test_yawPitchRollFromQuaternion( {}, {w: 1, x: 0, y: 0, z: 0});
    });
    test('verifies yawPitchRollToOrientation Pitch:90', () => {
        test_yawPitchRollFromQuaternion( {P: 90}, {w: 0.7071067811865476, x: 0.7071067811865475, y: 0, z: 0});
    });
    test('verifies yawPitchRollToOrientation Yaw:90', () => {
        test_yawPitchRollFromQuaternion( {Y: 90}, {w: 0.7071067811865476, x: 0, y: 0.7071067811865475, z: 0});
    });
    test('verifies yawPitchRollToOrientation Roll:90', () => {
        test_yawPitchRollFromQuaternion( {R: 90}, {w: 0.7071067811865476, x: 0, y: 0, z: 0.7071067811865475});
    });
    test('verifies yawPitchRollToOrientation Yaw:30, Pitch:90', () => {
        test_yawPitchRollFromQuaternion( {Y: 30, P: 90}, {w: 0.6830127018922194, x: 0.6830127018922193, y: 0.18301270189221933, z: 0.1830127018922193});
    });

});

describe('HiFiAudioAPIData', () => {
    test('verifies default members of a new HiFiAudioAPIData are null', () => {
        let newHiFiAudioAPIData = new HiFiAudioAPIData();
        expect(newHiFiAudioAPIData.position).toBeNull();
        expect(newHiFiAudioAPIData.orientation).toBeNull();
    });

    test('the HiFiAudioAPIData.diff() function', () => {
        let data1 = new HiFiAudioAPIData({
            position: new Point3D({x: 0, y: 4})
        });
        let data2 = new HiFiAudioAPIData();

        let diff1 = data1.diff(data2);
        expect(diff1.position).toBeNull();
        expect(diff1.orientation).toBeNull();
        
        let diff2 = data2.diff(data1);
        expect(diff2.position.x).toBe(0);
        expect(diff2.position.y).toBe(4);
        expect(diff2.position.z).toBeNull();
        expect(diff2.orientation).toBeNull();
    });
});