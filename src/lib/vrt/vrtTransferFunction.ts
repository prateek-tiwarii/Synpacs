/**
 * VRT Transfer Function — Maps HU values to RGBA for volume rendering.
 *
 * Provides clinically-meaningful presets (Bone, Skin, Angio, MIP) and
 * generates a 4096-entry RGBA lookup texture for the raycasting shader.
 */

export interface TransferFunctionControlPoint {
  hu: number;
  color: [number, number, number]; // RGB 0-255
  opacity: number; // 0-1
}

export interface TransferFunctionPreset {
  name: string;
  controlPoints: TransferFunctionControlPoint[];
}

export const VRT_PRESETS: Record<string, TransferFunctionPreset> = {
  "CT-Bone": {
    name: "Bone",
    controlPoints: [
      { hu: -1000, color: [0, 0, 0], opacity: 0.0 },
      { hu: 100, color: [0, 0, 0], opacity: 0.0 },
      { hu: 200, color: [180, 130, 80], opacity: 0.05 },
      { hu: 400, color: [220, 190, 140], opacity: 0.25 },
      { hu: 800, color: [245, 240, 220], opacity: 0.6 },
      { hu: 2000, color: [255, 255, 255], opacity: 0.9 },
    ],
  },
  "CT-Skin": {
    name: "Skin Surface",
    controlPoints: [
      { hu: -1000, color: [0, 0, 0], opacity: 0.0 },
      { hu: -500, color: [0, 0, 0], opacity: 0.0 },
      { hu: -100, color: [194, 142, 97], opacity: 0.0 },
      { hu: -50, color: [194, 142, 97], opacity: 0.12 },
      { hu: 300, color: [230, 190, 150], opacity: 0.25 },
      { hu: 1000, color: [255, 255, 255], opacity: 0.5 },
      { hu: 3000, color: [255, 255, 255], opacity: 0.85 },
    ],
  },
  "CT-Angio": {
    name: "CT Angiography",
    controlPoints: [
      { hu: -1000, color: [0, 0, 0], opacity: 0.0 },
      { hu: 0, color: [0, 0, 0], opacity: 0.0 },
      { hu: 100, color: [200, 50, 50], opacity: 0.08 },
      { hu: 200, color: [255, 80, 80], opacity: 0.4 },
      { hu: 500, color: [255, 200, 200], opacity: 0.6 },
      { hu: 1000, color: [255, 255, 255], opacity: 0.85 },
    ],
  },
  MIP: {
    name: "Maximum Intensity",
    controlPoints: [
      { hu: -1000, color: [0, 0, 0], opacity: 0.0 },
      { hu: 0, color: [40, 40, 40], opacity: 0.005 },
      { hu: 500, color: [180, 180, 180], opacity: 0.03 },
      { hu: 1000, color: [255, 255, 255], opacity: 0.06 },
      { hu: 3000, color: [255, 255, 255], opacity: 0.2 },
    ],
  },
};

// HU range: [-1024, 3071] → index [0, 4095]
const HU_MIN = -1024;
const TF_SIZE = 4096;

function huToIndex(hu: number): number {
  return Math.max(0, Math.min(TF_SIZE - 1, Math.round(hu - HU_MIN)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Generate a 4096-entry RGBA Uint8Array from a preset's control points.
 * Linearly interpolates between control points.
 */
export function generateTransferFunctionTexture(
  preset: TransferFunctionPreset,
): Uint8Array {
  const data = new Uint8Array(TF_SIZE * 4);
  const points = preset.controlPoints;

  if (points.length === 0) return data;

  // Sort by HU
  const sorted = [...points].sort((a, b) => a.hu - b.hu);

  let cpIdx = 0;

  for (let i = 0; i < TF_SIZE; i++) {
    const hu = i + HU_MIN; // Map index back to HU

    // Find the two surrounding control points
    while (cpIdx < sorted.length - 1 && sorted[cpIdx + 1].hu <= hu) {
      cpIdx++;
    }

    let r: number, g: number, b: number, a: number;

    if (cpIdx >= sorted.length - 1) {
      // Past last control point
      const last = sorted[sorted.length - 1];
      r = last.color[0];
      g = last.color[1];
      b = last.color[2];
      a = last.opacity;
    } else if (hu <= sorted[0].hu) {
      // Before first control point
      r = sorted[0].color[0];
      g = sorted[0].color[1];
      b = sorted[0].color[2];
      a = sorted[0].opacity;
    } else {
      // Interpolate between cpIdx and cpIdx + 1
      const p0 = sorted[cpIdx];
      const p1 = sorted[cpIdx + 1];
      const t =
        p1.hu === p0.hu ? 0 : (hu - p0.hu) / (p1.hu - p0.hu);

      r = lerp(p0.color[0], p1.color[0], t);
      g = lerp(p0.color[1], p1.color[1], t);
      b = lerp(p0.color[2], p1.color[2], t);
      a = lerp(p0.opacity, p1.opacity, t);
    }

    const offset = i * 4;
    data[offset] = Math.round(Math.max(0, Math.min(255, r)));
    data[offset + 1] = Math.round(Math.max(0, Math.min(255, g)));
    data[offset + 2] = Math.round(Math.max(0, Math.min(255, b)));
    data[offset + 3] = Math.round(Math.max(0, Math.min(255, a * 255)));
  }

  return data;
}
