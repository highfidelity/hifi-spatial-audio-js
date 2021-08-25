// HiFiCoordinateFrameUtil.unit.test.ts
//

import { Vector3, Matrix3, Quaternion } from "../../../../src/utilities/HiFiMath";
import { HiFiCoordinateFrameUtil } from "../../../../src/utilities/HiFiCoordinateFrameUtil";

const ALMOST_ZERO = 1.0e-7;

test("RightHanded", () => {
    // we use an arbitrary right-handed World coordinate system
    let world_forward = new Vector3({x: -1.0, y: 0.0, z: 0.0});
    let world_up = new Vector3({x: 0.0, y: -1.0, z: 0.0});
    let world_right = Vector3.cross(world_forward, world_up); // aka xAxis
    let isRight = true;

    let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);

    // HiFi coordinate system is as follows
    let hifi_forward = new Vector3({x:0, y:0, z:-1});
    let hifi_up = new Vector3({x:0, y:1, z:0});
    let hifi_right = Vector3.cross(hifi_forward, hifi_up); // aka xAxis

    // we will create a position in the World-frame
    // and then verify it shows up at the expected position in HiFi-frame
    let A = 1.23;
    let B = 4.56;
    let C = -7.89;
    let world_position = Vector3.scale(A, world_forward);
    world_position = Vector3.add(world_position, Vector3.scale(B, world_up));
    world_position = Vector3.add(world_position, Vector3.scale(C, world_right));

    // the expected position in the hifi-frame is at equal distances along the
    // corresponding forward, up, and right directions
    let expected_hifi_position = Vector3.scale(A, hifi_forward);
    expected_hifi_position = Vector3.add(expected_hifi_position, Vector3.scale(B, hifi_up));
    expected_hifi_position = Vector3.add(expected_hifi_position, Vector3.scale(C, hifi_right));

    let hifi_position = util.WorldPositionToHiFi(world_position);
    expect(Vector3.distance(hifi_position, expected_hifi_position) < ALMOST_ZERO).toBe(true);

    // now we rotate in the world-frame
    let world_angle = Math.PI / 0.987;
    let world_axis = new Vector3({x: -2.46, y: 7.53, z: 8.64 });
    let world_rotation = Quaternion.fromAngleAxis(world_angle, world_axis);
    let rotated_world_position = world_rotation.rotateVector(world_position);

    let hifi_rotation = util.WorldOrientationToHiFi(world_rotation);
    let rotated_hifi_position = hifi_rotation.rotateVector(hifi_position);

    let expected_rotated_hifi_position = util.WorldPositionToHiFi(rotated_world_position);
    expect(Vector3.distance(rotated_hifi_position, expected_rotated_hifi_position) < ALMOST_ZERO).toBe(true);
});

test("LeftHanded", () => {
    // we use an arbitrary left-handed World coordinate system
    let world_forward = new Vector3({x: 0.0, y: 1.0, z: 0.0});
    let world_up = new Vector3({x: 1.0, y: 0.0, z: 0.0});
    // NOTE: for left-handed systems we compute world_right
    // by inverting the order in the cross product
    let world_right = Vector3.cross(world_up, world_forward);
    let isRight = false;

    let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);

    // HiFi coordinate system is as follows
    let hifi_forward = new Vector3({x:0, y:0, z:-1});
    let hifi_up = new Vector3({x:0, y:1, z:0});
    let hifi_right = Vector3.cross(hifi_forward, hifi_up); // aka xAxis

    // we will create a position in the World-frame
    // and then verify it shows up at the expected position in HiFi-frame
    let A = 1.23;
    let B = 4.56;
    let C = -7.89;
    let world_position = Vector3.scale(A, world_forward);
    world_position = Vector3.add(world_position, Vector3.scale(B, world_up));
    world_position = Vector3.add(world_position, Vector3.scale(C, world_right));

    // the expected position in the hifi-frame is at equal distances along the
    // corresponding forward, up, and right directions
    let expected_hifi_position = Vector3.scale(A, hifi_forward);
    expected_hifi_position = Vector3.add(expected_hifi_position, Vector3.scale(B, hifi_up));
    expected_hifi_position = Vector3.add(expected_hifi_position, Vector3.scale(C, hifi_right));

    let hifi_position = util.WorldPositionToHiFi(world_position);
    expect(Vector3.distance(hifi_position, expected_hifi_position) < ALMOST_ZERO).toBe(true);

    // now we rotate in the world-frame
    let world_angle = Math.PI / 0.987;
    let world_axis = new Vector3({x: -2.46, y: 7.53, z: 8.64 });
    let world_rotation = Quaternion.fromAngleAxis(world_angle, world_axis);
    let rotated_world_position = world_rotation.rotateVector(world_position);

    let hifi_rotation = util.WorldOrientationToHiFi(world_rotation);
    let rotated_hifi_position = hifi_rotation.rotateVector(hifi_position);

    let expected_rotated_hifi_position = util.WorldPositionToHiFi(rotated_world_position);
    expect(Vector3.distance(rotated_hifi_position, expected_rotated_hifi_position) < ALMOST_ZERO).toBe(true);
});

test("WorldIsCompatibleWithHifi", () => {
    {
        // right-handed World coordinate system with UP not along the yAxis
        let world_forward = new Vector3({x: 1.0, y: 0.0, z: 0.0}); // xAxis
        let world_up = new Vector3({x: 0.0, y: 0.0, z: 1.0}); // zAxis
        //let world_right = Vector3.cross(world_forward, world_up); // -yAxis
        let isRight = true;

        let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);
        expect(util.WorldIsCompatibleWithHifi()).toBe(false);
    }
    {
        // right-handed World coordinate system with UP along yAxis
        let world_forward = new Vector3({x: 1.0, y: 0.0, z: 0.0}); // xAxis
        let world_up = new Vector3({x: 0.0, y: 1.0, z: 0.0}); // yAxis
        //let world_right = Vector3.cross(world_forward, world_up); // zAxis
        let isRight = true;

        let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);
        expect(util.WorldIsCompatibleWithHifi()).toBe(true);
    }
    {
        // right-handed World coordinate system with UP along -yAxis
        let world_forward = new Vector3({x: 1.0, y: 0.0, z: 0.0}); // xAxis
        let world_up = new Vector3({x: 0.0, y: -1.0, z: 0.0}); // -yAxis
        //let world_right = Vector3.cross(world_forward, world_up); // -zAxis
        let isRight = true;

        let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);
        expect(util.WorldIsCompatibleWithHifi()).toBe(true);
    }

    // the same configs but left-handed should NOT be compatible
    {
        // left-handed World coordinate system with UP not along the yAxis
        let world_forward = new Vector3({x: 1.0, y: 0.0, z: 0.0}); // xAxis
        let world_up = new Vector3({x: 0.0, y: 0.0, z: 1.0}); // zAxis
        //let world_right = Vector3.cross(world_forward, world_up); // -yAxis
        let isRight = false;

        let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);
        expect(util.WorldIsCompatibleWithHifi()).toBe(false);
    }
    {
        // left-handed World coordinate system with UP along yAxis
        let world_forward = new Vector3({x: 1.0, y: 0.0, z: 0.0}); // xAxis
        let world_up = new Vector3({x: 0.0, y: 1.0, z: 0.0}); // yAxis
        //let world_right = Vector3.cross(world_forward, world_up); // zAxis
        let isRight = false;

        let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);
        expect(util.WorldIsCompatibleWithHifi()).toBe(false);
    }
    {
        // left-handed World coordinate system with UP along -yAxis
        let world_forward = new Vector3({x: 1.0, y: 0.0, z: 0.0}); // xAxis
        let world_up = new Vector3({x: 0.0, y: -1.0, z: 0.0}); // -yAxis
        //let world_right = Vector3.cross(world_forward, world_up); // -zAxis
        let isRight = false;

        let util = new HiFiCoordinateFrameUtil(world_forward, world_up, isRight);
        expect(util.WorldIsCompatibleWithHifi()).toBe(false);
    }
});
