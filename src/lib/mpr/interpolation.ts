/**
 * Interpolation Module
 *
 * Provides trilinear interpolation for oblique plane sampling in 3D MPR.
 */

import type { VolumeData } from "./volumeBuilder";

// Oblique plane definition
export interface ObliquePlane {
  origin: [number, number, number]; // Center point in voxel coordinates
  normal: [number, number, number]; // Normal vector (perpendicular to plane)
  u: [number, number, number]; // In-plane axis 1 (horizontal)
  v: [number, number, number]; // In-plane axis 2 (vertical)
  rotation: number; // Rotation around normal in radians
}

/**
 * Get voxel value at integer indices with bounds checking.
 * Returns -1000 (air HU value) for out-of-bounds access.
 */
export function getVoxel(
  volume: VolumeData,
  x: number,
  y: number,
  z: number
): number {
  const [width, height, depth] = volume.dimensions;

  if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
    return -1000; // Air HU value for out-of-bounds
  }

  const index = z * (width * height) + y * width + x;
  return volume.data[index];
}

/**
 * Trilinear interpolation for sub-voxel sampling.
 * Interpolates between 8 neighboring voxels for smooth oblique slicing.
 */
export function trilinearInterpolation(
  volume: VolumeData,
  x: number, // Fractional voxel X coordinate
  y: number, // Fractional voxel Y coordinate
  z: number // Fractional voxel Z coordinate
): number {
  // Get integer parts and fractional parts
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);

  const xd = x - x0;
  const yd = y - y0;
  const zd = z - z0;

  // Get the 8 corner voxel values
  const c000 = getVoxel(volume, x0, y0, z0);
  const c001 = getVoxel(volume, x0, y0, z0 + 1);
  const c010 = getVoxel(volume, x0, y0 + 1, z0);
  const c011 = getVoxel(volume, x0, y0 + 1, z0 + 1);
  const c100 = getVoxel(volume, x0 + 1, y0, z0);
  const c101 = getVoxel(volume, x0 + 1, y0, z0 + 1);
  const c110 = getVoxel(volume, x0 + 1, y0 + 1, z0);
  const c111 = getVoxel(volume, x0 + 1, y0 + 1, z0 + 1);

  // Interpolate along x
  const c00 = c000 * (1 - xd) + c100 * xd;
  const c01 = c001 * (1 - xd) + c101 * xd;
  const c10 = c010 * (1 - xd) + c110 * xd;
  const c11 = c011 * (1 - xd) + c111 * xd;

  // Interpolate along y
  const c0 = c00 * (1 - yd) + c10 * yd;
  const c1 = c01 * (1 - yd) + c11 * yd;

  // Interpolate along z
  return c0 * (1 - zd) + c1 * zd;
}

/**
 * Normalize a 3D vector to unit length.
 */
export function normalize(
  v: [number, number, number]
): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len === 0) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Compute cross product of two 3D vectors.
 */
export function cross(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Compute dot product of two 3D vectors.
 */
export function dot(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Create an initial oblique plane centered in the volume.
 * Defaults to axial orientation.
 */
export function createInitialObliquePlane(volume: VolumeData): ObliquePlane {
  const [cols, rows, slices] = volume.dimensions;

  return {
    origin: [cols / 2, rows / 2, slices / 2],
    normal: [0, 0, 1], // Pointing up (axial)
    u: [1, 0, 0], // Right
    v: [0, 1, 0], // Down
    rotation: 0,
  };
}

/**
 * Rotate the oblique plane around a given axis.
 */
export function rotatePlane(
  plane: ObliquePlane,
  axis: "x" | "y" | "z",
  angleDegrees: number
): ObliquePlane {
  const angle = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const rotateVector = (
    v: [number, number, number]
  ): [number, number, number] => {
    switch (axis) {
      case "x":
        return [v[0], v[1] * cos - v[2] * sin, v[1] * sin + v[2] * cos];
      case "y":
        return [v[0] * cos + v[2] * sin, v[1], -v[0] * sin + v[2] * cos];
      case "z":
        return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos, v[2]];
    }
  };

  return {
    ...plane,
    normal: normalize(rotateVector(plane.normal)),
    u: normalize(rotateVector(plane.u)),
    v: normalize(rotateVector(plane.v)),
  };
}

/**
 * Translate the oblique plane along its normal.
 */
export function translatePlane(
  plane: ObliquePlane,
  distance: number
): ObliquePlane {
  return {
    ...plane,
    origin: [
      plane.origin[0] + plane.normal[0] * distance,
      plane.origin[1] + plane.normal[1] * distance,
      plane.origin[2] + plane.normal[2] * distance,
    ],
  };
}

/**
 * Sample an oblique plane from the volume using trilinear interpolation.
 * Returns an Int16Array of HU values.
 */
export function sampleObliquePlane(
  volume: VolumeData,
  plane: ObliquePlane,
  outputWidth: number,
  outputHeight: number
): Int16Array {
  const output = new Int16Array(outputWidth * outputHeight);

  // Calculate the top-left corner of the output plane
  const halfWidth = (outputWidth - 1) / 2;
  const halfHeight = (outputHeight - 1) / 2;

  // For each output pixel
  for (let v = 0; v < outputHeight; v++) {
    for (let u = 0; u < outputWidth; u++) {
      // Calculate position relative to center
      const uOffset = u - halfWidth;
      const vOffset = v - halfHeight;

      // World position of this output pixel (in voxel coordinates)
      const voxelX =
        plane.origin[0] + plane.u[0] * uOffset + plane.v[0] * vOffset;
      const voxelY =
        plane.origin[1] + plane.u[1] * uOffset + plane.v[1] * vOffset;
      const voxelZ =
        plane.origin[2] + plane.u[2] * uOffset + plane.v[2] * vOffset;

      // Sample with trilinear interpolation
      output[v * outputWidth + u] = Math.round(
        trilinearInterpolation(volume, voxelX, voxelY, voxelZ)
      );
    }
  }

  return output;
}

/**
 * Convert world coordinates to voxel indices.
 */
export function worldToVoxel(
  volume: VolumeData,
  worldX: number,
  worldY: number,
  worldZ: number
): [number, number, number] {
  // Translate by origin
  const dx = worldX - volume.origin[0];
  const dy = worldY - volume.origin[1];
  const dz = worldZ - volume.origin[2];

  // Project onto volume axes (using orientation vectors)
  const { rowDir, colDir, sliceDir } = volume.orientation;

  // Voxel coordinates (may be fractional)
  const voxelX =
    (dx * rowDir[0] + dy * rowDir[1] + dz * rowDir[2]) / volume.spacing[0];
  const voxelY =
    (dx * colDir[0] + dy * colDir[1] + dz * colDir[2]) / volume.spacing[1];
  const voxelZ =
    (dx * sliceDir[0] + dy * sliceDir[1] + dz * sliceDir[2]) / volume.spacing[2];

  return [voxelX, voxelY, voxelZ];
}

/**
 * Convert voxel indices to world coordinates.
 */
export function voxelToWorld(
  volume: VolumeData,
  voxelX: number,
  voxelY: number,
  voxelZ: number
): [number, number, number] {
  const { rowDir, colDir, sliceDir } = volume.orientation;

  // Scale by spacing
  const scaledX = voxelX * volume.spacing[0];
  const scaledY = voxelY * volume.spacing[1];
  const scaledZ = voxelZ * volume.spacing[2];

  // Transform using orientation vectors and add origin
  const worldX =
    volume.origin[0] +
    rowDir[0] * scaledX +
    colDir[0] * scaledY +
    sliceDir[0] * scaledZ;
  const worldY =
    volume.origin[1] +
    rowDir[1] * scaledX +
    colDir[1] * scaledY +
    sliceDir[1] * scaledZ;
  const worldZ =
    volume.origin[2] +
    rowDir[2] * scaledX +
    colDir[2] * scaledY +
    sliceDir[2] * scaledZ;

  return [worldX, worldY, worldZ];
}
