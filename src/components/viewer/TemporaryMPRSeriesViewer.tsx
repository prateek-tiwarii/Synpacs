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
  type Annotation,
  type MouseButton,
} from "../ViewerLayout";
import { Maximize, Minimize } from "lucide-react";
import type { ScoutLine } from "./DicomViewer";
import { applyWindowLevel } from "@/lib/mpr";

// Angle calculation helpers (ported from DicomViewer)
const calculateAngle = (
  p1: { x: number; y: number },
  vertex: { x: number; y: number },
  p2: { x: number; y: number },
): number => {
  const vec1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
  const vec2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
  const dot = vec1.x * vec2.x + vec1.y * vec2.y;
  const cross = vec1.x * vec2.y - vec1.y * vec2.x;
  const angleRad = Math.atan2(Math.abs(cross), dot);
  return (angleRad * 180) / Math.PI;
};

const calculateCobbsAngle = (
  line1Start: { x: number; y: number },
  line1End: { x: number; y: number },
  line2Start: { x: number; y: number },
  line2End: { x: number; y: number },
): number => {
  const vec1 = { x: line1End.x - line1Start.x, y: line1End.y - line1Start.y };
  const vec2 = { x: line2End.x - line2Start.x, y: line2End.y - line2Start.y };
  const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
  const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
  if (len1 === 0 || len2 === 0) return 0;
  const dot = (vec1.x * vec2.x + vec1.y * vec2.y) / (len1 * len2);
  const angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg > 90) angleDeg = 180 - angleDeg;
  return angleDeg;
};

interface TemporaryMPRSeriesViewerProps {
  series: TemporaryMPRSeries;
  className?: string;
  scoutLines?: ScoutLine[];
  onImageIndexChange?: (index: number) => void;
  compact?: boolean;
  isActive?: boolean;
  viewTransformOverride?: ViewTransform;
  onViewTransformChangeOverride?: (
    transform: ViewTransform | ((prev: ViewTransform) => ViewTransform),
  ) => void;
  isFullscreenOverride?: boolean;
  onToggleFullscreenOverride?: () => void;
  /** Lazy slice provider for on-demand MIP computation via Web Worker */
  onSliceNeeded?: (index: number) => Promise<Int16Array | null>;
  /** Called when user drags the scout line locator circle (ratios 0-1) */
  onCrosshairDrag?: (horizontalRatio: number, verticalRatio: number) => void;
}

// Helper to format DICOM date (YYYYMMDD) to readable format
const formatDicomDate = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}/${month}/${year}`;
};

const parseDicomDate = (dateStr?: string | null): Date | null => {
  if (!dateStr || dateStr.length !== 8) return null;
  const year = Number.parseInt(dateStr.substring(0, 4), 10);
  const month = Number.parseInt(dateStr.substring(4, 6), 10);
  const day = Number.parseInt(dateStr.substring(6, 8), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatPatientAge = (
  dobStr?: string | null,
  referenceDateStr?: string | null,
  explicitAge?: string | number | null,
): string | null => {
  if (explicitAge !== undefined && explicitAge !== null) {
    const ageText = String(explicitAge).trim();
    if (ageText) return ageText;
  }

  const dob = parseDicomDate(dobStr);
  if (!dob) return null;
  const referenceDate = parseDicomDate(referenceDateStr) ?? new Date();
  if (referenceDate.getTime() < dob.getTime()) return null;

  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age -= 1;
  }
  if (age < 0) return null;
  return `${age}Y`;
};

export function TemporaryMPRSeriesViewer({
  series,
  className = "",
  scoutLines,
  onImageIndexChange,
  compact = false,
  isActive = false,
  viewTransformOverride,
  onViewTransformChangeOverride,
  isFullscreenOverride,
  onToggleFullscreenOverride,
  onSliceNeeded,
  onCrosshairDrag,
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
    mouseBindings,
    annotations: globalAnnotations,
    setAnnotations: setGlobalAnnotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    saveToHistory,
  } = useViewerContext();
  const viewTransform = viewTransformOverride ?? globalViewTransform;
  const setViewTransform =
    onViewTransformChangeOverride ?? setGlobalViewTransform;
  const isFullscreen = isFullscreenOverride ?? globalIsFullscreen;
  const toggleFullscreen =
    onToggleFullscreenOverride ?? toggleGlobalFullscreen;
  const patientAge = formatPatientAge(
    caseData?.patient?.dob || caseData?.patient?.date_of_birth,
    caseData?.case_date,
    caseData?.patient?.age,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoutCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const lastX = useRef(0);

  // Tool interaction refs
  const interactionToolRef = useRef(activeTool);
  const freeRotateLastAngle = useRef<number | null>(null);
  const pendingRotation = useRef(0);
  const rotationAnimationFrame = useRef<number | null>(null);
  const accumulatedStackDelta = useRef(0);
  const currentAnnotation = useRef<Annotation | null>(null);
  const angleClickCount = useRef(0);
  const [annotationRenderKey, setAnnotationRenderKey] = useState(0);
  // Scout circle drag state
  const isDraggingScoutCircle = useRef(false);
  const scoutIntersectionRef = useRef<{ x: number; y: number; displayW: number; displayH: number } | null>(null);
  const MAX_IMAGE_DATA_CACHE = 320;
  const MAX_BITMAP_CACHE = 160;
  const bitmapCacheRef = useRef<Map<number, ImageBitmap>>(new Map());
  const imageDataCacheRef = useRef<Map<number, ImageData>>(new Map());
  const pendingBitmapGenerationRef = useRef<Set<number>>(new Set());
  const bitmapGenerationEpochRef = useRef(0);
  const wheelAccumulator = useRef(0);
  const wheelRAF = useRef<number | null>(null);
  // Lazy MIP slice cache: stores rawData computed on-demand via onSliceNeeded
  const lazyCacheRef = useRef<Map<number, Int16Array>>(new Map());
  const pendingLazyRequestsRef = useRef<Set<number>>(new Set());
  const lazyRequestEpochRef = useRef(0);
  const [lazyCacheVersion, setLazyCacheVersion] = useState(0);
  const prevSlabRef = useRef(series.projectionSlabHalfSize);

  const effectiveWindowWidth = viewTransform.windowWidth ?? series.windowWidth;
  const effectiveWindowCenter = viewTransform.windowCenter ?? series.windowCenter;

  const clearRenderedCaches = useCallback(() => {
    bitmapGenerationEpochRef.current += 1;
    imageDataCacheRef.current.clear();
    pendingBitmapGenerationRef.current.clear();
    bitmapCacheRef.current.forEach((bitmap) => bitmap.close());
    bitmapCacheRef.current.clear();
  }, []);

  // Clear lazy MIP cache when slab size changes
  useEffect(() => {
    if (series.projectionSlabHalfSize !== prevSlabRef.current) {
      prevSlabRef.current = series.projectionSlabHalfSize;
      lazyRequestEpochRef.current += 1;
      lazyCacheRef.current.clear();
      pendingLazyRequestsRef.current.clear();
    }
  }, [series.projectionSlabHalfSize]);

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

      // Check series rawData first, fall back to lazy MIP cache
      let rawData = slice.rawData ?? lazyCacheRef.current.get(index);
      if (!rawData) {
        // Request lazy computation via Web Worker if provider exists
        if (onSliceNeeded && !pendingLazyRequestsRef.current.has(index)) {
          pendingLazyRequestsRef.current.add(index);
          const requestEpoch = lazyRequestEpochRef.current;
          onSliceNeeded(index).then((data) => {
            pendingLazyRequestsRef.current.delete(index);
            if (requestEpoch !== lazyRequestEpochRef.current) {
              return;
            }
            if (data) {
              lazyCacheRef.current.set(index, data);
              setLazyCacheVersion((v) => v + 1);
            }
          });
        }
        return null;
      }

      const generated = applyWindowLevel(
        rawData,
        slice.width,
        slice.height,
        effectiveWindowCenter,
        effectiveWindowWidth,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series.slices, effectiveWindowCenter, effectiveWindowWidth, onSliceNeeded, lazyCacheVersion],
  );

  const ensureBitmapForIndex = useCallback(
    (index: number) => {
      const slice = series.slices[index];
      if (!slice) return;
      if (bitmapCacheRef.current.has(index)) return;
      if (pendingBitmapGenerationRef.current.has(index)) return;

      const imageData = getSliceImageData(index);
      if (!imageData) return;

      const generationEpoch = bitmapGenerationEpochRef.current;
      pendingBitmapGenerationRef.current.add(index);
      createImageBitmap(imageData)
        .then((bitmap) => {
          if (bitmapGenerationEpochRef.current !== generationEpoch) {
            bitmap.close();
            return;
          }
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

    clearRenderedCaches();
    lazyRequestEpochRef.current += 1;
    lazyCacheRef.current.clear();
    pendingLazyRequestsRef.current.clear();
  }, [series.id, clearRenderedCaches]);

  useEffect(() => {
    clearRenderedCaches();
  }, [series.createdAt, clearRenderedCaches]);

  useEffect(() => {
    clearRenderedCaches();
  }, [effectiveWindowCenter, effectiveWindowWidth, clearRenderedCaches]);

  useEffect(() => {
    setCurrentIndex((prev) => Math.max(0, Math.min(prev, series.sliceCount - 1)));
  }, [series.sliceCount]);

  useEffect(() => {
    const bitmapCache = bitmapCacheRef.current;
    const imageDataCache = imageDataCacheRef.current;
    const pendingBitmapGeneration = pendingBitmapGenerationRef.current;

    return () => {
      if (wheelRAF.current !== null) {
        cancelAnimationFrame(wheelRAF.current);
      }
      if (rotationAnimationFrame.current !== null) {
        cancelAnimationFrame(rotationAnimationFrame.current);
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
      } else if (!onSliceNeeded) {
        // Only clear if not using lazy loading — with lazy loading we keep the
        // last rendered frame visible while the worker computes the next slice.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      // When onSliceNeeded is active and data isn't ready yet, the previous
      // frame stays visible (~20ms until worker delivers the new slice).
    }

    // Pre-warm nearby slices so wheel scrolling feels smooth.
    const nearby = [currentIndex + 1, currentIndex - 1, currentIndex + 2, currentIndex - 2, currentIndex + 3, currentIndex - 3];
    nearby.forEach((idx) => {
      if (idx >= 0 && idx < series.sliceCount) {
        ensureBitmapForIndex(idx);
        // Also trigger lazy MIP prefetch if provider exists
        if (
          onSliceNeeded &&
          !series.slices[idx]?.rawData &&
          !lazyCacheRef.current.has(idx) &&
          !pendingLazyRequestsRef.current.has(idx)
        ) {
          pendingLazyRequestsRef.current.add(idx);
          onSliceNeeded(idx).then((data) => {
            pendingLazyRequestsRef.current.delete(idx);
            if (data) lazyCacheRef.current.set(idx, data);
            // No version bump for prefetch — avoids unnecessary re-renders
          });
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, currentIndex, getSliceImageData, ensureBitmapForIndex, onSliceNeeded, lazyCacheVersion]);

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

    let hLineY: number | null = null;
    let vLineX: number | null = null;

    scoutLines.forEach((sl) => {
      const isVertical = sl.orientation === "vertical";
      ctx.save();
      ctx.strokeStyle = sl.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();

      if (isVertical) {
        const x = sl.ratio * displayWidth;
        vLineX = x;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, displayHeight);
      } else {
        const y = sl.ratio * displayHeight;
        hLineY = y;
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

    // Draw intersection circle (locator) where scout lines cross
    if (hLineY !== null && vLineX !== null) {
      const ix = vLineX;
      const iy = hLineY;
      scoutIntersectionRef.current = { x: ix, y: iy, displayW: displayWidth, displayH: displayHeight };

      // Outer circle
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(ix, iy, 12, 0, 2 * Math.PI);
      ctx.stroke();

      // Inner dot
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(ix, iy, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    } else {
      scoutIntersectionRef.current = null;
    }
  }, [scoutLines, currentIndex]);

  // Convert screen coordinates to image pixel coordinates
  const screenToImage = useCallback(
    (screenX: number, screenY: number) => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return { x: 0, y: 0 };

      const containerRect = container.getBoundingClientRect();
      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;

      // Position relative to container center (flexbox centers the canvas)
      let x = screenX - containerCenterX - viewTransform.x;
      let y = screenY - containerCenterY - viewTransform.y;

      // Un-scale
      x /= viewTransform.scale;
      y /= viewTransform.scale;

      // Un-rotate
      const angle = (-viewTransform.rotation * Math.PI) / 180;
      const rx = x * Math.cos(angle) - y * Math.sin(angle);
      const ry = x * Math.sin(angle) + y * Math.cos(angle);
      x = rx;
      y = ry;

      // Un-flip
      if (viewTransform.flipH) x = -x;
      if (viewTransform.flipV) y = -y;

      // Convert from display-centered to image pixel coordinates
      const displayWidth = parseFloat(canvas.style.width) || canvas.width;
      const displayHeight = parseFloat(canvas.style.height) || canvas.height;
      const imgX = (x / displayWidth + 0.5) * canvas.width;
      const imgY = (y / displayHeight + 0.5) * canvas.height;

      return { x: imgX, y: imgY };
    },
    [viewTransform],
  );

  // Get angle from canvas center to pointer (for FreeRotate)
  const getPointerAngleFromCenter = useCallback(
    (screenX: number, screenY: number): number => {
      const container = containerRef.current;
      if (!container) return 0;

      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2 + viewTransform.x;
      const centerY = containerRect.top + containerRect.height / 2 + viewTransform.y;
      const angleRad = Math.atan2(screenY - centerY, screenX - centerX);
      return (angleRad * 180) / Math.PI;
    },
    [viewTransform.x, viewTransform.y],
  );

  // Get HU value at image pixel position
  const getHUAtPoint = useCallback(
    (pos: { x: number; y: number }): number | null => {
      const slice = series.slices[currentIndex];
      if (!slice) return null;
      const rawData = slice.rawData ?? lazyCacheRef.current.get(currentIndex);
      if (!rawData) return null;

      const px = Math.round(pos.x);
      const py = Math.round(pos.y);
      if (px < 0 || px >= slice.width || py < 0 || py >= slice.height) return null;
      return rawData[py * slice.width + px];
    },
    [series.slices, currentIndex],
  );

  // Trigger annotation canvas re-render
  const requestAnnotationRender = useCallback(() => {
    setAnnotationRenderKey((k) => k + 1);
  }, []);

  // Render annotations on overlay canvas
  useEffect(() => {
    const annCanvas = annotationCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!annCanvas || !mainCanvas) return;

    const displayWidth = parseFloat(mainCanvas.style.width) || mainCanvas.width;
    const displayHeight = parseFloat(mainCanvas.style.height) || mainCanvas.height;

    // Size annotation canvas to match display dimensions
    if (annCanvas.width !== Math.round(displayWidth) || annCanvas.height !== Math.round(displayHeight)) {
      annCanvas.width = Math.round(displayWidth);
      annCanvas.height = Math.round(displayHeight);
      annCanvas.style.width = `${displayWidth}px`;
      annCanvas.style.height = `${displayHeight}px`;
    }

    const ctx = annCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, annCanvas.width, annCanvas.height);

    // Scale factor from image pixels to display pixels
    const sx = displayWidth / mainCanvas.width;
    const sy = displayHeight / mainCanvas.height;

    // Get annotations for current slice + in-progress annotation
    const sliceAnnotations = globalAnnotations.filter(
      (ann) => ann.imageIndex === undefined || ann.imageIndex === currentIndex,
    );
    const allAnnotations = [
      ...sliceAnnotations,
      ...(currentAnnotation.current ? [currentAnnotation.current] : []),
    ];

    if (allAnnotations.length === 0) return;

    allAnnotations.forEach((ann, annIndex) => {
      if (!ann || !ann.points || ann.points.length < 1) return;

      const isSelected = ann.id === selectedAnnotationId;
      const baseColor = isSelected ? "#00bfff" : ann.color || "#00ff00";

      ctx.strokeStyle = baseColor;
      ctx.fillStyle = baseColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.font = "12px sans-serif";

      // Map image coords to display coords
      const toDisplay = (p: { x: number; y: number }) => ({
        x: p.x * sx,
        y: p.y * sy,
      });

      if (ann.type === "Length" && ann.points.length >= 2) {
        const p1 = toDisplay(ann.points[0]);
        const p2 = toDisplay(ann.points[1]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const dx = ann.points[1].x - ann.points[0].x;
        const dy = ann.points[1].y - ann.points[0].y;
        const distPx = Math.sqrt(dx * dx + dy * dy).toFixed(1);
        ctx.fillText(`${ann.index ?? annIndex + 1}: ${distPx} px`, p2.x + 5, p2.y + 5);
      } else if (ann.type === "Ellipse" && ann.points.length >= 2) {
        const p1 = toDisplay(ann.points[0]);
        const p2 = toDisplay(ann.points[1]);
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;
        const rx = Math.abs(p2.x - p1.x) / 2;
        const ry = Math.abs(p2.y - p1.y) / 2;
        if (rx > 0 && ry > 0) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else if (ann.type === "Rectangle" && ann.points.length >= 2) {
        const p1 = toDisplay(ann.points[0]);
        const p2 = toDisplay(ann.points[1]);
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      } else if (ann.type === "Freehand" && ann.points.length >= 2) {
        const pts = ann.points.map(toDisplay);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        if (pts.length > 2) ctx.closePath();
        ctx.stroke();
      } else if (ann.type === "HU" && ann.points.length >= 1) {
        const p = toDisplay(ann.points[0]);
        const crossSize = 6;
        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - crossSize, p.y);
        ctx.lineTo(p.x + crossSize, p.y);
        ctx.moveTo(p.x, p.y - crossSize);
        ctx.lineTo(p.x, p.y + crossSize);
        ctx.stroke();

        ctx.fillStyle = "#ffff00";
        const huText = `${ann.index ?? annIndex + 1}: ${ann.huValue ?? "?"} HU`;
        ctx.fillText(huText, p.x + 10, p.y + 4);
      } else if (ann.type === "Angle" && ann.points.length >= 2) {
        const pts = ann.points.map(toDisplay);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();

        if (ann.points.length === 3) {
          ctx.beginPath();
          ctx.moveTo(pts[1].x, pts[1].y);
          ctx.lineTo(pts[2].x, pts[2].y);
          ctx.stroke();

          const angle = calculateAngle(ann.points[0], ann.points[1], ann.points[2]);
          const vec1 = { x: pts[0].x - pts[1].x, y: pts[0].y - pts[1].y };
          const vec2 = { x: pts[2].x - pts[1].x, y: pts[2].y - pts[1].y };
          const startAngle = Math.atan2(vec1.y, vec1.x);
          const rawEnd = Math.atan2(vec2.y, vec2.x);
          let delta = rawEnd - startAngle;
          while (delta <= -Math.PI) delta += 2 * Math.PI;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          const arcRadius = 20;

          ctx.beginPath();
          ctx.arc(pts[1].x, pts[1].y, arcRadius, startAngle, startAngle + delta, delta < 0);
          ctx.stroke();

          const midAngle = startAngle + delta / 2;
          ctx.fillText(
            `${ann.index ?? annIndex + 1}: ${angle.toFixed(1)}°`,
            pts[1].x + (arcRadius + 10) * Math.cos(midAngle),
            pts[1].y + (arcRadius + 10) * Math.sin(midAngle),
          );
        }
      } else if (ann.type === "CobbsAngle" && ann.points.length >= 2) {
        const pts = ann.points.map(toDisplay);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.stroke();

        if (ann.points.length >= 4) {
          ctx.beginPath();
          ctx.moveTo(pts[2].x, pts[2].y);
          ctx.lineTo(pts[3].x, pts[3].y);
          ctx.stroke();

          const cobbAngle = calculateCobbsAngle(ann.points[0], ann.points[1], ann.points[2], ann.points[3]);
          const midX = (pts[2].x + pts[3].x) / 2;
          const midY = (pts[2].y + pts[3].y) / 2;
          ctx.fillStyle = "#ffff00";
          ctx.fillText(`${ann.index ?? annIndex + 1}: Cobb: ${cobbAngle.toFixed(1)}°`, midX + 10, midY);
        }
      } else if (ann.type === "Text" && ann.points.length >= 1) {
        const p = toDisplay(ann.points[0]);
        const fontSize = ann.textSize || 18;
        ctx.font = `600 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
        ctx.fillStyle = isSelected ? "#93c5fd" : "#e2e8f0";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeText(ann.text || "Text", p.x, p.y);
        ctx.fillText(ann.text || "Text", p.x, p.y);
      }

      // Draw handles for selected annotation
      if (isSelected && ann.type !== "Text" && ann.type !== "HU") {
        const handleRadius = 4;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.5;
        ann.points.forEach((p) => {
          const dp = toDisplay(p);
          ctx.beginPath();
          ctx.arc(dp.x, dp.y, handleRadius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalAnnotations, selectedAnnotationId, currentIndex, annotationRenderKey]);

  // Convert screen position to scout canvas ratio (for crosshair drag)
  const screenToScoutRatio = useCallback(
    (screenX: number, screenY: number): { hRatio: number; vRatio: number } | null => {
      const container = containerRef.current;
      const mainCanvas = canvasRef.current;
      if (!container || !mainCanvas) return null;

      const containerRect = container.getBoundingClientRect();
      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;

      // Position relative to container center (accounts for pan)
      let x = screenX - containerCenterX - viewTransform.x;
      let y = screenY - containerCenterY - viewTransform.y;

      // Un-scale
      x /= viewTransform.scale;
      y /= viewTransform.scale;

      // Un-rotate
      const angle = (-viewTransform.rotation * Math.PI) / 180;
      const rx = x * Math.cos(angle) - y * Math.sin(angle);
      const ry = x * Math.sin(angle) + y * Math.cos(angle);

      const displayWidth = parseFloat(mainCanvas.style.width) || mainCanvas.width;
      const displayHeight = parseFloat(mainCanvas.style.height) || mainCanvas.height;

      // Convert to 0-1 ratio on the display canvas
      const hRatio = Math.max(0, Math.min(1, rx / displayWidth + 0.5));
      const vRatio = Math.max(0, Math.min(1, ry / displayHeight + 0.5));
      return { hRatio, vRatio };
    },
    [viewTransform],
  );

  // Hit-test the scout circle intersection
  const hitTestScoutCircle = useCallback(
    (screenX: number, screenY: number): boolean => {
      const intersection = scoutIntersectionRef.current;
      if (!intersection || !onCrosshairDrag) return false;

      const container = containerRef.current;
      const mainCanvas = canvasRef.current;
      if (!container || !mainCanvas) return false;

      const containerRect = container.getBoundingClientRect();
      const containerCenterX = containerRect.left + containerRect.width / 2;
      const containerCenterY = containerRect.top + containerRect.height / 2;

      // Position relative to container center (accounts for pan)
      let x = screenX - containerCenterX - viewTransform.x;
      let y = screenY - containerCenterY - viewTransform.y;

      // Un-scale
      x /= viewTransform.scale;
      y /= viewTransform.scale;

      // Un-rotate
      const angle = (-viewTransform.rotation * Math.PI) / 180;
      const rx = x * Math.cos(angle) - y * Math.sin(angle);
      const ry = x * Math.sin(angle) + y * Math.cos(angle);

      // Convert to display coords (centered at 0,0 → offset to top-left)
      const displayWidth = intersection.displayW;
      const displayHeight = intersection.displayH;
      const dx = rx + displayWidth / 2 - intersection.x;
      const dy = ry + displayHeight / 2 - intersection.y;

      // Hit radius: 15px in display space
      return dx * dx + dy * dy <= 15 * 15;
    },
    [viewTransform, onCrosshairDrag],
  );

  // Handle mouse interactions with full tool support
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Check scout circle hit first (takes priority over tools)
      if (e.button === 0 && onCrosshairDrag && hitTestScoutCircle(e.clientX, e.clientY)) {
        e.preventDefault();
        isDraggingScoutCircle.current = true;
        isDragging.current = true;
        lastX.current = e.clientX;
        lastY.current = e.clientY;
        // Emit initial position
        const ratio = screenToScoutRatio(e.clientX, e.clientY);
        if (ratio) onCrosshairDrag(ratio.hRatio, ratio.vRatio);
        return;
      }

      const button = e.button as MouseButton;
      const boundTool = mouseBindings[button];
      const tool = boundTool ?? activeTool;

      // Ignore middle/right click if no tool is bound
      if ((button === 1 || button === 2) && !boundTool) return;
      if (boundTool) e.preventDefault();

      interactionToolRef.current = tool;
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      accumulatedStackDelta.current = 0;

      const pos = screenToImage(e.clientX, e.clientY);
      const annotationTools = ["Length", "Ellipse", "Rectangle", "Freehand", "Angle", "CobbsAngle"];

      // HU tool
      if (tool === "HU") {
        e.preventDefault();
        const huValue = getHUAtPoint(pos);
        if (huValue !== null) {
          const newAnnotation: Annotation = {
            id: Math.random().toString(36).substr(2, 9),
            type: "HU",
            points: [pos],
            color: "#ffff00",
            huValue,
            index: globalAnnotations.length + 1,
            imageIndex: currentIndex,
          };
          setGlobalAnnotations((prev) => [...prev, newAnnotation]);
          saveToHistory();
        }
        isDragging.current = false;
        return;
      }

      // FreeRotate tool
      if (tool === "FreeRotate") {
        e.preventDefault();
        freeRotateLastAngle.current = getPointerAngleFromCenter(e.clientX, e.clientY);
        isDragging.current = true;
        return;
      }

      // Angle tool (multi-click)
      if (tool === "Angle") {
        const id = Math.random().toString(36).substr(2, 9);
        if (angleClickCount.current === 0) {
          currentAnnotation.current = {
            id, type: "Angle", points: [pos], color: "#00ff00", imageIndex: currentIndex,
          };
          angleClickCount.current = 1;
        } else if (angleClickCount.current === 1) {
          if (currentAnnotation.current) {
            currentAnnotation.current.points[1] = pos;
            angleClickCount.current = 2;
          }
        } else if (angleClickCount.current === 2) {
          if (currentAnnotation.current) {
            currentAnnotation.current.points[2] = pos;
            setGlobalAnnotations((prev) => [...prev, {
              ...currentAnnotation.current!,
              index: prev.length + 1,
            }]);
            saveToHistory();
          }
          currentAnnotation.current = null;
          angleClickCount.current = 0;
          isDragging.current = false;
          requestAnnotationRender();
          return;
        }
        isDragging.current = true;
        requestAnnotationRender();
        return;
      }

      // CobbsAngle tool (multi-click)
      if (tool === "CobbsAngle") {
        const id = Math.random().toString(36).substr(2, 9);
        if (angleClickCount.current === 0) {
          currentAnnotation.current = {
            id, type: "CobbsAngle", points: [pos], color: "#ffff00", imageIndex: currentIndex,
          };
          angleClickCount.current = 1;
        } else if (angleClickCount.current === 2) {
          if (currentAnnotation.current) {
            currentAnnotation.current.points.push(pos);
            angleClickCount.current = 3;
          }
        }
        isDragging.current = true;
        requestAnnotationRender();
        return;
      }

      // Deselect if not using annotation tool
      if (!annotationTools.includes(tool)) {
        setSelectedAnnotationId(null);
      }

      isDragging.current = true;

      // Start new annotation
      if (annotationTools.includes(tool)) {
        setSelectedAnnotationId(null);
        const id = Math.random().toString(36).substr(2, 9);
        currentAnnotation.current = {
          id,
          type: tool as Annotation["type"],
          points: [pos],
          color: "#00ff00",
          imageIndex: currentIndex,
        };
        requestAnnotationRender();
      }
    },
    [activeTool, mouseBindings, screenToImage, getHUAtPoint, getPointerAngleFromCenter, globalAnnotations.length, setGlobalAnnotations, saveToHistory, setSelectedAnnotationId, requestAnnotationRender, currentIndex, onCrosshairDrag, hitTestScoutCircle, screenToScoutRatio],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Scout circle drag
      if (isDraggingScoutCircle.current && onCrosshairDrag) {
        const ratio = screenToScoutRatio(e.clientX, e.clientY);
        if (ratio) onCrosshairDrag(ratio.hRatio, ratio.vRatio);
        return;
      }

      const tool = interactionToolRef.current ?? activeTool;

      // Angle preview (before drag)
      if (tool === "Angle" && currentAnnotation.current && (angleClickCount.current === 1 || angleClickCount.current === 2)) {
        const pos = screenToImage(e.clientX, e.clientY);
        if (angleClickCount.current === 1) {
          currentAnnotation.current.points[1] = pos;
        } else {
          currentAnnotation.current.points[2] = pos;
        }
        requestAnnotationRender();
      }

      if (!isDragging.current) return;

      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      if (tool === "Pan") {
        setViewTransform((prev) => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
      } else if (tool === "Zoom") {
        setViewTransform((prev) => ({
          ...prev,
          scale: Math.max(0.1, Math.min(8, prev.scale - deltaY * 0.01)),
        }));
      } else if (tool === "Contrast") {
        setViewTransform((prev) => {
          const currentWidth = prev.windowWidth ?? series.windowWidth;
          const currentCenter = prev.windowCenter ?? series.windowCenter;
          return {
            ...prev,
            windowWidth: Math.max(1, currentWidth + deltaX * 0.5),
            windowCenter: currentCenter - deltaY * 0.5,
          };
        });
      } else if (tool === "Stack") {
        accumulatedStackDelta.current += deltaY;
        const threshold = Math.max(2, 12 - stackSpeed);
        const steps = Math.trunc(accumulatedStackDelta.current / threshold);
        if (steps !== 0) {
          accumulatedStackDelta.current -= steps * threshold;
          updateIndexBySteps(steps);
        }
      } else if (tool === "FreeRotate") {
        const currentAngle = getPointerAngleFromCenter(e.clientX, e.clientY);
        const previousAngle = freeRotateLastAngle.current;
        if (previousAngle === null) {
          freeRotateLastAngle.current = currentAngle;
          return;
        }
        let delta = currentAngle - previousAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        const fineTuneMultiplier = e.shiftKey ? 0.35 : 1;
        pendingRotation.current += delta * fineTuneMultiplier;
        freeRotateLastAngle.current = currentAngle;

        if (rotationAnimationFrame.current === null) {
          rotationAnimationFrame.current = requestAnimationFrame(() => {
            const d = pendingRotation.current;
            pendingRotation.current = 0;
            rotationAnimationFrame.current = null;
            setViewTransform((prev) => ({
              ...prev,
              rotation: (prev.rotation + d + 360) % 360,
            }));
          });
        }
      } else if (["Length", "Ellipse", "Rectangle"].includes(tool)) {
        if (currentAnnotation.current) {
          const pos = screenToImage(e.clientX, e.clientY);
          currentAnnotation.current.points[1] = pos;
          requestAnnotationRender();
        }
      } else if (tool === "Freehand") {
        if (currentAnnotation.current) {
          const pos = screenToImage(e.clientX, e.clientY);
          currentAnnotation.current.points.push(pos);
          requestAnnotationRender();
        }
      } else if (tool === "CobbsAngle") {
        if (currentAnnotation.current) {
          const pos = screenToImage(e.clientX, e.clientY);
          if (angleClickCount.current === 1) {
            currentAnnotation.current.points[1] = pos;
          } else if (angleClickCount.current === 3) {
            currentAnnotation.current.points[3] = pos;
          }
          requestAnnotationRender();
        }
      } else {
        // Default: scroll through slices
        if (Math.abs(deltaY) >= 2) {
          const step = deltaY > 0 ? 1 : -1;
          updateIndexBySteps(step);
        }
      }
    },
    [activeTool, setViewTransform, updateIndexBySteps, series.windowWidth, series.windowCenter, screenToImage, getPointerAngleFromCenter, requestAnnotationRender, stackSpeed, onCrosshairDrag, screenToScoutRatio],
  );

  const handleMouseUp = useCallback(() => {
    const tool = interactionToolRef.current ?? activeTool;
    isDragging.current = false;
    isDraggingScoutCircle.current = false;
    freeRotateLastAngle.current = null;

    // Finalize annotations
    if (currentAnnotation.current) {
      if (tool === "Angle" || tool === "CobbsAngle") {
        // Multi-click tools: handle via mouseDown clicks, not mouseUp
        if (tool === "CobbsAngle" && angleClickCount.current === 1) {
          angleClickCount.current = 2; // Move to second line
        }
        return;
      }

      const ann = currentAnnotation.current;
      if (ann.points.length >= 2 || ann.type === "Freehand") {
        setGlobalAnnotations((prev) => [...prev, {
          ...ann,
          index: prev.length + 1,
        }]);
        saveToHistory();
      }
      currentAnnotation.current = null;
      requestAnnotationRender();
    }
  }, [activeTool, setGlobalAnnotations, saveToHistory, requestAnnotationRender]);

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
          data-viewer-canvas="true"
          data-viewer-active={isActive ? "true" : undefined}
          className={
            activeTool === "Zoom"
              ? "cursor-zoom-in"
              : activeTool === "Pan"
              ? "cursor-grab active:cursor-grabbing"
              : activeTool === "Contrast"
              ? "cursor-crosshair"
              : activeTool === "FreeRotate"
              ? "cursor-alias"
              : activeTool === "HU"
              ? "cursor-crosshair"
              : ["Length", "Ellipse", "Rectangle", "Freehand", "Angle", "CobbsAngle"].includes(activeTool)
              ? "cursor-crosshair"
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
        {/* Annotation overlay canvas — same transform as main canvas */}
        <canvas
          ref={annotationCanvasRef}
          className="absolute pointer-events-none"
          style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale}) rotate(${viewTransform.rotation}deg) scaleX(${viewTransform.flipH ? -1 : 1}) scaleY(${viewTransform.flipV ? -1 : 1})`,
            zIndex: 6,
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
                  <span>Age: {patientAge ?? "N/A"}</span>
                  <span>Sex: {caseData.patient?.sex || "U"}</span>
                  <span className="font-medium mt-1">{series.mprMode} MPR</span>
                </div>
              )}

              {/* Image Info - Top Right */}
              <div className="absolute top-0 right-0 text-right flex flex-col gap-0.5">
                <span className="font-bold">Generated MPR Series</span>
                <span>Slices: {series.sliceCount}</span>
                <span>
                  W/L: {effectiveWindowWidth.toFixed(0)} /{" "}
                  {effectiveWindowCenter.toFixed(0)}
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
