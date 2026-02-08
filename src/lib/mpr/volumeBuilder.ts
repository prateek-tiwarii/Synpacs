/**
 * Volume Builder Module
 *
 * Handles volume construction from DICOM slices for MPR rendering.
 * Includes slice sorting, validation, and volume data assembly.
 */

import dicomParser from "dicom-parser";
import { decode as decodeJ2K } from "@abasb75/openjpeg";

// Instance interface matching the API response
export interface Instance {
  instance_uid: string;
  imageId: string;
  sort_key: number;
  rows: number;
  columns: number;
  pixel_spacing: number[];
  slice_thickness: number;
  image_position_patient: number[];
  image_orientation_patient: number[];
  window_center: number;
  window_width: number;
  rescale_slope: number;
  rescale_intercept: number;
  photometric_interpretation: string;
  samples_per_pixel: number;
  modality: string;
}

// Volume data structure
export interface VolumeData {
  data: Int16Array; // HU values, flattened [z][y][x]
  dimensions: [number, number, number]; // [cols, rows, slices]
  spacing: [number, number, number]; // [x, y, z] in mm
  origin: [number, number, number]; // First slice position in patient coords
  orientation: {
    rowDir: [number, number, number];
    colDir: [number, number, number];
    sliceDir: [number, number, number];
  };
  windowCenter: number;
  windowWidth: number;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Sorting result
export interface SortResult {
  sortedInstances: Instance[];
  sliceSpacing: number;
  normal: [number, number, number];
}

const ORIENTATION_TOLERANCE = 0.001;
const SPACING_TOLERANCE = 0.1; // 10%

/**
 * Calculate the normal vector (slice direction) from orientation cosines.
 * The normal is the cross product of the row and column direction vectors.
 */
export function calculateSliceNormal(
  orientation: number[],
): [number, number, number] {
  const rowDir: [number, number, number] = [
    orientation[0],
    orientation[1],
    orientation[2],
  ];
  const colDir: [number, number, number] = [
    orientation[3],
    orientation[4],
    orientation[5],
  ];

  // Cross product: rowDir x colDir = normal
  const normal: [number, number, number] = [
    rowDir[1] * colDir[2] - rowDir[2] * colDir[1],
    rowDir[2] * colDir[0] - rowDir[0] * colDir[2],
    rowDir[0] * colDir[1] - rowDir[1] * colDir[0],
  ];

  return normal;
}

/**
 * Project a 3D position onto the normal vector to get slice position along stack.
 */
export function projectOntoNormal(
  position: number[],
  normal: [number, number, number],
): number {
  return (
    position[0] * normal[0] + position[1] * normal[1] + position[2] * normal[2]
  );
}

/**
 * Check if two orientations match within tolerance.
 */
function orientationsMatch(orient1: number[], orient2: number[]): boolean {
  for (let i = 0; i < 6; i++) {
    if (Math.abs(orient1[i] - orient2[i]) > ORIENTATION_TOLERANCE) {
      return false;
    }
  }
  return true;
}

/**
 * Check if two pixel spacings match within tolerance.
 */
function spacingsMatch(spacing1: number[], spacing2: number[]): boolean {
  return (
    Math.abs(spacing1[0] - spacing2[0]) < 0.001 &&
    Math.abs(spacing1[1] - spacing2[1]) < 0.001
  );
}

/**
 * Sort slices by their position along the volume normal.
 */
export function sortSlicesByPosition(instances: Instance[]): SortResult {
  if (instances.length === 0) {
    throw new Error("No instances provided");
  }

  // Calculate normal from first instance
  const firstOrientation = instances[0].image_orientation_patient;
  const normal = calculateSliceNormal(firstOrientation);

  // Calculate projection for each slice
  const slicesWithProjection = instances.map((instance) => ({
    instance,
    projection: projectOntoNormal(instance.image_position_patient, normal),
  }));

  // Sort by projection (ascending order along normal)
  slicesWithProjection.sort((a, b) => a.projection - b.projection);

  // Calculate average spacing between consecutive slices
  let totalSpacing = 0;
  for (let i = 1; i < slicesWithProjection.length; i++) {
    totalSpacing +=
      slicesWithProjection[i].projection -
      slicesWithProjection[i - 1].projection;
  }
  const sliceSpacing =
    slicesWithProjection.length > 1
      ? totalSpacing / (slicesWithProjection.length - 1)
      : instances[0].slice_thickness || 1;

  return {
    sortedInstances: slicesWithProjection.map((s) => s.instance),
    sliceSpacing: Math.abs(sliceSpacing),
    normal,
  };
}

/**
 * Validate if a series is stackable for MPR reconstruction.
 */
export function validateStackability(instances: Instance[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (instances.length < 2) {
    errors.push("Minimum 2 slices required for MPR");
    return { valid: false, errors, warnings };
  }

  const reference = instances[0];

  // 1. Validate consistent dimensions
  const inconsistentDimensions = instances.filter(
    (inst) =>
      inst.rows !== reference.rows || inst.columns !== reference.columns,
  );
  if (inconsistentDimensions.length > 0) {
    errors.push(
      `${inconsistentDimensions.length} slices have inconsistent dimensions. Expected ${reference.columns}x${reference.rows}`,
    );
  }

  // 2. Validate consistent orientation
  const refOrientation = reference.image_orientation_patient;
  const inconsistentOrientation = instances.filter(
    (inst) =>
      !orientationsMatch(inst.image_orientation_patient, refOrientation),
  );
  if (inconsistentOrientation.length > 0) {
    errors.push(
      `${inconsistentOrientation.length} slices have inconsistent orientation`,
    );
  }

  // 3. Validate consistent pixel spacing
  const refSpacing = reference.pixel_spacing;
  const inconsistentSpacing = instances.filter(
    (inst) => !spacingsMatch(inst.pixel_spacing, refSpacing),
  );
  if (inconsistentSpacing.length > 0) {
    warnings.push(
      `${inconsistentSpacing.length} slices have slightly different pixel spacing`,
    );
  }

  // 4. Sort and check uniform slice spacing
  try {
    const { sortedInstances, normal } = sortSlicesByPosition(instances);

    // Calculate all spacings
    const projections = sortedInstances.map((inst) =>
      projectOntoNormal(inst.image_position_patient, normal),
    );

    const spacings: number[] = [];
    for (let i = 1; i < projections.length; i++) {
      spacings.push(projections[i] - projections[i - 1]);
    }

    if (spacings.length > 0) {
      const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
      const nonUniformSlices = spacings.filter(
        (s) => Math.abs(s - avgSpacing) / avgSpacing > SPACING_TOLERANCE,
      );

      if (nonUniformSlices.length > 0) {
        warnings.push(
          `${nonUniformSlices.length} slice gaps deviate >10% from average spacing (${avgSpacing.toFixed(2)}mm)`,
        );
      }

      // Check for duplicate positions
      const duplicates = spacings.filter((s) => Math.abs(s) < 0.001);
      if (duplicates.length > 0) {
        errors.push(`${duplicates.length} duplicate slice positions detected`);
      }
    }
  } catch (e) {
    errors.push(`Failed to sort slices: ${e}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Extract pixel data from a DICOM ArrayBuffer.
 * Reuses the same decoding logic as DicomViewer.
 * Note: Creates copies of buffers to avoid detached ArrayBuffer errors.
 */
async function extractPixelData(
  arrayBuffer: ArrayBuffer,
  _instance: Instance,
): Promise<Int16Array | Uint16Array> {
  // Create a copy of the ArrayBuffer to avoid issues with detached buffers
  const bufferCopy = arrayBuffer.slice(0);
  const byteArray = new Uint8Array(bufferCopy);
  const dataSet = dicomParser.parseDicom(byteArray);

  const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
  const transferSyntax = dataSet.string("x00020010");
  const pixelDataElement = dataSet.elements.x7fe00010;

  if (!pixelDataElement) {
    throw new Error("Pixel Data not found");
  }

  let pixelData: Int16Array | Uint16Array;
  const safeLength =
    pixelDataElement.length > 0
      ? pixelDataElement.length
      : bufferCopy.byteLength - pixelDataElement.dataOffset;

  const isJ2K =
    transferSyntax === "1.2.840.10008.1.2.4.90" ||
    transferSyntax === "1.2.840.10008.1.2.4.91";

  if (isJ2K) {
    // Get the pixel data as a Uint8Array view into the buffer
    // This matches the approach used in DicomViewer which works reliably
    const rawPixelData = new Uint8Array(
      bufferCopy,
      pixelDataElement.dataOffset,
      safeLength,
    );

    // Find J2K start marker (0xFF 0x4F)
    let j2kStart = 0;
    for (let i = 0; i < 4000 && i < rawPixelData.length - 1; i++) {
      if (rawPixelData[i] === 0xff && rawPixelData[i + 1] === 0x4f) {
        j2kStart = i;
        break;
      }
    }

    // Pass the sliced buffer to decoder
    const decoded = await decodeJ2K(rawPixelData.slice(j2kStart).buffer);

    // Extract decoded data
    // Note: With serial decoding (CONCURRENT_LOADS=1), buffer detachment issues are minimized
    let decodedData = new Uint8Array(decoded.decodedBuffer);

    if (decodedData.length === 0) {
      throw new Error(
        `J2K decoder returned empty data. Buffer size: ${decoded.decodedBuffer.byteLength}, Frame info: ${JSON.stringify(decoded.frameInfo)}`
      );
    }

    // Byte swap detection - use first 100 samples
    const sampleCount = Math.min(100, decodedData.length / 2);
    const temp = new Uint16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      temp[i] = decodedData[i * 2] | (decodedData[i * 2 + 1] << 8);
    }

    let finalBytes = decodedData;
    if (Math.max(...Array.from(temp)) < 256) {
      // Need byte swap
      const swapped = new Uint8Array(decodedData.length);
      for (let i = 0; i < decodedData.length; i += 2) {
        swapped[i] = decodedData[i + 1];
        swapped[i + 1] = decodedData[i];
      }
      finalBytes = swapped;
    }

    // Create the final typed array from the byte data
    const pixelCount = finalBytes.length / 2;
    if (pixelRepresentation === 1) {
      pixelData = new Int16Array(pixelCount);
      const view = new DataView(
        finalBytes.buffer,
        finalBytes.byteOffset,
        finalBytes.byteLength,
      );
      for (let i = 0; i < pixelCount; i++) {
        pixelData[i] = view.getInt16(i * 2, true); // little-endian
      }
    } else {
      pixelData = new Uint16Array(pixelCount);
      const view = new DataView(
        finalBytes.buffer,
        finalBytes.byteOffset,
        finalBytes.byteLength,
      );
      for (let i = 0; i < pixelCount; i++) {
        pixelData[i] = view.getUint16(i * 2, true); // little-endian
      }
    }
  } else {
    // Uncompressed data - create a clean copy
    const rawData = bufferCopy.slice(
      pixelDataElement.dataOffset,
      pixelDataElement.dataOffset + safeLength,
    );
    pixelData =
      pixelRepresentation === 1
        ? new Int16Array(rawData)
        : new Uint16Array(rawData);
  }

  return pixelData;
}

/**
 * Build a 3D volume from sorted DICOM instances.
 */
export async function buildVolume(
  sortedInstances: Instance[],
  cache: Map<string, ArrayBuffer>, // Accepts external cache (can be global imageCache)
  apiBaseUrl: string,
  authToken: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<VolumeData> {
  const firstInstance = sortedInstances[0];
  const cols = firstInstance.columns;
  const rows = firstInstance.rows;
  const slices = sortedInstances.length;

  // Allocate contiguous array for entire volume
  const volumeArray = new Int16Array(cols * rows * slices);

  // Calculate slice spacing
  const { sliceSpacing, normal } = sortSlicesByPosition(sortedInstances);

  // Load slices serially (concurrency = 1) to avoid WASM decoder conflicts
  // The openjpeg WASM decoder has global state that can be corrupted by parallel decoding
  const CONCURRENT_LOADS = 1;
  let loadedCount = 0;

  const loadSlice = async (instance: Instance, sliceIndex: number) => {
    let arrayBuffer: ArrayBuffer;

    // Check cache first
    if (cache.has(instance.instance_uid)) {
      // Get from cache and make a copy to avoid detachment issues
      const cached = cache.get(instance.instance_uid)!;
      // Check if buffer is detached before using
      try {
        arrayBuffer = cached.slice(0);
      } catch {
        // Buffer was detached, need to refetch
        const response = await fetch(
          `${apiBaseUrl}/api/v1/instances/${instance.instance_uid}/dicom`,
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch instance ${instance.instance_uid}`);
        }
        arrayBuffer = await response.arrayBuffer();
        cache.set(instance.instance_uid, arrayBuffer.slice(0)); // Store a copy
      }
    } else {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/instances/${instance.instance_uid}/dicom`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch instance ${instance.instance_uid}`);
      }
      arrayBuffer = await response.arrayBuffer();
      // Store a copy in cache to preserve original
      cache.set(instance.instance_uid, arrayBuffer.slice(0));
    }

    // Extract pixel data (this function now handles its own buffer copying)
    const pixelData = await extractPixelData(arrayBuffer, instance);

    // Apply rescale slope/intercept to get HU values
    const slope = instance.rescale_slope || 1;
    const intercept = instance.rescale_intercept || 0;

    // Copy to volume array at correct position
    const sliceOffset = sliceIndex * cols * rows;
    for (let i = 0; i < pixelData.length; i++) {
      volumeArray[sliceOffset + i] = Math.round(
        pixelData[i] * slope + intercept,
      );
    }

    loadedCount++;
    onProgress?.(loadedCount, slices);
  };

  // Process in batches
  for (let i = 0; i < sortedInstances.length; i += CONCURRENT_LOADS) {
    const batch = sortedInstances.slice(i, i + CONCURRENT_LOADS);
    await Promise.all(
      batch.map((instance, batchIdx) => loadSlice(instance, i + batchIdx)),
    );
  }

  // Build orientation vectors
  const orient = firstInstance.image_orientation_patient;
  const rowDir: [number, number, number] = [orient[0], orient[1], orient[2]];
  const colDir: [number, number, number] = [orient[3], orient[4], orient[5]];

  return {
    data: volumeArray,
    dimensions: [cols, rows, slices],
    spacing: [
      firstInstance.pixel_spacing[1], // Column spacing (X)
      firstInstance.pixel_spacing[0], // Row spacing (Y)
      sliceSpacing, // Slice spacing (Z)
    ],
    origin: firstInstance.image_position_patient as [number, number, number],
    orientation: {
      rowDir,
      colDir,
      sliceDir: normal,
    },
    windowCenter: firstInstance.window_center || 40,
    windowWidth: firstInstance.window_width || 400,
  };
}
