/**
 * MIP / MiniMIP Projection Web Worker
 *
 * Computes Maximum Intensity Projection (MIP) or Minimum Intensity Projection (MiniMIP)
 * slices on a background thread. Holds volume data in memory and produces single slices
 * on demand, enabling real-time projection without precomputing all slices upfront.
 *
 * MIP: per-pixel max along ray — angiography, vessels, high-density structures.
 * MiniMIP: per-pixel min along ray — airways, lung parenchyma, hypodense structures.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _postMessage: (msg: any, transfer?: Transferable[]) => void =
  (postMessage as any).bind(self);

let volumeData: Int16Array | null = null;
let cols = 0;
let rows = 0;
let totalSlices = 0;
let planeSize = 0;

type ProjectionMode = "MIP" | "MiniMIP";

function computeSingleSlice(
  z: number,
  slabHalfSize: number,
  mode: ProjectionMode,
): Int16Array {
  const result = new Int16Array(planeSize);

  if (slabHalfSize <= 0) {
    const offset = z * planeSize;
    result.set(volumeData!.subarray(offset, offset + planeSize));
    return result;
  }

  const zStart = Math.max(0, z - slabHalfSize);
  const zEnd = Math.min(totalSlices - 1, z + slabHalfSize);

  const firstOffset = zStart * planeSize;
  result.set(volumeData!.subarray(firstOffset, firstOffset + planeSize));

  if (mode === "MIP") {
    for (let sz = zStart + 1; sz <= zEnd; sz++) {
      const offset = sz * planeSize;
      for (let i = 0; i < planeSize; i++) {
        const v = volumeData![offset + i];
        if (v > result[i]) result[i] = v;
      }
    }
  } else {
    for (let sz = zStart + 1; sz <= zEnd; sz++) {
      const offset = sz * planeSize;
      for (let i = 0; i < planeSize; i++) {
        const v = volumeData![offset + i];
        if (v < result[i]) result[i] = v;
      }
    }
  }

  return result;
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

    case "computeSlice": {
      if (!volumeData) {
        _postMessage({
          type: "error",
          payload: { message: "Volume not initialized", requestId: payload.requestId },
        });
        break;
      }
      const { z, slabHalfSize, requestId, projectionMode = "MIP" } = payload;
      const result = computeSingleSlice(z, slabHalfSize, projectionMode);
      _postMessage(
        {
          type: "sliceResult",
          payload: { z, slabHalfSize, requestId, projectionMode, buffer: result.buffer },
        },
        [result.buffer],
      );
      break;
    }

    case "computeBatch": {
      if (!volumeData) {
        _postMessage({
          type: "error",
          payload: { message: "Volume not initialized", requestId: payload.requestId },
        });
        break;
      }
      const { indices, slabHalfSize: batchSlab, requestId: batchReqId, projectionMode = "MIP" } = payload;
      for (const z of indices as number[]) {
        const result = computeSingleSlice(z, batchSlab, projectionMode);
        _postMessage(
          {
            type: "sliceResult",
            payload: { z, slabHalfSize: batchSlab, requestId: batchReqId, projectionMode, buffer: result.buffer },
          },
          [result.buffer],
        );
      }
      _postMessage({
        type: "batchComplete",
        payload: { requestId: batchReqId },
      });
      break;
    }
  }
};
