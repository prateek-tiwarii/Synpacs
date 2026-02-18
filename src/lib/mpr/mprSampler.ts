/**
 * MPR Sampler Module
 *
 * Handles slice extraction from volume data for different MPR planes.
 * Supports Axial, Coronal, and Sagittal views.
 */

import type { VolumeData } from "./volumeBuilder";

const WINDOW_LEVEL_LUT_OFFSET = 32768;
const WINDOW_LEVEL_LUT_SIZE = 65536;
const MAX_WINDOW_LEVEL_LUT_CACHE = 8;
const windowLevelLUTCache = new Map<string, Uint8ClampedArray>();

function getWindowLevelLUT(
  windowCenter: number,
  windowWidth: number,
): Uint8ClampedArray {
  const safeWindowWidth = Math.max(windowWidth, 1);
  const cacheKey = `${windowCenter.toFixed(2)}:${safeWindowWidth.toFixed(2)}`;
  const cached = windowLevelLUTCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const lut = new Uint8ClampedArray(WINDOW_LEVEL_LUT_SIZE);
  const minValue = windowCenter - safeWindowWidth / 2;
  const scale = 255 / safeWindowWidth;

  for (let i = 0; i < WINDOW_LEVEL_LUT_SIZE; i++) {
    const huValue = i - WINDOW_LEVEL_LUT_OFFSET;
    const displayValue = Math.max(0, Math.min(255, (huValue - minValue) * scale));
    lut[i] = displayValue;
  }

  windowLevelLUTCache.set(cacheKey, lut);
  if (windowLevelLUTCache.size > MAX_WINDOW_LEVEL_LUT_CACHE) {
    const firstKey = windowLevelLUTCache.keys().next().value as string | undefined;
    if (firstKey) {
      windowLevelLUTCache.delete(firstKey);
    }
  }

  return lut;
}

// Slice geometry information
export interface SliceGeometry {
  width: number; // Pixel width of extracted slice
  height: number; // Pixel height of extracted slice
  pixelSpacingX: number; // Physical spacing in X direction (mm)
  pixelSpacingY: number; // Physical spacing in Y direction (mm)
  physicalWidth: number; // Physical width in mm
  physicalHeight: number; // Physical height in mm
  aspectRatio: number; // Physical aspect ratio (width/height)
}

// Slice extraction result
export interface SliceResult {
  data: Int16Array; // Raw HU values
  width: number;
  height: number;
  geometry: SliceGeometry;
}

export type PlaneType = "Axial" | "Coronal" | "Sagittal";

/**
 * Get the geometry for a slice of the given plane type.
 */
export function getSliceGeometry(
  volume: VolumeData,
  plane: PlaneType,
): SliceGeometry {
  const [cols, rows, slices] = volume.dimensions;
  const [spX, spY, spZ] = volume.spacing;

  switch (plane) {
    case "Axial":
      // XY plane - viewing from top (head to feet direction)
      return {
        width: cols,
        height: rows,
        pixelSpacingX: spX,
        pixelSpacingY: spY,
        physicalWidth: cols * spX,
        physicalHeight: rows * spY,
        aspectRatio: (cols * spX) / (rows * spY),
      };

    case "Coronal":
      // XZ plane - viewing from front (anterior to posterior)
      return {
        width: cols,
        height: slices,
        pixelSpacingX: spX,
        pixelSpacingY: spZ,
        physicalWidth: cols * spX,
        physicalHeight: slices * spZ,
        aspectRatio: (cols * spX) / (slices * spZ),
      };

    case "Sagittal":
      // YZ plane - viewing from side (right to left)
      return {
        width: rows,
        height: slices,
        pixelSpacingX: spY,
        pixelSpacingY: spZ,
        physicalWidth: rows * spY,
        physicalHeight: slices * spZ,
        aspectRatio: (rows * spY) / (slices * spZ),
      };
  }
}

/**
 * Extract an Axial slice from the volume.
 * Axial: XY plane, Z (slice index) is fixed.
 */
export function extractAxialSlice(
  volume: VolumeData,
  zIndex: number,
): SliceResult {
  const [cols, rows, slices] = volume.dimensions;

  // Clamp index to valid range
  const z = Math.max(0, Math.min(slices - 1, Math.round(zIndex)));

  const sliceSize = cols * rows;
  const slice = new Int16Array(sliceSize);

  // Direct copy from volume - axial is the native slice orientation
  const offset = z * sliceSize;
  slice.set(volume.data.subarray(offset, offset + sliceSize));

  return {
    data: slice,
    width: cols,
    height: rows,
    geometry: getSliceGeometry(volume, "Axial"),
  };
}

/**
 * Extract a Coronal slice from the volume.
 * Coronal: XZ plane, Y (row index) is fixed.
 * Viewing direction: anterior to posterior (front to back).
 */
export function extractCoronalSlice(
  volume: VolumeData,
  yIndex: number,
): SliceResult {
  const [cols, rows, slices] = volume.dimensions;

  // Clamp index to valid range
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIndex)));

  const slice = new Int16Array(cols * slices);
  const planeSize = cols * rows;
  const rowOffset = y * cols;

  // Iterate over X (columns) and Z (slices)
  // Y is fixed at yIndex
  for (let z = 0; z < slices; z++) {
    const srcBase = z * planeSize + rowOffset;
    const dstBase = (slices - 1 - z) * cols;
    for (let x = 0; x < cols; x++) {
      // Destination flips Z so superior appears at top
      slice[dstBase + x] = volume.data[srcBase + x];
    }
  }

  return {
    data: slice,
    width: cols,
    height: slices,
    geometry: getSliceGeometry(volume, "Coronal"),
  };
}

/**
 * Extract a Sagittal slice from the volume.
 * Sagittal: YZ plane, X (column index) is fixed.
 * Viewing direction: right to left (from the patient's right side).
 */
export function extractSagittalSlice(
  volume: VolumeData,
  xIndex: number,
): SliceResult {
  const [cols, rows, slices] = volume.dimensions;

  // Clamp index to valid range
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIndex)));

  const slice = new Int16Array(rows * slices);
  const planeSize = cols * rows;

  // Iterate over Y (rows) and Z (slices)
  // X is fixed at xIndex
  for (let z = 0; z < slices; z++) {
    const dstBase = (slices - 1 - z) * rows;
    let srcIdx = z * planeSize + x;
    for (let y = 0; y < rows; y++) {
      // Destination flips Z so superior appears at top
      slice[dstBase + y] = volume.data[srcIdx];
      srcIdx += cols;
    }
  }

  return {
    data: slice,
    width: rows,
    height: slices,
    geometry: getSliceGeometry(volume, "Sagittal"),
  };
}

/**
 * Extract a slice from the volume for the given plane type and index.
 */
export function extractSlice(
  volume: VolumeData,
  plane: PlaneType,
  index: number,
): SliceResult {
  switch (plane) {
    case "Axial":
      return extractAxialSlice(volume, index);
    case "Coronal":
      return extractCoronalSlice(volume, index);
    case "Sagittal":
      return extractSagittalSlice(volume, index);
  }
}

/**
 * Get the maximum index for a given plane type.
 */
export function getMaxIndex(volume: VolumeData, plane: PlaneType): number {
  const [cols, rows, slices] = volume.dimensions;
  switch (plane) {
    case "Axial":
      return slices - 1;
    case "Coronal":
      return rows - 1;
    case "Sagittal":
      return cols - 1;
  }
}

/**
 * Get the index in the volume for a given plane from crosshair position.
 */
export function getIndexForPlane(
  crosshair: { x: number; y: number; z: number },
  plane: PlaneType,
): number {
  switch (plane) {
    case "Axial":
      return crosshair.z;
    case "Coronal":
      return crosshair.y;
    case "Sagittal":
      return crosshair.x;
  }
}

/**
 * Update crosshair position based on click in a specific plane.
 * Returns the updated crosshair coordinates.
 */
export function updateCrosshairFromClick(
  plane: PlaneType,
  clickX: number, // Normalized 0-1
  clickY: number, // Normalized 0-1
  volume: VolumeData,
  currentCrosshair: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const [cols, rows, slices] = volume.dimensions;

  switch (plane) {
    case "Axial":
      // Axial view: click updates X and Y
      return {
        x: Math.round(clickX * (cols - 1)),
        y: Math.round(clickY * (rows - 1)),
        z: currentCrosshair.z,
      };

    case "Coronal":
      // Coronal view: click updates X and Z
      // Note: Y in screen space maps to Z in volume (inverted)
      return {
        x: Math.round(clickX * (cols - 1)),
        y: currentCrosshair.y,
        z: Math.round((1 - clickY) * (slices - 1)),
      };

    case "Sagittal":
      // Sagittal view: click updates Y and Z
      // Note: Y in screen space maps to Z in volume (inverted)
      return {
        x: currentCrosshair.x,
        y: Math.round(clickX * (rows - 1)),
        z: Math.round((1 - clickY) * (slices - 1)),
      };
  }
}

/**
 * Get crosshair position in screen coordinates for a specific plane view.
 * Returns normalized 0-1 coordinates.
 */
export function getCrosshairScreenPosition(
  plane: PlaneType,
  crosshair: { x: number; y: number; z: number },
  volume: VolumeData,
): { x: number; y: number } {
  const [cols, rows, slices] = volume.dimensions;

  switch (plane) {
    case "Axial":
      // Axial view: X maps to screen X, Y maps to screen Y
      return {
        x: crosshair.x / (cols - 1),
        y: crosshair.y / (rows - 1),
      };

    case "Coronal":
      // Coronal view: X maps to screen X, Z maps to screen Y (inverted)
      return {
        x: crosshair.x / (cols - 1),
        y: 1 - crosshair.z / (slices - 1),
      };

    case "Sagittal":
      // Sagittal view: Y maps to screen X, Z maps to screen Y (inverted)
      return {
        x: crosshair.y / (rows - 1),
        y: 1 - crosshair.z / (slices - 1),
      };
  }
}

/**
 * Extract a MiniMIP (thin-slab Maximum Intensity Projection) slice from the volume.
 * For each pixel position, the maximum HU value across a slab of consecutive slices
 * centered on `centerIndex` is projected.
 */
export function extractMiniMIPSlice(
  volume: VolumeData,
  plane: PlaneType,
  centerIndex: number,
  slabHalfSize: number = 5,
): SliceResult {
  const [cols, rows, slices] = volume.dimensions;

  switch (plane) {
    case "Axial": {
      const slice = new Int16Array(cols * rows);
      const zMin = Math.max(0, centerIndex - slabHalfSize);
      const zMax = Math.min(slices - 1, centerIndex + slabHalfSize);

      // Initialize with first slab slice
      const firstOffset = zMin * cols * rows;
      for (let i = 0; i < cols * rows; i++) {
        slice[i] = volume.data[firstOffset + i];
      }

      // Take max across remaining slab slices
      for (let z = zMin + 1; z <= zMax; z++) {
        const offset = z * cols * rows;
        for (let i = 0; i < cols * rows; i++) {
          if (volume.data[offset + i] > slice[i]) {
            slice[i] = volume.data[offset + i];
          }
        }
      }

      return {
        data: slice,
        width: cols,
        height: rows,
        geometry: getSliceGeometry(volume, "Axial"),
      };
    }

    case "Coronal": {
      const slice = new Int16Array(cols * slices);
      const yMin = Math.max(0, centerIndex - slabHalfSize);
      const yMax = Math.min(rows - 1, centerIndex + slabHalfSize);

      // Initialize with -32768 (min Int16) so first comparison always wins
      slice.fill(-32768);

      for (let y = yMin; y <= yMax; y++) {
        for (let z = 0; z < slices; z++) {
          for (let x = 0; x < cols; x++) {
            const srcIdx = z * (cols * rows) + y * cols + x;
            const dstIdx = (slices - 1 - z) * cols + x;
            if (volume.data[srcIdx] > slice[dstIdx]) {
              slice[dstIdx] = volume.data[srcIdx];
            }
          }
        }
      }

      return {
        data: slice,
        width: cols,
        height: slices,
        geometry: getSliceGeometry(volume, "Coronal"),
      };
    }

    case "Sagittal": {
      const slice = new Int16Array(rows * slices);
      const xMin = Math.max(0, centerIndex - slabHalfSize);
      const xMax = Math.min(cols - 1, centerIndex + slabHalfSize);

      // Initialize with -32768 (min Int16) so first comparison always wins
      slice.fill(-32768);

      for (let x = xMin; x <= xMax; x++) {
        for (let z = 0; z < slices; z++) {
          for (let y = 0; y < rows; y++) {
            const srcIdx = z * (cols * rows) + y * cols + x;
            const dstIdx = (slices - 1 - z) * rows + y;
            if (volume.data[srcIdx] > slice[dstIdx]) {
              slice[dstIdx] = volume.data[srcIdx];
            }
          }
        }
      }

      return {
        data: slice,
        width: rows,
        height: slices,
        geometry: getSliceGeometry(volume, "Sagittal"),
      };
    }
  }
}

/**
 * Apply window/level to slice data and convert to RGBA ImageData.
 */
export function applyWindowLevel(
  sliceData: Int16Array,
  width: number,
  height: number,
  windowCenter: number,
  windowWidth: number,
): ImageData {
  const rgbaData = new Uint8ClampedArray(width * height * 4);
  const lut = getWindowLevelLUT(windowCenter, windowWidth);

  for (let i = 0, rgbaIdx = 0; i < sliceData.length; i++, rgbaIdx += 4) {
    const displayValue = lut[sliceData[i] + WINDOW_LEVEL_LUT_OFFSET];
    rgbaData[rgbaIdx] = displayValue; // R
    rgbaData[rgbaIdx + 1] = displayValue; // G
    rgbaData[rgbaIdx + 2] = displayValue; // B
    rgbaData[rgbaIdx + 3] = 255; // A
  }

  return new ImageData(rgbaData, width, height);
}
