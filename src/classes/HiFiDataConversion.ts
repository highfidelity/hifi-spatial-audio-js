import { OrientationEuler3D, OrientationEuler3DOrder, OrientationQuat3D } from './HiFiAudioAPIData'
import { HiFiUtilities } from '../utilities/HiFiUtilities'

/**
 * Compute the orientation quaternion from the specified euler angles.
 * The resulting quaternion is the rotation transforming from combining the euler angles rotations in the specified order
 * 
 * For example, the order YawPitchRoll is computed as follow:
 *  starting from the base 3d frame,
 *  1/ Yaw, rotating around the vertical axis
 *  2/ Pitch, rotating around the right axis 
 *  3/ Roll, rotating around the front axis
 *  the resulting 3d frame orientation is relative to the base frame.
 *  The resulting rotation is defining the 'rotated' space relative to the 'base' space.
 *  A vector Vr in "rotated' space and its equivalent value Vb in the'base' space is computed as follow:
 *  Vb = [P][Y][R] Vr
 * 
 * @param euler - The euler angles.
 * @param order - The euler order convention.
 * 
 * @return The end resulting quaternion defined from the euler angles combination
 */
 export function eulerToQuaternion(euler: OrientationEuler3D, order: OrientationEuler3DOrder): OrientationQuat3D {
    // compute the individual euler angle rotation quaternion terms sin(angle/2) and cos(aangle/2)
    const HALF_DEG_TO_RAD = 0.5 * Math.PI / 180.0;
    let cos = { P: Math.cos(euler.pitchDegrees * HALF_DEG_TO_RAD), Y: Math.cos(euler.yawDegrees * HALF_DEG_TO_RAD), R: Math.cos(euler.rollDegrees * HALF_DEG_TO_RAD)};
    let sin = { P: Math.sin(euler.pitchDegrees * HALF_DEG_TO_RAD), Y: Math.sin(euler.yawDegrees * HALF_DEG_TO_RAD), R: Math.sin(euler.rollDegrees * HALF_DEG_TO_RAD)};

    // the computed quaternion components for the 6 orders are based on the same pattern
    // q.x = ax +/- bx 
    // q.y = ay +/- by 
    // q.z = az +/- bz 
    // q.w = aw +/- bw 

    let ax = sin.P * cos.Y * cos.R;
    let ay = cos.P * sin.Y * cos.R;
    let az = cos.P * cos.Y * sin.R;
    let aw = cos.P * cos.Y * cos.R;

    let bx = cos.P * sin.Y * sin.R;
    let by = sin.P * cos.Y * sin.R;
    let bz = sin.P * sin.Y * cos.R;
    let bw = sin.P * sin.Y * sin.R;

    switch (order) {
    // from 'base' space rotate Pitch, then Yaw then Roll
    // Resulting rotation is defining the 'rotated' space relative to the 'base' space.
    // A vector Vr in "rotated' space and its equivalent value Vb in the'base' space is computed as follow:
    // Vb = [P][Y][R] Vr
    case OrientationEuler3DOrder.PitchYawRoll: {
        return new OrientationQuat3D({
                x: ax + bx,
                y: ay - by,
                z: az + bz,
                w: aw - bw,
            });
        } break;

    // From 'base' space rotate Yaw, then Pitch then Roll...
    case OrientationEuler3DOrder.YawPitchRoll: {
        return new OrientationQuat3D({
                x: ax + bx,
                y: ay - by,
                z: az - bz,
                w: aw + bw,
            });
        } break;
 
    // From 'base' space rotate Roll, then Pitch then Yaw...
    case OrientationEuler3DOrder.RollPitchYaw: {
        return new OrientationQuat3D({
                x: ax - bx,
                y: ay + by,
                z: az + bz,
                w: aw - bw,
            });
        } break;
 
    // From 'base' space rotate Roll, then Yaw then Pitch...
    case OrientationEuler3DOrder.RollYawPitch: {
        return new OrientationQuat3D({
                x: ax - bx,
                y: ay + by,
                z: az - bz,
                w: aw + bw,
            });
        } break;
  
    // From 'base' space rotate Yaw, then Roll then Pitch...
    case OrientationEuler3DOrder.YawRollPitch: {
        return new OrientationQuat3D({
                x: ax + bx,
                y: ay + by,
                z: az - bz,
                w: aw - bw,
            });
        } break;
  
    // From 'base' space rotate Pitch, then Roll then Yaw...
    case OrientationEuler3DOrder.PitchRollYaw: {
        return new OrientationQuat3D({
                x: ax - bx,
                y: ay - by,
                z: az + bz,
                w: aw + bw,
            });
        } break;
    }    
}

/**
 * Compute the orientation euler decomposition from the specified quaternion.
 * The resulting euler is the rotation transforming from combining the euler angles rotations in the specified order
 * 
 * For example, the order YawPitchRoll is computed as follow:
 *  starting from the base 3d frame,
 *  1/ Yaw, rotating around the vertical axis
 *  2/ Pitch, rotating around the right axis 
 *  3/ Roll, rotating around the front axis
 *  the resulting 3d frame orientation is relative to the base frame.
 *  The resulting rotation is defining the 'rotated' space relative to the 'base' space.
 *  A vector Vr in "rotated' space and its equivalent value Vb in the'base' space is computed as follow:
 *  Vb = [P][Y][R] Vr
 * 
 * @param quat - The orientation quaternion.
 * @param order - The euler order convention.
 * 
 * @return The end resulting quaternion defined from the euler angles combination
 */
export function eulerFromQuaternion(quat: OrientationQuat3D, order: OrientationEuler3DOrder): OrientationEuler3D {
    // We need to convert the quaternion to the equivalent mat3x3
    let qx2 = quat.x * quat.x;
    let qy2 = quat.y * quat.y;
    let qz2 = quat.z * quat.z;
    // let qw2 = quat.w * quat.w; we could choose to use it instead of the 1 - 2* term...
    let qwx = quat.w * quat.x;
    let qwy = quat.w * quat.y;
    let qwz = quat.w * quat.z;
    let qxy = quat.x * quat.y;
    let qyz = quat.y * quat.z;
    let qxz = quat.z * quat.x;
    // ROT Mat33 =  {  1 - 2qy2 - 2qz2  |  2(qxy - qwz)    |  2(qxz + qwy)  }
    //              {  2(qxy + qwz)     |  1 - 2qx2 - 2qz2 |  2(qyz - qwx)  }
    //              {  2(qxz - qwy)     |  2(qyz + qwx)    |  1 - 2qx2 - 2qy2  }
    let r00 = 1.0 - 2.0 * (qy2 + qz2);
    let r10 = 2.0 * (qxy + qwz);
    let r20 = 2.0 * (qxz - qwy);

    let r01 = 2.0 * (qxy - qwz);
    let r11 = 1.0 - 2.0 * (qx2 + qz2); 
    let r21 = 2.0 * (qyz + qwx);
   
    let r02 = 2.0 * (qxz + qwy);
    let r12 = 2.0 * (qyz - qwx);
    let r22 = 1.0 - 2.0 * (qx2 + qy2); 

    // then depending on the euler rotation order decomposition, we extract the angles 
    // from the base vector components
    let pitch = 0;
    let yaw = 0;
    let roll = 0;
    const ONE_MINUS_EPSILON = 0.9999999;
    switch (order) {
    case OrientationEuler3DOrder.PitchYawRoll: {
        yaw = Math.asin( HiFiUtilities.clampNormalized(r02) );
        if ( Math.abs( r02 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( -r12, r22);
            roll = Math.atan2( -r01, r00);
        } else {
            pitch = Math.atan2(r21, r11);
        }       
    } break;
    case OrientationEuler3DOrder.YawPitchRoll: {
        pitch = Math.asin( HiFiUtilities.clampNormalized(-r12) );
        if ( Math.abs( r12 ) < ONE_MINUS_EPSILON ) {
            yaw = Math.atan2(r02, r22);
            roll = Math.atan2(r10, r11);
        } else {
            yaw = Math.atan2(-r20, r00);
        } 
    } break;
    case OrientationEuler3DOrder.RollPitchYaw: {
        pitch = Math.asin( HiFiUtilities.clampNormalized(r21) );
        if ( Math.abs( r21 ) < ONE_MINUS_EPSILON ) {
            yaw = Math.atan2(-r20, r22);
            roll = Math.atan2(-r01, r11);
        } else {
            roll = Math.atan2(r10, r00);
        }
    } break;
    case OrientationEuler3DOrder.RollYawPitch: {
        yaw = Math.asin( HiFiUtilities.clampNormalized(-r20) );
        if ( Math.abs( r20 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( r21, r22);
            roll = Math.atan2( r10, r00);
        } else {
            roll = Math.atan2( -r01, r11);
        }  
    } break;
    case OrientationEuler3DOrder.YawRollPitch: {
        roll = Math.asin( HiFiUtilities.clampNormalized(r10) );
        if ( Math.abs( r10 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( -r12, r11);
            yaw = Math.atan2( -r20, r00);
        } else {
            yaw = Math.atan2( r02, r22);
        }
    } break;
    case OrientationEuler3DOrder.PitchRollYaw: {
        roll = Math.asin( HiFiUtilities.clampNormalized(-r01) );
        if ( Math.abs( r01 ) < ONE_MINUS_EPSILON ) {
            pitch = Math.atan2( r21, r11);
            yaw = Math.atan2( r02, r00);
        } else {
            yaw = Math.atan2( -r12, r22);
        }
    } break;
    }    
    const RAD_TO_DEG = 180.0 / Math.PI;
    return new OrientationEuler3D({ pitchDegrees: RAD_TO_DEG * pitch, yawDegrees: RAD_TO_DEG * yaw, rollDegrees: RAD_TO_DEG * roll });
}