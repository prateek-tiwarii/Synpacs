import dicomParser from "dicom-parser";
import { decode as decodeJ2K } from "@abasb75/openjpeg";

interface ThumbnailOptions {
  apiBaseUrl: string;
  authToken?: string;
  size?: number;
}

const J2K_TRANSFER_SYNTAXES = new Set([
  "1.2.840.10008.1.2.4.90",
  "1.2.840.10008.1.2.4.91",
]);

const DEFAULT_WINDOW_CENTER = 40;
const DEFAULT_WINDOW_WIDTH = 400;

const getFiniteNumber = (value: number | undefined | null): number | undefined =>
  value !== undefined && value !== null && Number.isFinite(value)
    ? value
    : undefined;

const decodePixelData = async (
  arrayBuffer: ArrayBuffer,
  dataSet: dicomParser.DataSet,
  rows: number,
  columns: number,
  slope: number,
  intercept: number,
  winCenter: number,
): Promise<Int16Array | Uint16Array> => {
  const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
  const transferSyntax = dataSet.string("x00020010") ?? "";
  const pixelDataElement = dataSet.elements.x7fe00010;

  if (!pixelDataElement) {
    throw new Error("Pixel Data not found");
  }

  const safeLength =
    pixelDataElement.length > 0
      ? pixelDataElement.length
      : arrayBuffer.byteLength - pixelDataElement.dataOffset;

  if (J2K_TRANSFER_SYNTAXES.has(transferSyntax)) {
    const rawPixelData = new Uint8Array(
      arrayBuffer,
      pixelDataElement.dataOffset,
      safeLength,
    );

    let j2kStart = 0;
    for (let i = 0; i < 4000 && i < rawPixelData.length - 1; i++) {
      if (rawPixelData[i] === 0xff && rawPixelData[i + 1] === 0x4f) {
        j2kStart = i;
        break;
      }
    }

    const decoded = await decodeJ2K(rawPixelData.slice(j2kStart).buffer);
    let rawDecodedBytes = new Uint8Array(new Uint8Array(decoded.decodedBuffer));
    const pixelCount = Math.min(rawDecodedBytes.byteLength / 2, rows * columns);
    const tempView = new Uint16Array(
      rawDecodedBytes.buffer,
      rawDecodedBytes.byteOffset,
      pixelCount,
    );

    const sampleStart = Math.floor(pixelCount / 3);
    const sampleEnd = Math.floor((pixelCount * 2) / 3);
    const sampleStep = Math.max(1, Math.floor((sampleEnd - sampleStart) / 200));

    let normalDist = 0;
    let swappedDist = 0;
    let sampleCount = 0;

    for (
      let sampleIndex = sampleStart;
      sampleIndex < sampleEnd && sampleCount < 200;
      sampleIndex += sampleStep
    ) {
      const value = tempView[sampleIndex];
      if (value === 0) continue;

      const swappedValue = ((value & 0xff) << 8) | ((value >> 8) & 0xff);
      normalDist += Math.abs(value * slope + intercept - winCenter);
      swappedDist += Math.abs(swappedValue * slope + intercept - winCenter);
      sampleCount++;
    }

    const shouldSwap = sampleCount > 0 && swappedDist < normalDist;
    if (shouldSwap) {
      const swapped = new Uint8Array(rawDecodedBytes.length);
      for (let i = 0; i < rawDecodedBytes.length; i += 2) {
        swapped[i] = rawDecodedBytes[i + 1];
        swapped[i + 1] = rawDecodedBytes[i];
      }
      rawDecodedBytes = swapped;
    }

    return pixelRepresentation === 1
      ? new Int16Array(
          rawDecodedBytes.buffer,
          rawDecodedBytes.byteOffset,
          rawDecodedBytes.byteLength / 2,
        )
      : new Uint16Array(
          rawDecodedBytes.buffer,
          rawDecodedBytes.byteOffset,
          rawDecodedBytes.byteLength / 2,
        );
  }

  const rawData = arrayBuffer.slice(
    pixelDataElement.dataOffset,
    pixelDataElement.dataOffset + safeLength,
  );
  return pixelRepresentation === 1
    ? new Int16Array(rawData)
    : new Uint16Array(rawData);
};

export async function generateDicomInstanceThumbnail(
  instanceUid: string,
  { apiBaseUrl, authToken, size = 96 }: ThumbnailOptions,
): Promise<string> {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/instances/${instanceUid}/dicom`,
    {
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch DICOM for thumbnail (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const byteArray = new Uint8Array(arrayBuffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const rows = dataSet.uint16("x00280010");
  const columns = dataSet.uint16("x00280011");

  if (!rows || !columns) {
    throw new Error("Invalid DICOM dimensions");
  }

  const winCenter =
    getFiniteNumber(dataSet.floatString("x00281050")) ??
    DEFAULT_WINDOW_CENTER;
  let winWidth =
    getFiniteNumber(dataSet.floatString("x00281051")) ??
    DEFAULT_WINDOW_WIDTH;
  const slope =
    getFiniteNumber(dataSet.floatString("x00281053")) ??
    1;
  const intercept =
    getFiniteNumber(dataSet.floatString("x00281052")) ??
    0;

  if (!Number.isFinite(winWidth) || winWidth <= 0) {
    winWidth = DEFAULT_WINDOW_WIDTH;
  }

  const pixelData = await decodePixelData(
    arrayBuffer,
    dataSet,
    rows,
    columns,
    slope,
    intercept,
    winCenter,
  );

  const photometricInterpretation =
    (dataSet.string("x00280004") || "").toUpperCase();
  const isMonochrome1 = photometricInterpretation === "MONOCHROME1";
  const pixelCount = Math.min(pixelData.length, rows * columns);
  const rgbaData = new Uint8ClampedArray(rows * columns * 4);
  const minValue = winCenter - winWidth / 2;

  for (let i = 0; i < rows * columns; i++) {
    const value = i < pixelCount ? pixelData[i] * slope + intercept : minValue;
    let displayValue = ((value - minValue) / winWidth) * 255;
    displayValue = Math.max(0, Math.min(255, displayValue));
    if (isMonochrome1) {
      displayValue = 255 - displayValue;
    }

    const idx = i * 4;
    rgbaData[idx] = displayValue;
    rgbaData[idx + 1] = displayValue;
    rgbaData[idx + 2] = displayValue;
    rgbaData[idx + 3] = 255;
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = columns;
  sourceCanvas.height = rows;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    throw new Error("Failed to create thumbnail canvas context");
  }
  sourceCtx.putImageData(new ImageData(rgbaData, columns, rows), 0, 0);

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = size;
  targetCanvas.height = size;
  const targetCtx = targetCanvas.getContext("2d");
  if (!targetCtx) {
    throw new Error("Failed to create thumbnail target context");
  }

  targetCtx.fillStyle = "#111827";
  targetCtx.fillRect(0, 0, size, size);

  const scale = Math.min(size / columns, size / rows);
  const drawWidth = columns * scale;
  const drawHeight = rows * scale;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;

  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight);

  return targetCanvas.toDataURL("image/jpeg", 0.8);
}
