/**
 * TemporaryMPRSeriesViewer Component
 *
 * Displays pre-generated MPR slices from a temporary series.
 * These slices are stored in memory and can be scrolled through.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  useViewerContext,
  type TemporaryMPRSeries,
  type ViewTransform,
} from "../ViewerLayout";
import { Maximize, Minimize } from "lucide-react";
import type { ScoutLine } from "./DicomViewer";
import { applyWindowLevel } from "@/lib/mpr";

interface TemporaryMPRSeriesViewerProps {
  series: TemporaryMPRSeries;
  className?: string;
  scoutLines?: ScoutLine[];
  onImageIndexChange?: (index: number) => void;
  compact?: boolean;
  viewTransformOverride?: ViewTransform;
  onViewTransformChangeOverride?: (
    transform: ViewTransform | ((prev: ViewTransform) => ViewTransform),
  ) => void;
  isFullscreenOverride?: boolean;
  onToggleFullscreenOverride?: () => void;
}

// Helper to format DICOM date (YYYYMMDD) to readable format
const formatDicomDate = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}/${month}/${year}`;
};

export function TemporaryMPRSeriesViewer({
  series,
  className = "",
  scoutLines,
  onImageIndexChange,
  compact = false,
  viewTransformOverride,
  onViewTransformChangeOverride,
  isFullscreenOverride,
  onToggleFullscreenOverride,
}: TemporaryMPRSeriesViewerProps) {
  const {
    activeTool,
    stackSpeed,
    viewTransform: globalViewTransform,
    setViewTransform: setGlobalViewTransform,
    caseData,
    isFullscreen: globalIsFullscreen,
    toggleFullscreen: toggleGlobalFullscreen,
    setCurrentImageIndex,
  } = useViewerContext();
  const viewTransform = viewTransformOverride ?? globalViewTransform;
  const setViewTransform =
    onViewTransformChangeOverride ?? setGlobalViewTransform;
  const isFullscreen = isFullscreenOverride ?? globalIsFullscreen;
  const toggleFullscreen =
    onToggleFullscreenOverride ?? toggleGlobalFullscreen;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoutCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const lastX = useRef(0);
  const MAX_IMAGE_DATA_CACHE = 320;
  const MAX_BITMAP_CACHE = 160;
  const bitmapCacheRef = useRef<Map<number, ImageBitmap>>(new Map());
  const imageDataCacheRef = useRef<Map<number, ImageData>>(new Map());
  const pendingBitmapGenerationRef = useRef<Set<number>>(new Set());
  const wheelAccumulator = useRef(0);
  const wheelRAF = useRef<number | null>(null);

  const updateIndexBySteps = useCallback(
    (steps: number) => {
      if (!steps) return;
      setCurrentIndex((prev) =>
        Math.max(0, Math.min(series.sliceCount - 1, prev + steps)),
      );
    },
    [series.sliceCount],
  );

  const getSliceImageData = useCallback(
    (index: number): ImageData | null => {
      const slice = series.slices[index];
      if (!slice) return null;
      if (slice.imageData) return slice.imageData;

      const cached = imageDataCacheRef.current.get(index);
      if (cached) return cached;
      if (!slice.rawData) return null;

      const generated = applyWindowLevel(
        slice.rawData,
        slice.width,
        slice.height,
        series.windowCenter,
        series.windowWidth,
      );
      imageDataCacheRef.current.set(index, generated);
      if (imageDataCacheRef.current.size > MAX_IMAGE_DATA_CACHE) {
        const oldestKey = imageDataCacheRef.current.keys().next().value;
        if (oldestKey !== undefined && oldestKey !== index) {
          imageDataCacheRef.current.delete(oldestKey);
        }
      }
      return generated;
    },
    [series.slices, series.windowCenter, series.windowWidth],
  );

  const ensureBitmapForIndex = useCallback(
    (index: number) => {
      const slice = series.slices[index];
      if (!slice) return;
      if (bitmapCacheRef.current.has(index)) return;
      if (pendingBitmapGenerationRef.current.has(index)) return;

      const imageData = getSliceImageData(index);
      if (!imageData) return;

      pendingBitmapGenerationRef.current.add(index);
      createImageBitmap(imageData)
        .then((bitmap) => {
          const existing = bitmapCacheRef.current.get(index);
          if (existing) {
            existing.close();
          }
          bitmapCacheRef.current.set(index, bitmap);
          if (bitmapCacheRef.current.size > MAX_BITMAP_CACHE) {
            const oldestKey = bitmapCacheRef.current.keys().next().value;
            if (oldestKey !== undefined && oldestKey !== index) {
              const oldestBitmap = bitmapCacheRef.current.get(oldestKey);
              oldestBitmap?.close();
              bitmapCacheRef.current.delete(oldestKey);
            }
          }
        })
        .catch(() => {
          // Ignore bitmap conversion failures and continue with putImageData fallback.
        })
        .finally(() => {
          pendingBitmapGenerationRef.current.delete(index);
        });
    },
    [getSliceImageData, series.slices],
  );

  useEffect(() => {
    setCurrentIndex(0);
    wheelAccumulator.current = 0;
    if (wheelRAF.current !== null) {
      cancelAnimationFrame(wheelRAF.current);
      wheelRAF.current = null;
    }

    imageDataCacheRef.current.clear();
    pendingBitmapGenerationRef.current.clear();
    bitmapCacheRef.current.forEach((bitmap) => bitmap.close());
    bitmapCacheRef.current.clear();
  }, [series.id, series.windowCenter, series.windowWidth]);

  useEffect(() => {
    const bitmapCache = bitmapCacheRef.current;
    const imageDataCache = imageDataCacheRef.current;
    const pendingBitmapGeneration = pendingBitmapGenerationRef.current;

    return () => {
      if (wheelRAF.current !== null) {
        cancelAnimationFrame(wheelRAF.current);
      }
      bitmapCache.forEach((bitmap) => bitmap.close());
      bitmapCache.clear();
      imageDataCache.clear();
      pendingBitmapGeneration.clear();
    };
  }, []);

  // Sync current index with global context (skip in compact/2D-MPR mode to avoid cross-pane re-renders)
  useEffect(() => {
    if (!compact) {
      setCurrentImageIndex(currentIndex);
    }
  }, [currentIndex, setCurrentImageIndex, compact]);

  // Report index changes to parent
  useEffect(() => {
    onImageIndexChange?.(currentIndex);
  }, [currentIndex, onImageIndexChange]);

  // Render current slice
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !series.slices.length) return;

    const slice = series.slices[currentIndex];
    if (!slice) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    if (canvas.width !== slice.width) canvas.width = slice.width;
    if (canvas.height !== slice.height) canvas.height = slice.height;

    const bitmap = bitmapCacheRef.current.get(currentIndex);
    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, slice.width, slice.height);
    } else {
      const imageData = getSliceImageData(currentIndex);
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
        ensureBitmapForIndex(currentIndex);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // Pre-warm nearby slices so wheel scrolling feels smooth.
    const nearby = [currentIndex + 1, currentIndex - 1, currentIndex + 2, currentIndex - 2];
    nearby.forEach((idx) => {
      if (idx >= 0 && idx < series.sliceCount) {
        ensureBitmapForIndex(idx);
      }
    });

    // Apply view transforms (pan, zoom, etc.) via CSS
    // Use physical aspect ratio (accounts for pixel spacing vs slice spacing)
    // to avoid squashed Coronal/Sagittal views
    const containerRect = container.getBoundingClientRect();
    const containerAspect = containerRect.width / containerRect.height;
    const physicalAspect = series.physicalAspectRatio ?? (slice.width / slice.height);

    if (physicalAspect > containerAspect) {
      // Image is wider than container — fit to width
      const displayWidth = containerRect.width;
      const displayHeight = displayWidth / physicalAspect;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    } else {
      // Image is taller than container — fit to height
      const displayHeight = containerRect.height;
      const displayWidth = displayHeight * physicalAspect;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    }
  }, [series, currentIndex, getSliceImageData, ensureBitmapForIndex]);

  // Render scout lines on overlay canvas (CSS-display-sized to avoid scaling issues)
  useEffect(() => {
    const scoutCanvas = scoutCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!scoutCanvas || !mainCanvas) return;

    if (!scoutLines || scoutLines.length === 0) {
      const ctx = scoutCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, scoutCanvas.width, scoutCanvas.height);
      scoutCanvas.style.width = "0px";
      scoutCanvas.style.height = "0px";
      return;
    }

    // Match overlay to the CSS display size of the main canvas
    const displayWidth = parseFloat(mainCanvas.style.width) || mainCanvas.width;
    const displayHeight = parseFloat(mainCanvas.style.height) || mainCanvas.height;
    scoutCanvas.width = Math.round(displayWidth);
    scoutCanvas.height = Math.round(displayHeight);
    scoutCanvas.style.width = `${displayWidth}px`;
    scoutCanvas.style.height = `${displayHeight}px`;

    const ctx = scoutCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, scoutCanvas.width, scoutCanvas.height);

    scoutLines.forEach((sl) => {
      const isVertical = sl.orientation === "vertical";
      ctx.save();
      ctx.strokeStyle = sl.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();

      if (isVertical) {
        const x = sl.ratio * displayWidth;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, displayHeight);
      } else {
        const y = sl.ratio * displayHeight;
        ctx.moveTo(0, y);
        ctx.lineTo(displayWidth, y);
      }
      ctx.stroke();

      if (sl.label) {
        ctx.fillStyle = sl.color;
        ctx.font = "11px sans-serif";
        ctx.globalAlpha = 0.9;
        if (isVertical) {
          const x = sl.ratio * displayWidth;
          ctx.fillText(sl.label, x + 4, 14);
        } else {
          const y = sl.ratio * displayHeight;
          ctx.fillText(sl.label, 4, y - 4);
        }
      }
      ctx.restore();
    });
  }, [scoutLines, currentIndex]);

  // Handle mouse interactions for scrolling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastX.current = e.clientX;
    lastY.current = e.clientY;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      if (activeTool === "Pan") {
        setViewTransform((prev) => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
        return;
      }

      if (activeTool === "Zoom") {
        setViewTransform((prev) => ({
          ...prev,
          scale: Math.max(0.1, Math.min(8, prev.scale - deltaY * 0.01)),
        }));
        return;
      }

      if (Math.abs(deltaY) >= 2) {
        const step = deltaY > 0 ? 1 : -1;
        updateIndexBySteps(step);
      }
    },
    [activeTool, setViewTransform, updateIndexBySteps],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Handle wheel event with native listener to avoid passive event listener warning
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (activeTool === "Zoom" || e.ctrlKey || e.metaKey) {
        const zoomFactor = Math.exp(-e.deltaY * 0.0015);
        setViewTransform((prev) => ({
          ...prev,
          scale: Math.max(0.1, Math.min(8, prev.scale * zoomFactor)),
        }));
        return;
      }

      const threshold = Math.max(8, 100 / stackSpeed);
      wheelAccumulator.current += e.deltaY;

      if (wheelRAF.current === null) {
        wheelRAF.current = requestAnimationFrame(() => {
          wheelRAF.current = null;
          const delta = wheelAccumulator.current;
          const steps = Math.trunc(delta / threshold);

          if (steps !== 0) {
            wheelAccumulator.current = delta - steps * threshold;
            updateIndexBySteps(steps);
          }
        });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (wheelRAF.current !== null) {
        cancelAnimationFrame(wheelRAF.current);
        wheelRAF.current = null;
      }
    };
  }, [activeTool, setViewTransform, stackSpeed, updateIndexBySteps]);

  return (
    <div className={`flex-1 flex flex-col bg-black ${className}`}>
      {/* Viewer */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          className={
            activeTool === "Zoom"
              ? "cursor-zoom-in"
              : activeTool === "Pan"
              ? "cursor-grab active:cursor-grabbing"
              : "cursor-ns-resize"
          }
          style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale}) rotate(${viewTransform.rotation}deg) scaleX(${viewTransform.flipH ? -1 : 1}) scaleY(${viewTransform.flipV ? -1 : 1})`,
            filter: viewTransform.invert ? "invert(1)" : "none",
          }}
        />
        {/* Scout line overlay — sized to CSS display dimensions, positioned over main canvas */}
        <canvas
          ref={scoutCanvasRef}
          className="absolute pointer-events-none"
          style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale}) rotate(${viewTransform.rotation}deg) scaleX(${viewTransform.flipH ? -1 : 1}) scaleY(${viewTransform.flipV ? -1 : 1})`,
            zIndex: 5,
          }}
        />

        {/* Corner Overlays - White text only, no background boxes */}
        <div className="absolute inset-4 pointer-events-none select-none text-[11px] md:text-xs font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {compact ? (
            <>
              {/* Compact mode: only slice counter */}
              <div className="absolute bottom-0 left-0 font-medium">
                {currentIndex + 1} / {series.sliceCount}
              </div>
            </>
          ) : (
            <>
              {/* Patient Details - Top Left */}
              {caseData?.patient && (
                <div className="absolute top-0 left-0 flex flex-col gap-0.5">
                  <span className="font-bold uppercase tracking-wide text-sm">
                    {caseData.patient.name}
                  </span>
                  <span>ID: {caseData.patient.patient_id}</span>
                  <span>
                    DOB:{" "}
                    {formatDicomDate(
                      caseData.patient?.dob ||
                        caseData.patient?.date_of_birth ||
                        "N/A",
                    )}
                  </span>
                  <span>Sex: {caseData.patient?.sex || "U"}</span>
                  <span className="font-medium mt-1">{series.mprMode} MPR</span>
                </div>
              )}

              {/* Image Info - Top Right */}
              <div className="absolute top-0 right-0 text-right flex flex-col gap-0.5">
                <span className="font-bold">Generated MPR Series</span>
                <span>Slices: {series.sliceCount}</span>
                <span>
                  W/L: {series.windowWidth.toFixed(0)} /{" "}
                  {series.windowCenter.toFixed(0)}
                </span>
              </div>

              {/* Slice Counter - Bottom Left */}
              <div className="absolute bottom-0 left-0 font-medium">
                {currentIndex + 1} / {series.sliceCount}
              </div>
            </>
          )}
        </div>

        {/* Fullscreen Button - Bottom Right (hidden in compact mode) */}
        {!compact && (
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-2 right-2 bg-black/70 hover:bg-gray-800 p-2 rounded transition-colors"
            title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
          >
            {isFullscreen ? (
              <Minimize size={18} className="text-white" />
            ) : (
              <Maximize size={18} className="text-white" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default TemporaryMPRSeriesViewer;
