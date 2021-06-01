// HiFiMath.unit.test.ts
//

import { Vector3, Matrix3, Quaternion } from "../../../../src/utilities/HiFiMath";
import { OrientationEuler3D, OrientationEuler3DOrder, eulerToQuaternion, eulerFromQuaternion } from "../../../../src/utilities/HiFiMath";

const ALMOST_ZERO = 1.0e-7;

describe("Vector3", () => {
    test("ctor", () => {
        let a = new Vector3();
        expect(a.x).toBe(0.0);
        expect(a.y).toBe(0.0);
        expect(a.z).toBe(0.0);

        let b = new Vector3({x: 1.0, y: 2.0, z: 3.0});
        expect(b.x).toBe(1.0);
        expect(b.y).toBe(2.0);
        expect(b.z).toBe(3.0);

        let c = new Vector3({x: 5.0});
        expect(c.x).toBe(5.0);
        expect(c.y).toBe(0.0);
        expect(c.z).toBe(0.0);
    });

    test("length", () => {
        // verify distance and distance2
        let a = new Vector3({x: 1.0, y: 0.0, z: 4.0 });
        let b = new Vector3({x: 1.0, y: 3.0, z: 0.0 });
        expect(Vector3.distance(a,b)).toBe(5.0);
        expect(Vector3.distance2(a,b)).toBe(25.0);

        // verify length and length2
        let c = new Vector3({x: 0.0, y: 3.0, z: 4.0 });
        expect(c.length()).toBe(5.0);
        expect(c.length2()).toBe(25.0);
    });

    test("dot", () => {
        let xAxis = new Vector3({x:1.0, y: 0.0, z: 0.0});
        let yAxis = new Vector3({x:0.0, y: 1.0, z: 0.0});
        let zAxis = new Vector3({x:0.0, y: 0.0, z: 1.0});

        let a = -23.45;
        let b = 13.5;
        let c = 975.3;
        let v = new Vector3({x: a, y: b, z: c});

        expect(Vector3.dot(v, xAxis)).toBe(a);
        expect(Vector3.dot(v, yAxis)).toBe(b);
        expect(Vector3.dot(v, zAxis)).toBe(c);

        expect(Vector3.dot(v, v)).toBe(v.length2());
    });

    test("cross", () => {
        let xAxis = new Vector3({x:1.0, y: 0.0, z: 0.0});
        let yAxis = new Vector3({x:0.0, y: 1.0, z: 0.0});
        let zAxis = new Vector3({x:0.0, y: 0.0, z: 1.0});

        let x_cross_y = Vector3.cross(xAxis, yAxis);
        expect(Vector3.distance(zAxis, x_cross_y) < ALMOST_ZERO).toBe(true);

        let y_cross_z = Vector3.cross(yAxis, zAxis);
        expect(Vector3.distance(xAxis, y_cross_z) < ALMOST_ZERO).toBe(true);

        let z_cross_x = Vector3.cross(zAxis, xAxis);
        expect(Vector3.distance(yAxis, z_cross_x) < ALMOST_ZERO).toBe(true);
    });
});

describe("Matrix3", () => {

    test("ctor", () => {
        let a = new Vector3({x: 1.0, y: -2.1, z: 3.2});
        let b = new Vector3({x: -4.3, y: 5.4, z: -6.5});
        let c = new Vector3({x: 7.6, y: -8.7, z: 9.8});
        let m = new Matrix3(a, b, c);

        expect(m.a.x).toBe(1.0);
        expect(m.a.y).toBe(-2.1);
        expect(m.a.z).toBe(3.2);

        expect(m.b.x).toBe(-4.3);
        expect(m.b.y).toBe(5.4);
        expect(m.b.z).toBe(-6.5);

        expect(m.c.x).toBe(7.6);
        expect(m.c.y).toBe(-8.7);
        expect(m.c.z).toBe(9.8);
    });

    test("transformVector", () => {
        // make a rotation maxtrix for pi/2 radians about x-axis
        let a = new Vector3({x: 1.0, y: 0.0, z: 0.0});
        let b = new Vector3({x: 0.0, y: 0.0, z: -1.0});
        let c = new Vector3({x: 0.0, y: 1.0, z: 0.0});
        let m = new Matrix3(a, b, c);

        // trasform a vector with the matrix
        let v = new Vector3({x: 1.0, y: 2.0, z: 3.0});
        let w = m.transformVector(v);

        // verfiy the transformed vector
        let expected_w = new Vector3({x: 1.0, y: -v.z, z: v.y});
        expect(Vector3.distance(w, expected_w) < ALMOST_ZERO).toBe(true);

        // invert the matrix and verify w transforms back to v
        m.transpose();
        let expected_v = m.transformVector(w);
        expect(Vector3.distance(v, expected_v) < ALMOST_ZERO).toBe(true);
    });
});

describe("Quaternion", () => {
    test("ctor", () => {
        let q = new Quaternion();

        expect(q.w).toBe(1.0);
        expect(q.x).toBe(0.0);
        expect(q.y).toBe(0.0);
        expect(q.z).toBe(0.0);
    });

    test("normalize", () => {
        // non-normalized Quaternions are allowed by the constructor
        // because they have legit applications for those who know what they are doing
        let q = new Quaternion({w: 1.0, x: 2.0, y: 3.0, z: 4.0});
        expect(Math.abs(1.0 - Math.sqrt(Quaternion.dot(q, q))) < ALMOST_ZERO).toBe(false);
        q.normalize();
        expect(Math.abs(1.0 - Math.sqrt(Quaternion.dot(q, q))) < ALMOST_ZERO).toBe(true);
    });

    test("angleAxis", () => {
        let angle = Math.PI/4.0;
        let axis = new Vector3({x: 1.0, y: -2.1, z: 3.2});

        let q = Quaternion.angleAxis(angle, axis);

        // q should be normalized since it represents a rotation
        expect(Math.abs(1.0 - Math.sqrt(Quaternion.dot(q, q))) < ALMOST_ZERO).toBe(true);

        // we should be able to extract the angle-axis info from the quaternion
        expect(Math.abs(q.getAngle() - angle) < ALMOST_ZERO).toBe(true);
        // however, the extracted axis will be normalized
        let normalizedAxis = Vector3.scale(1.0 / axis.length(), axis);
        expect(Vector3.distance(normalizedAxis, q.getAxis()) < ALMOST_ZERO).toBe(true);

        // when angle is negative, the extracted info will invert
        // to keep the extracted angle positive
        angle *= -1.0;
        q = Quaternion.angleAxis(angle, axis);
        expect(Math.abs(q.getAngle() + angle) < ALMOST_ZERO).toBe(true);
        let negatedNormalizedAxis = Vector3.scale(-1.0, normalizedAxis);
        expect(Vector3.distance(negatedNormalizedAxis, q.getAxis()) < ALMOST_ZERO).toBe(true);
    });

    test("RotationX", () => {
        // make a Quaternion rotation for pi/2 radians about x-axis
        let angle = 0.5 * Math.PI;
        let axis = new Vector3({x: 1.0, y: 0.0, z: 0.0});
        let q = Quaternion.angleAxis(angle, axis);

        // make a rotation maxtrix for pi/2 radians about x-axis
        let a = new Vector3({x: 1.0, y: 0.0, z: 0.0});
        let b = new Vector3({x: 0.0, y: 0.0, z: -1.0});
        let c = new Vector3({x: 0.0, y: 1.0, z: 0.0});
        let m = new Matrix3(a, b, c);

        // convert Quaternion to matrix and visa-versa
        let expected_m = Matrix3.fromQuaternion(q);
        let expected_q = Matrix3.toQuaternion(m);

        // all quaternions and matrices are equivalent
        // if they operate on cardinal axes in the same expected way
        let xAxis = new Vector3({x:1.0, y: 0.0, z: 0.0});
        let yAxis = new Vector3({x:0.0, y: 1.0, z: 0.0});
        let zAxis = new Vector3({x:0.0, y: 0.0, z: 1.0});

        // x stays at x
        expect(Vector3.distance(q.rotateVector(xAxis), xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(xAxis), xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(xAxis), xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(xAxis), xAxis) < ALMOST_ZERO).toBe(true);

        // y goes to z
        expect(Vector3.distance(q.rotateVector(yAxis), zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(yAxis), zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(yAxis), zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(yAxis), zAxis) < ALMOST_ZERO).toBe(true);

        // z goes to -y
        let neg_yAxis = new Vector3({x:0.0, y: -1.0, z: 0.0});
        expect(Vector3.distance(q.rotateVector(zAxis), neg_yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(zAxis), neg_yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(zAxis), neg_yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(zAxis), neg_yAxis) < ALMOST_ZERO).toBe(true);
    });

    test("RotationY", () => {
        // make a Quaternion rotation for pi/2 radians about y-axis
        let angle = 0.5 * Math.PI;
        let axis = new Vector3({x: 0.0, y: 1.0, z: 0.0});
        let q = Quaternion.angleAxis(angle, axis);

        // make a rotation maxtrix for pi/2 radians about y-axis
        let a = new Vector3({x: 0.0, y: 0.0, z: 1.0});
        let b = new Vector3({x: 0.0, y: 1.0, z: 0.0});
        let c = new Vector3({x: -1.0, y: 0.0, z: 0.0});
        let m = new Matrix3(a, b, c);

        // convert Quaternion to matrix and visa-versa
        let expected_m = Matrix3.fromQuaternion(q);
        let expected_q = Matrix3.toQuaternion(m);

        // all quaternions and matrices are equivalent
        // if they operate on cardinal axes in the same expected way
        let xAxis = new Vector3({x:1.0, y: 0.0, z: 0.0});
        let yAxis = new Vector3({x:0.0, y: 1.0, z: 0.0});
        let zAxis = new Vector3({x:0.0, y: 0.0, z: 1.0});

        // x goes to -z
        let neg_zAxis = new Vector3({x:0.0, y: 0.0, z: -1.0});
        expect(Vector3.distance(q.rotateVector(xAxis), neg_zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(xAxis), neg_zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(xAxis), neg_zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(xAxis), neg_zAxis) < ALMOST_ZERO).toBe(true);

        // y stays at y
        expect(Vector3.distance(q.rotateVector(yAxis), yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(yAxis), yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(yAxis), yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(yAxis), yAxis) < ALMOST_ZERO).toBe(true);

        // z goes to x
        expect(Vector3.distance(q.rotateVector(zAxis), xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(zAxis), xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(zAxis), xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(zAxis), xAxis) < ALMOST_ZERO).toBe(true);
    });

    test("RotationZ", () => {
        // make a Quaternion rotation for pi/2 radians about z-axis
        let angle = 0.5 * Math.PI;
        let axis = new Vector3({x: 0.0, y: 0.0, z: 1.0});
        let q = Quaternion.angleAxis(angle, axis);

        // make a rotation maxtrix for pi/2 radians about z-axis
        let a = new Vector3({x: 0.0, y: -1.0, z: 0.0});
        let b = new Vector3({x: 1.0, y: 0.0, z: 0.0});
        let c = new Vector3({x: 0.0, y: 0.0, z: 1.0});
        let m = new Matrix3(a, b, c);

        // convert Quaternion to matrix and visa-versa
        let expected_m = Matrix3.fromQuaternion(q);
        let expected_q = Matrix3.toQuaternion(m);

        // all quaternions and matrices are equivalent
        // if they operate on cardinal axes in the same expected way
        let xAxis = new Vector3({x:1.0, y: 0.0, z: 0.0});
        let yAxis = new Vector3({x:0.0, y: 1.0, z: 0.0});
        let zAxis = new Vector3({x:0.0, y: 0.0, z: 1.0});

        // x goes to y
        expect(Vector3.distance(q.rotateVector(xAxis), yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(xAxis), yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(xAxis), yAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(xAxis), yAxis) < ALMOST_ZERO).toBe(true);

        // y goes to -x
        let neg_xAxis = new Vector3({x: -1.0, y: 0.0, z: 0.0 });
        expect(Vector3.distance(q.rotateVector(yAxis), neg_xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(yAxis), neg_xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(yAxis), neg_xAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(yAxis), neg_xAxis) < ALMOST_ZERO).toBe(true);

        // z stays at z
        expect(Vector3.distance(q.rotateVector(zAxis), zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(m.transformVector(zAxis), zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_q.rotateVector(zAxis), zAxis) < ALMOST_ZERO).toBe(true);
        expect(Vector3.distance(expected_m.transformVector(zAxis), zAxis) < ALMOST_ZERO).toBe(true);
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
        expect(newOrientationEuler3D.yawDegrees).toBe(0);
        expect(newOrientationEuler3D.rollDegrees).toBe(-0);

        newOrientationEuler3D = new OrientationEuler3D({pitchDegrees: NaN, yawDegrees: 360, rollDegrees: -360});
        expect(newOrientationEuler3D.pitchDegrees).toBe(0);
        expect(newOrientationEuler3D.yawDegrees).toBe(0);
        expect(newOrientationEuler3D.rollDegrees).toBe(-0);
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
    test('verifies eulerToOrientation Pitch around 90 in YPR mode', () => {
        const DEG_TO_RAD = Math.PI / 180.0;
        test_eulerFromQuaternion( {Y: 0, P: 89}, OrientationEuler3DOrder.YawPitchRoll, {w: Math.cos(89 * DEG_TO_RAD * 0.5), x:  Math.sin(89 * DEG_TO_RAD * 0.5), y: 0, z: 0});
        test_eulerFromQuaternion( {Y: 0, P: 90}, OrientationEuler3DOrder.YawPitchRoll, {w: Math.cos(90 * DEG_TO_RAD * 0.5), x:  Math.sin(90 * DEG_TO_RAD * 0.5), y: 0, z: 0});
        // When the pitch exceeds 90 degrees the expected pitch after conversion will be decreasing with an inverted yaw. 
        // This behaviour is identical to conversions on three.js
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
