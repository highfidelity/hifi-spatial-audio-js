// HiFiMath.unit.test.ts
//

import { Vector3, Matrix3, Quaternion } from "../../../../src/utilities/HiFiMath";

const ALMOST_ZERO = 1.0e-7;

test("Vector3.length", () => {
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

test("Vector3.dot", () => {
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

test("Vector3.cross", () => {
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

test("Matrix3", () => {
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
