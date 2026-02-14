/**
 * VRT Camera — Arcball/Trackball camera for 3D volume rendering.
 *
 * Uses quaternion-based rotation for smooth, gimbal-lock-free interaction.
 * Provides view and projection matrix generation for the raycasting shader.
 */

import type { VolumeData } from "../mpr/volumeBuilder";

export interface VRTCameraState {
  rotationQuat: [number, number, number, number]; // [x, y, z, w] unit quaternion
  distance: number; // Distance from volume center
  panOffset: [number, number]; // Screen-aligned pan
  fov: number; // Field of view in degrees
}

// ─── Quaternion helpers ───

function quatMultiply(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatNormalize(
  q: [number, number, number, number],
): [number, number, number, number] {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
  if (len === 0) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function quatFromAxisAngle(
  axis: [number, number, number],
  angle: number,
): [number, number, number, number] {
  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);
  return quatNormalize([axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(halfAngle)]);
}

function quatToMat4(q: [number, number, number, number]): Float32Array {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  // Column-major for WebGL
  return new Float32Array([
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ]);
}

// ─── Camera creation ───

export function createDefaultCamera(volume: VolumeData): VRTCameraState {
  // Position camera far enough to see the whole volume
  const [cols, rows, slices] = volume.dimensions;
  const [sx, sy, sz] = volume.spacing;
  const maxExtent = Math.max(cols * sx, rows * sy, slices * sz);

  return {
    rotationQuat: [0, 0, 0, 1], // Identity — looking along -Z
    distance: maxExtent * 1.8,
    panOffset: [0, 0],
    fov: 45,
  };
}

// ─── Interaction ───

export function applyRotation(
  state: VRTCameraState,
  deltaX: number,
  deltaY: number,
  canvasWidth: number,
  canvasHeight: number,
): VRTCameraState {
  const sensitivity = 3.0;
  const angleX = (deltaY / canvasHeight) * sensitivity;
  const angleY = (deltaX / canvasWidth) * sensitivity;

  // Rotate around world X-axis (pitch) and world Y-axis (yaw)
  const qx = quatFromAxisAngle([1, 0, 0], angleX);
  const qy = quatFromAxisAngle([0, 1, 0], angleY);

  // Combine: new rotation = yaw * pitch * existing
  const combined = quatMultiply(qy, quatMultiply(qx, state.rotationQuat));

  return { ...state, rotationQuat: quatNormalize(combined) };
}

export function applyZoom(state: VRTCameraState, delta: number): VRTCameraState {
  const factor = 1 + delta * 0.001;
  const newDistance = Math.max(10, Math.min(state.distance * factor, state.distance * 10));
  return { ...state, distance: newDistance };
}

export function applyPan(
  state: VRTCameraState,
  deltaX: number,
  deltaY: number,
): VRTCameraState {
  // Scale pan by distance so it feels consistent
  const panScale = state.distance * 0.002;
  return {
    ...state,
    panOffset: [
      state.panOffset[0] + deltaX * panScale,
      state.panOffset[1] - deltaY * panScale, // Invert Y for natural feel
    ],
  };
}

// ─── Matrix generation ───

export function getViewMatrix(
  state: VRTCameraState,
  volumeCenter: [number, number, number],
): Float32Array {
  // View matrix = Translation(-eye) * Rotation
  // eye = volumeCenter + rotatedBackward * distance + pan offset

  const rotMat = quatToMat4(state.rotationQuat);

  // Camera looks down -Z in its local frame, so the backward direction is +Z
  // In rotated frame: backward = rotMat * [0, 0, 1]
  const backX = rotMat[8]; // Column 2 of rotation matrix (z-axis)
  const backY = rotMat[9];
  const backZ = rotMat[10];

  // Right direction (column 0) for pan
  const rightX = rotMat[0];
  const rightY = rotMat[1];
  const rightZ = rotMat[2];

  // Up direction (column 1) for pan
  const upX = rotMat[4];
  const upY = rotMat[5];
  const upZ = rotMat[6];

  // Eye position
  const eyeX = volumeCenter[0] + backX * state.distance + rightX * state.panOffset[0] + upX * state.panOffset[1];
  const eyeY = volumeCenter[1] + backY * state.distance + rightY * state.panOffset[0] + upY * state.panOffset[1];
  const eyeZ = volumeCenter[2] + backZ * state.distance + rightZ * state.panOffset[0] + upZ * state.panOffset[1];

  // Build view matrix: inverse of camera transform
  // viewMatrix = Transpose(R) * T(-eye)
  // Since R is orthonormal, R^-1 = R^T
  const tx = -(rotMat[0] * eyeX + rotMat[1] * eyeY + rotMat[2] * eyeZ);
  const ty = -(rotMat[4] * eyeX + rotMat[5] * eyeY + rotMat[6] * eyeZ);
  const tz = -(rotMat[8] * eyeX + rotMat[9] * eyeY + rotMat[10] * eyeZ);

  // Column-major
  return new Float32Array([
    rotMat[0], rotMat[4], rotMat[8], 0,
    rotMat[1], rotMat[5], rotMat[9], 0,
    rotMat[2], rotMat[6], rotMat[10], 0,
    tx, ty, tz, 1,
  ]);
}

export function getProjectionMatrix(
  state: VRTCameraState,
  aspect: number,
): Float32Array {
  const fovRad = (state.fov * Math.PI) / 180;
  const f = 1 / Math.tan(fovRad / 2);
  const near = state.distance * 0.01;
  const far = state.distance * 10;
  const rangeInv = 1 / (near - far);

  // Column-major perspective projection
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * rangeInv, -1,
    0, 0, 2 * far * near * rangeInv, 0,
  ]);
}

export function invertMatrix4(m: Float32Array): Float32Array {
  const out = new Float32Array(16);
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return out;
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return out;
}

export function getVolumeCenter(volume: VolumeData): [number, number, number] {
  const [cols, rows, slices] = volume.dimensions;
  const [sx, sy, sz] = volume.spacing;
  return [(cols * sx) / 2, (rows * sy) / 2, (slices * sz) / 2];
}
