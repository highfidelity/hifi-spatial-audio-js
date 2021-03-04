import { HiFiAudioAPIData, OrientationQuat3D, OrientationEuler3D, Point3D, eulerToQuaternion, eulerFromQuaternion, OrientationEuler3DOrder } from "../../../src/classes/HiFiAudioAPIData";

describe('Point3D', () => {
    test('verifies default members of a new Point3D are 0', () => {
        let newPoint3D = new Point3D();
        expect(newPoint3D.x).toBe(0);
        expect(newPoint3D.y).toBe(0);
        expect(newPoint3D.z).toBe(0);
    });
    
    test('allows us to only set the x component of a new Point3D', () => {
        let newPoint3D = new Point3D({x: 5});
        expect(newPoint3D.x).toBe(5);
        expect(newPoint3D.y).toBe(0);
        expect(newPoint3D.z).toBe(0);
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

    test('verifies components out of bound of a new OrientationQuat3D are clamped in the correct range', () => {
        let newOrientationQuat3D = new OrientationQuat3D({w: 2, x: NaN, y: Infinity, z: -Infinity});
        expect(newOrientationQuat3D.w).toBe(1);
        expect(newOrientationQuat3D.x).toBe(0);
        expect(newOrientationQuat3D.y).toBe(1);
        expect(newOrientationQuat3D.z).toBe(-1);
    });
});

describe('OrientationEuler3D', () => {
    test('verifies default members of a new OrientationEuler3D are 0', () => {
        let newOrientationEuler3D = new OrientationEuler3D();
        expect(newOrientationEuler3D.pitchDegrees).toBe(0);
        expect(newOrientationEuler3D.yawDegrees).toBe(0);
        expect(newOrientationEuler3D.rollDegrees).toBe(0);
    });

    test('verifies default members of a new OrientationEuler3D initialized with undefined are 0', () => {
        let newOrientationEuler3D = new OrientationEuler3D(undefined);
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
    
    test('verifies default members of a new OrientationEuler3D initialized with out of range and NaN are kept in range', () => {
        let newOrientationEuler3D = new OrientationEuler3D({pitchDegrees: NaN, yawDegrees: Infinity, rollDegrees: -Infinity});
        expect(newOrientationEuler3D.pitchDegrees).toBe(0);
        expect(newOrientationEuler3D.yawDegrees).toBe(360);
        expect(newOrientationEuler3D.rollDegrees).toBe(-360);
    });
});

function test_eulerFromQuaternion(
    inEuler: {P?: number, Y?: number, R?: number},
    inEulerOrder: OrientationEuler3DOrder,
    outQuat: {w: number, x: number, y: number, z: number},
    outEuler?: {P?: number, Y?: number, R?: number}) {
    let euler3D = new OrientationEuler3D({pitchDegrees: inEuler.P, yawDegrees: inEuler.Y, rollDegrees: inEuler.R});
    expect(euler3D.pitchDegrees).toBe(inEuler.P ?? 0);
    expect(euler3D.yawDegrees).toBe(inEuler.Y ?? 0);
    expect(euler3D.rollDegrees).toBe(inEuler.R ?? 0);

    let newOrientationQuat3D = eulerToQuaternion(euler3D, inEulerOrder);
    expect(newOrientationQuat3D.w).toBeCloseTo(outQuat.w, 5);
    expect(newOrientationQuat3D.x).toBeCloseTo(outQuat.x, 5);
    expect(newOrientationQuat3D.y).toBeCloseTo(outQuat.y, 5);
    expect(newOrientationQuat3D.z).toBeCloseTo(outQuat.z, 5);

    let newOrientationEuler3D = eulerFromQuaternion(newOrientationQuat3D, inEulerOrder);

    // Check the euler evaluated back from the quaternion against outEuler (or inEuler if not specified)
    expect(newOrientationEuler3D.pitchDegrees).toBeCloseTo(( outEuler ? outEuler.P ?? 0 : inEuler.P ?? 0), 5);
    expect(newOrientationEuler3D.yawDegrees).toBeCloseTo(( outEuler ? outEuler.Y ?? 0 : inEuler.Y ?? 0), 5);
    expect(newOrientationEuler3D.rollDegrees).toBeCloseTo( ( outEuler ? outEuler.R ?? 0 : inEuler.R ?? 0), 5);   
}

describe('Orientation_EulerToFromQuat', () => {
    test('verifies eulerToOrientation identity', () => {
        let euler3D = new OrientationEuler3D();
        let newOrientationQuat3D = eulerToQuaternion(euler3D, OrientationEuler3DOrder.YawPitchRoll);
        expect(newOrientationQuat3D.w).toBe(1);
        expect(newOrientationQuat3D.x).toBe(0);
        expect(newOrientationQuat3D.y).toBe(0);
        expect(newOrientationQuat3D.z).toBe(0);

        let newOrientationEuler3D = eulerFromQuaternion(newOrientationQuat3D, OrientationEuler3DOrder.YawPitchRoll);
        expect(newOrientationEuler3D.pitchDegrees).toBeCloseTo(0);
        expect(newOrientationEuler3D.yawDegrees).toBeCloseTo(0);
        expect(newOrientationEuler3D.rollDegrees).toBeCloseTo(0);

        test_eulerFromQuaternion( {}, OrientationEuler3DOrder.YawPitchRoll, {w: 1, x: 0, y: 0, z: 0});
    });
    test('verifies eulerToOrientation Pitch:90', () => {
        test_eulerFromQuaternion( {P: 90}, OrientationEuler3DOrder.PitchYawRoll, {w: 0.7071067811865476, x: 0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: 90}, OrientationEuler3DOrder.YawPitchRoll, {w: 0.7071067811865476, x: 0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: 90}, OrientationEuler3DOrder.RollPitchYaw, {w: 0.7071067811865476, x: 0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: 90}, OrientationEuler3DOrder.RollYawPitch, {w: 0.7071067811865476, x: 0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: 90}, OrientationEuler3DOrder.YawRollPitch, {w: 0.7071067811865476, x: 0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: 90}, OrientationEuler3DOrder.PitchRollYaw, {w: 0.7071067811865476, x: 0.7071067811865475, y: 0, z: 0});
    });
    test('verifies eulerToOrientation Pitch:-90', () => {
        test_eulerFromQuaternion( {P: -90}, OrientationEuler3DOrder.PitchYawRoll, {w:  0.7071067811865476, x: -0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: -90}, OrientationEuler3DOrder.YawPitchRoll, {w:  0.7071067811865476, x: -0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: -90}, OrientationEuler3DOrder.RollPitchYaw, {w:  0.7071067811865476, x: -0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: -90}, OrientationEuler3DOrder.RollYawPitch, {w:  0.7071067811865476, x: -0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: -90}, OrientationEuler3DOrder.YawRollPitch, {w:  0.7071067811865476, x: -0.7071067811865475, y: 0, z: 0});
        test_eulerFromQuaternion( {P: -90}, OrientationEuler3DOrder.PitchRollYaw, {w:  0.7071067811865476, x: -0.7071067811865475, y: 0, z: 0});
    });
    test('verifies eulerToOrientation Yaw:90', () => {
        test_eulerFromQuaternion( {Y: 90}, OrientationEuler3DOrder.PitchYawRoll, {w: 0.7071067811865476, x: 0, y: 0.7071067811865475, z: 0});
        test_eulerFromQuaternion( {Y: 90}, OrientationEuler3DOrder.YawPitchRoll, {w: 0.7071067811865476, x: 0, y: 0.7071067811865475, z: 0});
        test_eulerFromQuaternion( {Y: 90}, OrientationEuler3DOrder.RollPitchYaw, {w: 0.7071067811865476, x: 0, y: 0.7071067811865475, z: 0});
        test_eulerFromQuaternion( {Y: 90}, OrientationEuler3DOrder.RollYawPitch, {w: 0.7071067811865476, x: 0, y: 0.7071067811865475, z: 0});
        test_eulerFromQuaternion( {Y: 90}, OrientationEuler3DOrder.YawRollPitch, {w: 0.7071067811865476, x: 0, y: 0.7071067811865475, z: 0});
        test_eulerFromQuaternion( {Y: 90}, OrientationEuler3DOrder.PitchRollYaw, {w: 0.7071067811865476, x: 0, y: 0.7071067811865475, z: 0});
    });
    test('verifies eulerToOrientation Yaw:-180', () => {
        test_eulerFromQuaternion( {Y: -180}, OrientationEuler3DOrder.PitchYawRoll, {w: 0, x: 0, y: -1, z: 0}, {P: 180, R: 180});
        test_eulerFromQuaternion( {Y: -180}, OrientationEuler3DOrder.YawPitchRoll, {w: 0, x: 0, y: -1, z: 0});
        test_eulerFromQuaternion( {Y: -180}, OrientationEuler3DOrder.RollPitchYaw, {w: 0, x: 0, y: -1, z: 0});
        test_eulerFromQuaternion( {Y: -180}, OrientationEuler3DOrder.RollYawPitch, {w: 0, x: 0, y: -1, z: 0}, {P: 180, R: 180});
        test_eulerFromQuaternion( {Y: -180}, OrientationEuler3DOrder.YawRollPitch, {w: 0, x: 0, y: -1, z: 0});
        test_eulerFromQuaternion( {Y: -180}, OrientationEuler3DOrder.PitchRollYaw, {w: 0, x: 0, y: -1, z: 0});
    });
    test('verifies eulerToOrientation Roll:90', () => {
        test_eulerFromQuaternion( {R: 90}, OrientationEuler3DOrder.PitchYawRoll, {w: 0.7071067811865476, x: 0, y: 0, z: 0.7071067811865475});
        test_eulerFromQuaternion( {R: 90}, OrientationEuler3DOrder.YawPitchRoll, {w: 0.7071067811865476, x: 0, y: 0, z: 0.7071067811865475});
        test_eulerFromQuaternion( {R: 90}, OrientationEuler3DOrder.RollPitchYaw, {w: 0.7071067811865476, x: 0, y: 0, z: 0.7071067811865475});
        test_eulerFromQuaternion( {R: 90}, OrientationEuler3DOrder.RollYawPitch, {w: 0.7071067811865476, x: 0, y: 0, z: 0.7071067811865475});
        test_eulerFromQuaternion( {R: 90}, OrientationEuler3DOrder.YawRollPitch, {w: 0.7071067811865476, x: 0, y: 0, z: 0.7071067811865475});
        test_eulerFromQuaternion( {R: 90}, OrientationEuler3DOrder.PitchRollYaw, {w: 0.7071067811865476, x: 0, y: 0, z: 0.7071067811865475});
    });
    test('verifies eulerToOrientation Roll:180', () => {
        test_eulerFromQuaternion( {R: 180}, OrientationEuler3DOrder.PitchYawRoll, {w: 0, x: 0, y: 0, z: 1});
        test_eulerFromQuaternion( {R: 180}, OrientationEuler3DOrder.YawPitchRoll, {w: 0, x: 0, y: 0, z: 1});
        test_eulerFromQuaternion( {R: 180}, OrientationEuler3DOrder.RollPitchYaw, {w: 0, x: 0, y: 0, z: 1});
        test_eulerFromQuaternion( {R: 180}, OrientationEuler3DOrder.RollYawPitch, {w: 0, x: 0, y: 0, z: 1});
        test_eulerFromQuaternion( {R: 180}, OrientationEuler3DOrder.YawRollPitch, {w: 0, x: 0, y: 0, z: 1}, {P: -180, Y: -180});
        test_eulerFromQuaternion( {R: 180}, OrientationEuler3DOrder.PitchRollYaw, {w: 0, x: 0, y: 0, z: 1}, {P: 180, Y: 180});
    });
    test('verifies eulerToOrientation Yaw:30, Pitch:85', () => {
        // 2 quaternions expected, depending on the order Yaw Pitch vs Pitch Yaw 
        test_eulerFromQuaternion( {Y: 30, P: 85}, OrientationEuler3DOrder.PitchYawRoll, {w: 0.7121552207625228, x: 0.6525700295239598, y: 0.19082141628892588, z:  0.1748556124156989});
        test_eulerFromQuaternion( {Y: 30, P: 85}, OrientationEuler3DOrder.YawPitchRoll, {w: 0.7121552207625228, x: 0.6525700295239598, y: 0.19082141628892588, z: -0.1748556124156989});
        test_eulerFromQuaternion( {Y: 30, P: 85}, OrientationEuler3DOrder.RollPitchYaw, {w: 0.7121552207625228, x: 0.6525700295239598, y: 0.19082141628892588, z:  0.1748556124156989});
        test_eulerFromQuaternion( {Y: 30, P: 85}, OrientationEuler3DOrder.RollYawPitch, {w: 0.7121552207625228, x: 0.6525700295239598, y: 0.19082141628892588, z: -0.1748556124156989});
        test_eulerFromQuaternion( {Y: 30, P: 85}, OrientationEuler3DOrder.YawRollPitch, {w: 0.7121552207625228, x: 0.6525700295239598, y: 0.19082141628892588, z: -0.1748556124156989});
        test_eulerFromQuaternion( {Y: 30, P: 85}, OrientationEuler3DOrder.PitchRollYaw, {w: 0.7121552207625228, x: 0.6525700295239598, y: 0.19082141628892588, z:  0.1748556124156989});
    });
    test('verifies eulerToOrientation Yaw:30, Pitch:85, Roll: 85', () => {
        // 6 different quaternions, each 4 components has 2 possible values
        test_eulerFromQuaternion( {Y: 30, P: 85, R: 85}, OrientationEuler3DOrder.PitchYawRoll, {w: 0.40692516506453336, x: 0.6100421736976789, y:-0.30018161612201427, z: 0.6100421736976789});
        test_eulerFromQuaternion( {Y: 30, P: 85, R: 85}, OrientationEuler3DOrder.YawPitchRoll, {w: 0.6431866440539042,  x: 0.6100421736976789, y:-0.30018161612201427, z: 0.3522080132013794});
        test_eulerFromQuaternion( {Y: 30, P: 85, R: 85}, OrientationEuler3DOrder.RollPitchYaw, {w: 0.40692516506453336, x: 0.3522080132013794, y: 0.5815582273376849,  z: 0.6100421736976789});
        test_eulerFromQuaternion( {Y: 30, P: 85, R: 85}, OrientationEuler3DOrder.RollYawPitch, {w: 0.6431866440539042,  x: 0.3522080132013794, y: 0.5815582273376849,  z: 0.3522080132013794});
        test_eulerFromQuaternion( {Y: 30, P: 85, R: 85}, OrientationEuler3DOrder.YawRollPitch, {w: 0.40692516506453336, x: 0.6100421736976789, y: 0.5815582273376849,  z: 0.3522080132013794});
        test_eulerFromQuaternion( {Y: 30, P: 85, R: 85}, OrientationEuler3DOrder.PitchRollYaw, {w: 0.6431866440539042,  x: 0.3522080132013794, y:-0.30018161612201427, z: 0.6100421736976789});
    });
});

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