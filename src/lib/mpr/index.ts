/**
 * MPR (Multiplanar Reconstruction) Module
 *
 * Exports all MPR-related functionality for volume construction,
 * slice sampling, and oblique plane interpolation.
 */

// Volume Builder
export {
  type Instance,
  type VolumeData,
  type ValidationResult,
  type SortResult,
  calculateSliceNormal,
  projectOntoNormal,
  sortSlicesByPosition,
  validateStackability,
  buildVolume,
} from "./volumeBuilder";

// MPR Sampler
export {
  type SliceGeometry,
  type SliceResult,
  type PlaneType,
  getSliceGeometry,
  extractAxialSlice,
  extractCoronalSlice,
  extractSagittalSlice,
  extractSlice,
  getMaxIndex,
  getIndexForPlane,
  updateCrosshairFromClick,
  getCrosshairScreenPosition,
  applyWindowLevel,
} from "./mprSampler";

// Interpolation
export {
  type ObliquePlane,
  getVoxel,
  trilinearInterpolation,
  normalize,
  cross,
  dot,
  createInitialObliquePlane,
  rotatePlane,
  translatePlane,
  sampleObliquePlane,
  worldToVoxel,
  voxelToWorld,
} from "./interpolation";
