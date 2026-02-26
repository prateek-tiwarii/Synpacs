/**
 * MPR Slice Extraction Web Worker
 *
 * Extracts Axial, Coronal, and Sagittal slices from a 3D volume on a
 * background thread. Holds volume data in memory and produces single
 * slices on demand, enabling progressive MPR loading without
 * pre-generating all slices upfront.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _postMessage: (msg: any, transfer?: Transferable[]) => void =
  (postMessage as any).bind(self);

let volumeData: Int16Array | null = null;
let cols = 0;
let rows = 0;
let totalSlices = 0;
let planeSize = 0; // cols * rows

type PlaneType = "Axial" | "Coronal" | "Sagittal";

function extractAxialSlice(zIndex: number): Int16Array {
  const z = Math.max(0, Math.min(totalSlices - 1, Math.round(zIndex)));
  const slice = new Int16Array(planeSize);
  const offset = z * planeSize;
  slice.set(volumeData!.subarray(offset, offset + planeSize));
  return slice;
}

function extractCoronalSlice(yIndex: number): Int16Array {
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIndex)));
  const slice = new Int16Array(cols * totalSlices);
  const rowOffset = y * cols;

  for (let z = 0; z < totalSlices; z++) {
    const srcBase = z * planeSize + rowOffset;
    const dstBase = (totalSlices - 1 - z) * cols;
    for (let x = 0; x < cols; x++) {
      slice[dstBase + x] = volumeData![srcBase + x];
    }
  }
  return slice;
}

function extractSagittalSlice(xIndex: number): Int16Array {
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIndex)));
  const slice = new Int16Array(rows * totalSlices);

  for (let z = 0; z < totalSlices; z++) {
    const dstBase = (totalSlices - 1 - z) * rows;
    let srcIdx = z * planeSize + x;
    for (let y = 0; y < rows; y++) {
      slice[dstBase + y] = volumeData![srcIdx];
      srcIdx += cols;
    }
  }
  return slice;
}

interface SliceResultPayload {
  plane: PlaneType;
  index: number;
  requestId: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

function extractSlice(
  plane: PlaneType,
  index: number,
): { data: Int16Array; width: number; height: number } {
  switch (plane) {
    case "Axial":
      return { data: extractAxialSlice(index), width: cols, height: rows };
    case "Coronal":
      return {
        data: extractCoronalSlice(index),
        width: cols,
        height: totalSlices,
      };
    case "Sagittal":
      return {
        data: extractSagittalSlice(index),
        width: rows,
        height: totalSlices,
      };
  }
}

onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case "init": {
      cols = payload.cols;
      rows = payload.rows;
      totalSlices = payload.totalSlices;
      planeSize = cols * rows;
      volumeData = new Int16Array(payload.buffer);
      _postMessage({ type: "ready" });
      break;
    }

    case "extractSlice": {
      if (!volumeData) {
        _postMessage({
          type: "error",
          payload: {
            message: "Volume not initialized",
            requestId: payload.requestId,
          },
        });
        break;
      }
      const { plane, index, requestId } = payload;
      const result = extractSlice(plane, index);
      const sliceBuffer = result.data.buffer as ArrayBuffer;
      const msg: SliceResultPayload = {
        plane,
        index,
        requestId,
        buffer: sliceBuffer,
        width: result.width,
        height: result.height,
      };
      _postMessage({ type: "sliceResult", payload: msg }, [sliceBuffer]);
      break;
    }

    case "extractBatch": {
      if (!volumeData) {
        _postMessage({
          type: "error",
          payload: {
            message: "Volume not initialized",
            requestId: payload.requestId,
          },
        });
        break;
      }
      const {
        plane: batchPlane,
        indices,
        requestId: batchReqId,
      } = payload as {
        plane: PlaneType;
        indices: number[];
        requestId: number;
      };
      for (const idx of indices) {
        const result = extractSlice(batchPlane, idx);
        const sliceBuffer = result.data.buffer as ArrayBuffer;
        const msg: SliceResultPayload = {
          plane: batchPlane,
          index: idx,
          requestId: batchReqId,
          buffer: sliceBuffer,
          width: result.width,
          height: result.height,
        };
        _postMessage({ type: "sliceResult", payload: msg }, [sliceBuffer]);
      }
      _postMessage({
        type: "batchComplete",
        payload: { requestId: batchReqId },
      });
      break;
    }
  }
};
