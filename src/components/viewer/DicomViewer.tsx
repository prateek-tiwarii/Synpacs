import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dicomParser from "dicom-parser";
import { decode as decodeJ2K } from "@abasb75/openjpeg";
import { Loader2, Maximize, Minimize, Trash2 } from "lucide-react";
import {
  useViewerContext,
  type Annotation,
  type HUStats,
} from "../ViewerLayout";
import { imageCache } from "@/lib/imageCache";

// Instance metadata interface matching the ACTUAL API response
interface Instance {
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

interface DicomViewerProps {
  instances: Instance[];
  className?: string;
  paneIndex?: number;
}

// Helper to format DICOM DA (YYYYMMDD) to readable date
const formatDicomDate = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parseInt(month) - 1]} ${day}, ${year}`;
};

// Helper to format DICOM TM (HHMMSS.FFFFFF) to readable time
const formatDicomTime = (timeStr: string) => {
  if (!timeStr || timeStr.length < 6) return timeStr;
  const hour = timeStr.substring(0, 2);
  const min = timeStr.substring(2, 4);
  const sec = timeStr.substring(4, 6);
  return `${hour}:${min}:${sec}`;
};

// Calculate angle between two vectors (3-point angle)
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

// Calculate Cobb's angle between two lines
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

  // Return acute angle
  if (angleDeg > 90) angleDeg = 180 - angleDeg;
  return angleDeg;
};

// Point-in-polygon test using ray casting
const pointInPolygon = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[],
): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// Distance from point to line segment
const distanceToLineSegment = (
  point: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): number => {
  const A = point.x - p1.x;
  const B = point.y - p1.y;
  const C = p2.x - p1.x;
  const D = p2.y - p1.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;

  let xx, yy;
  if (param < 0) {
    xx = p1.x;
    yy = p1.y;
  } else if (param > 1) {
    xx = p2.x;
    yy = p2.y;
  } else {
    xx = p1.x + param * C;
    yy = p1.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export function DicomViewer({
  instances,
  className = "",
}: DicomViewerProps) {
  const {
    caseData,
    setCurrentImageIndex: setGlobalImageIndex,
    activeTool,
    viewTransform,
    setViewTransform,
    annotations,
    setAnnotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    deleteSelectedAnnotation,
    deleteAnnotationById,
    saveToHistory,
    isFullscreen,
    toggleFullscreen,
    showOverlays,
  } = useViewerContext();

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [prefetchProgress, setPrefetchProgress] = useState<{
    fetched: number;
    total: number;
  } | null>(null);

  // Text annotation input state
  const [textInputVisible, setTextInputVisible] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [textInputPosition, setTextInputPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [textInputScreenPos, setTextInputScreenPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Sync local index with global context for header display
  useEffect(() => {
    setGlobalImageIndex(currentImageIndex);
  }, [currentImageIndex, setGlobalImageIndex]);

  // Focus text input when it becomes visible
  useEffect(() => {
    if (textInputVisible && textInputRef.current) {
      const timer = setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [textInputVisible]);

  // Ref to store the current decoded bitmap for rendering
  const currentBitmap = useRef<ImageBitmap | null>(null);

  // Store raw pixel data and DICOM metadata for W/L adjustment and HU calculations
  const rawPixelDataRef = useRef<Int16Array | Uint16Array | null>(null);
  const dicomMetaRef = useRef<{
    rows: number;
    columns: number;
    slope: number;
    intercept: number;
    defaultWinCenter: number;
    defaultWinWidth: number;
  } | null>(null);

  // Mouse interaction state
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastImagePos = useRef({ x: 0, y: 0 });
  const currentAnnotation = useRef<Annotation | null>(null);
  const accumulatedStackDelta = useRef(0);
  const draggedHandleIndex = useRef<number | null>(null);
  const isModifyingAnnotation = useRef(false);
  const isDraggingWholeAnnotation = useRef(false);

  // For multi-click tools (Angle, CobbsAngle)
  const angleClickCount = useRef(0);

  // Prefetch state (cache is now global singleton)
  const prefetchStarted = useRef(false);
  const activeRequests = useRef(0);
  const MAX_CONCURRENT_REQUESTS = 5;

  // Memoize sorted instances
  const sortedInstances = useMemo(
    () => [...instances].sort((a, b) => a.sort_key - b.sort_key),
    [instances],
  );

  const screenToImage = useCallback(
    (screenX: number, screenY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      let x = screenX - rect.left - canvas.width / 2;
      let y = screenY - rect.top - canvas.height / 2;

      x -= viewTransform.x;
      y -= viewTransform.y;
      x /= viewTransform.scale;
      y /= viewTransform.scale;

      const angle = (-viewTransform.rotation * Math.PI) / 180;
      const rx = x * Math.cos(angle) - y * Math.sin(angle);
      const ry = x * Math.sin(angle) + y * Math.cos(angle);
      x = rx;
      y = ry;

      if (viewTransform.flipH) x = -x;
      if (viewTransform.flipV) y = -y;

      return { x, y };
    },
    [viewTransform],
  );

  // Check if a point is within image bounds
  const isPointInImageBounds = useCallback(
    (point: { x: number; y: number }): boolean => {
      if (!dicomMetaRef.current) return true;
      const { rows, columns } = dicomMetaRef.current;
      const halfWidth = columns / 2;
      const halfHeight = rows / 2;
      return (
        point.x >= -halfWidth &&
        point.x <= halfWidth &&
        point.y >= -halfHeight &&
        point.y <= halfHeight
      );
    },
    [],
  );

  // Check if any annotation point is outside image bounds
  const isAnnotationOutsideBounds = useCallback(
    (ann: Annotation): boolean => {
      return ann.points.some((p) => !isPointInImageBounds(p));
    },
    [isPointInImageBounds],
  );

  // Calculate HU statistics for a region
  const calculateHUStats = useCallback(
    (
      pixelIndices: number[],
      pixelSpacing: number[] | undefined,
    ): HUStats | undefined => {
      if (
        !rawPixelDataRef.current ||
        !dicomMetaRef.current ||
        pixelIndices.length === 0
      ) {
        return undefined;
      }

      const { slope, intercept } = dicomMetaRef.current;
      const pixelData = rawPixelDataRef.current;

      let sum = 0;
      let min = Infinity;
      let max = -Infinity;

      for (const idx of pixelIndices) {
        if (idx >= 0 && idx < pixelData.length) {
          const hu = pixelData[idx] * slope + intercept;
          sum += hu;
          if (hu < min) min = hu;
          if (hu > max) max = hu;
        }
      }

      const mean = sum / pixelIndices.length;
      const psX = pixelSpacing?.[0] ?? 1;
      const psY = pixelSpacing?.[1] ?? 1;
      const area = pixelIndices.length * psX * psY;

      return {
        mean: Math.round(mean * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        area: Math.round(area * 100) / 100,
      };
    },
    [],
  );

  // Get pixel indices inside an ellipse
  const getPixelsInEllipse = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }): number[] => {
      if (!dicomMetaRef.current) return [];
      const { rows, columns } = dicomMetaRef.current;

      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const radiusX = Math.abs(p2.x - p1.x) / 2;
      const radiusY = Math.abs(p2.y - p1.y) / 2;

      if (radiusX === 0 || radiusY === 0) return [];

      const indices: number[] = [];
      const halfWidth = columns / 2;
      const halfHeight = rows / 2;

      const minX = Math.max(0, Math.floor(centerX - radiusX + halfWidth));
      const maxX = Math.min(
        columns - 1,
        Math.ceil(centerX + radiusX + halfWidth),
      );
      const minY = Math.max(0, Math.floor(centerY - radiusY + halfHeight));
      const maxY = Math.min(
        rows - 1,
        Math.ceil(centerY + radiusY + halfHeight),
      );

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const imgX = x - halfWidth;
          const imgY = y - halfHeight;
          const dx = (imgX - centerX) / radiusX;
          const dy = (imgY - centerY) / radiusY;
          if (dx * dx + dy * dy <= 1) {
            indices.push(y * columns + x);
          }
        }
      }
      return indices;
    },
    [],
  );

  // Get HU value at a single point
  const getHUAtPoint = useCallback(
    (point: { x: number; y: number }): number | null => {
      if (!rawPixelDataRef.current || !dicomMetaRef.current) return null;

      const { rows, columns, slope, intercept } = dicomMetaRef.current;
      const halfWidth = columns / 2;
      const halfHeight = rows / 2;

      const pixelX = Math.round(point.x + halfWidth);
      const pixelY = Math.round(point.y + halfHeight);

      if (pixelX < 0 || pixelX >= columns || pixelY < 0 || pixelY >= rows) {
        return null;
      }

      const pixelIndex = pixelY * columns + pixelX;
      const rawValue = rawPixelDataRef.current[pixelIndex];
      const huValue = rawValue * slope + intercept;

      return Math.round(huValue);
    },
    [],
  );

  // Get pixel indices inside a rectangle
  const getPixelsInRectangle = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }): number[] => {
      if (!dicomMetaRef.current) return [];
      const { rows, columns } = dicomMetaRef.current;

      const halfWidth = columns / 2;
      const halfHeight = rows / 2;

      const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x) + halfWidth));
      const maxX = Math.min(
        columns - 1,
        Math.ceil(Math.max(p1.x, p2.x) + halfWidth),
      );
      const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y) + halfHeight));
      const maxY = Math.min(
        rows - 1,
        Math.ceil(Math.max(p1.y, p2.y) + halfHeight),
      );

      const indices: number[] = [];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          indices.push(y * columns + x);
        }
      }
      return indices;
    },
    [],
  );

  // Get pixel indices inside a freehand polygon
  const getPixelsInFreehand = useCallback(
    (points: { x: number; y: number }[]): number[] => {
      if (!dicomMetaRef.current || points.length < 3) return [];
      const { rows, columns } = dicomMetaRef.current;

      const halfWidth = columns / 2;
      const halfHeight = rows / 2;

      // Find bounding box
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const pixMinX = Math.max(0, Math.floor(minX + halfWidth));
      const pixMaxX = Math.min(columns - 1, Math.ceil(maxX + halfWidth));
      const pixMinY = Math.max(0, Math.floor(minY + halfHeight));
      const pixMaxY = Math.min(rows - 1, Math.ceil(maxY + halfHeight));

      const indices: number[] = [];
      for (let y = pixMinY; y <= pixMaxY; y++) {
        for (let x = pixMinX; x <= pixMaxX; x++) {
          const imgX = x - halfWidth;
          const imgY = y - halfHeight;
          if (pointInPolygon({ x: imgX, y: imgY }, points)) {
            indices.push(y * columns + x);
          }
        }
      }
      return indices;
    },
    [],
  );

  // Calculate perimeter for freehand shape
  const calculatePerimeter = useCallback(
    (
      points: { x: number; y: number }[],
      pixelSpacing: number[] | undefined,
    ): number => {
      if (points.length < 2) return 0;
      const psX = pixelSpacing?.[0] ?? 1;
      const psY = pixelSpacing?.[1] ?? 1;

      let perimeter = 0;
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const dx = (p2.x - p1.x) * psX;
        const dy = (p2.y - p1.y) * psY;
        perimeter += Math.sqrt(dx * dx + dy * dy);
      }
      return Math.round(perimeter * 100) / 100;
    },
    [],
  );

  // Hit test for annotation selection
  const hitTestAnnotation = useCallback(
    (
      point: { x: number; y: number },
      ann: Annotation,
      threshold: number = 10,
    ): { hit: boolean; handleIndex: number | null } => {
      // First check handles
      for (let i = 0; i < ann.points.length; i++) {
        const p = ann.points[i];
        const dist = Math.sqrt(
          Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2),
        );
        if (dist <= threshold) {
          return { hit: true, handleIndex: i };
        }
      }

      // Then check the shape itself
      switch (ann.type) {
        case "Length":
          if (ann.points.length === 2) {
            const dist = distanceToLineSegment(
              point,
              ann.points[0],
              ann.points[1],
            );
            return { hit: dist <= threshold, handleIndex: null };
          }
          break;

        case "Angle":
          if (ann.points.length === 3) {
            const dist1 = distanceToLineSegment(
              point,
              ann.points[0],
              ann.points[1],
            );
            const dist2 = distanceToLineSegment(
              point,
              ann.points[1],
              ann.points[2],
            );
            return {
              hit: Math.min(dist1, dist2) <= threshold,
              handleIndex: null,
            };
          }
          break;

        case "CobbsAngle":
          if (ann.points.length === 4) {
            const dist1 = distanceToLineSegment(
              point,
              ann.points[0],
              ann.points[1],
            );
            const dist2 = distanceToLineSegment(
              point,
              ann.points[2],
              ann.points[3],
            );
            return {
              hit: Math.min(dist1, dist2) <= threshold,
              handleIndex: null,
            };
          }
          break;

        case "Rectangle":
          if (ann.points.length === 2) {
            const p1 = ann.points[0];
            const p2 = ann.points[1];
            const dist1 = distanceToLineSegment(point, p1, {
              x: p2.x,
              y: p1.y,
            });
            const dist2 = distanceToLineSegment(
              point,
              { x: p2.x, y: p1.y },
              p2,
            );
            const dist3 = distanceToLineSegment(point, p2, {
              x: p1.x,
              y: p2.y,
            });
            const dist4 = distanceToLineSegment(
              point,
              { x: p1.x, y: p2.y },
              p1,
            );
            return {
              hit: Math.min(dist1, dist2, dist3, dist4) <= threshold,
              handleIndex: null,
            };
          }
          break;

        case "Ellipse":
          if (ann.points.length === 2) {
            const p1 = ann.points[0];
            const p2 = ann.points[1];
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            const radiusX = Math.abs(p2.x - p1.x) / 2;
            const radiusY = Math.abs(p2.y - p1.y) / 2;
            if (radiusX > 0 && radiusY > 0) {
              const dx = (point.x - centerX) / radiusX;
              const dy = (point.y - centerY) / radiusY;
              const dist =
                Math.abs(Math.sqrt(dx * dx + dy * dy) - 1) *
                Math.min(radiusX, radiusY);
              return { hit: dist <= threshold, handleIndex: null };
            }
          }
          break;

        case "Freehand":
          for (let i = 0; i < ann.points.length - 1; i++) {
            const dist = distanceToLineSegment(
              point,
              ann.points[i],
              ann.points[i + 1],
            );
            if (dist <= threshold) {
              return { hit: true, handleIndex: null };
            }
          }
          break;

        case "Text":
          if (ann.points.length === 1) {
            const dist = Math.sqrt(
              Math.pow(point.x - ann.points[0].x, 2) +
              Math.pow(point.y - ann.points[0].y, 2),
            );
            return { hit: dist <= threshold * 3, handleIndex: null };
          }
          break;

        case "HU":
          if (ann.points.length === 1) {
            const dist = Math.sqrt(
              Math.pow(point.x - ann.points[0].x, 2) +
              Math.pow(point.y - ann.points[0].y, 2),
            );
            return { hit: dist <= threshold * 2, handleIndex: null };
          }
          break;
      }

      return { hit: false, handleIndex: null };
    },
    [],
  );

  // Render annotations with selection support
  const renderAnnotations = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const currentInstance = sortedInstances[currentImageIndex];
      const pixelSpacing = currentInstance?.pixel_spacing;

      const allAnnotations = [
        ...annotations,
        ...(currentAnnotation.current ? [currentAnnotation.current] : []),
      ];

      allAnnotations.forEach((ann, annIndex) => {
        if (!ann || !ann.points || ann.points.length < 1) return;

        const isSelected = ann.id === selectedAnnotationId;
        const baseColor = isSelected ? "#00bfff" : "#00ff00";

        ctx.strokeStyle = baseColor;
        ctx.fillStyle = baseColor;
        ctx.lineWidth = (isSelected ? 3 : 2) / viewTransform.scale;
        ctx.font = `${14 / viewTransform.scale}px sans-serif`;

        ctx.beginPath();

        if (ann.type === "Length") {
          if (ann.points.length >= 2) {
            ctx.moveTo(ann.points[0].x, ann.points[0].y);
            ctx.lineTo(ann.points[1].x, ann.points[1].y);
            ctx.stroke();

            // Calculate and display distance
            const dx = ann.points[1].x - ann.points[0].x;
            const dy = ann.points[1].y - ann.points[0].y;
            let distText = "";
            if (pixelSpacing && pixelSpacing.length === 2) {
              const distMm = Math.sqrt(
                Math.pow(dx * pixelSpacing[0], 2) +
                Math.pow(dy * pixelSpacing[1], 2),
              ).toFixed(2);
              distText = `${ann.index ?? annIndex + 1}: ${distMm} mm`;
            } else {
              const distPx = Math.sqrt(dx * dx + dy * dy).toFixed(2);
              distText = `${ann.index ?? annIndex + 1}: ${distPx} px`;
            }
            ctx.fillText(distText, ann.points[1].x + 5, ann.points[1].y + 5);
          }
        } else if (ann.type === "Freehand") {
          ctx.moveTo(ann.points[0].x, ann.points[0].y);
          ann.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
          // Close the path if we have enough points
          if (ann.points.length > 2) {
            ctx.closePath();
          }
          ctx.stroke();

          // Display HU stats if available
          if (ann.huStats && ann.points.length > 2) {
            const centerX =
              ann.points.reduce((sum, p) => sum + p.x, 0) / ann.points.length;
            const centerY =
              ann.points.reduce((sum, p) => sum + p.y, 0) / ann.points.length;
            const lineHeight = 16 / viewTransform.scale;
            ctx.fillText(
              `${ann.index ?? annIndex + 1}: Mean: ${ann.huStats.mean.toFixed(0)} HU`,
              centerX,
              centerY - lineHeight,
            );
            ctx.fillText(
              `Min: ${ann.huStats.min.toFixed(0)}, Max: ${ann.huStats.max.toFixed(0)} HU`,
              centerX,
              centerY,
            );
            ctx.fillText(
              `Area: ${ann.huStats.area.toFixed(1)} mm²`,
              centerX,
              centerY + lineHeight,
            );
            if (ann.huStats.perimeter !== undefined) {
              ctx.fillText(
                `Perim: ${ann.huStats.perimeter.toFixed(1)} mm`,
                centerX,
                centerY + lineHeight * 2,
              );
            }
          }
        } else if (ann.type === "Rectangle") {
          const p1 = ann.points[0];
          const p2 = ann.points[1] || p1;
          ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

          // Display HU stats
          if (ann.huStats) {
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            const lineHeight = 16 / viewTransform.scale;
            ctx.fillText(
              `${ann.index ?? annIndex + 1}: Mean: ${ann.huStats.mean.toFixed(0)} HU`,
              centerX - 40 / viewTransform.scale,
              centerY - lineHeight,
            );
            ctx.fillText(
              `Min: ${ann.huStats.min.toFixed(0)}, Max: ${ann.huStats.max.toFixed(0)} HU`,
              centerX - 40 / viewTransform.scale,
              centerY,
            );
            ctx.fillText(
              `Area: ${ann.huStats.area.toFixed(1)} mm²`,
              centerX - 40 / viewTransform.scale,
              centerY + lineHeight,
            );
          }
        } else if (ann.type === "Ellipse") {
          const p1 = ann.points[0];
          const p2 = ann.points[1] || p1;
          const centerX = (p1.x + p2.x) / 2;
          const centerY = (p1.y + p2.y) / 2;
          const radiusX = Math.abs(p2.x - p1.x) / 2;
          const radiusY = Math.abs(p2.y - p1.y) / 2;
          if (radiusX > 0 && radiusY > 0) {
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.stroke();

            // Display HU stats
            if (ann.huStats) {
              const lineHeight = 16 / viewTransform.scale;
              ctx.fillText(
                `${ann.index ?? annIndex + 1}: Mean: ${ann.huStats.mean.toFixed(0)} HU`,
                centerX - 40 / viewTransform.scale,
                centerY - lineHeight,
              );
              ctx.fillText(
                `Min: ${ann.huStats.min.toFixed(0)}, Max: ${ann.huStats.max.toFixed(0)} HU`,
                centerX - 40 / viewTransform.scale,
                centerY,
              );
              ctx.fillText(
                `Area: ${ann.huStats.area.toFixed(1)} mm²`,
                centerX - 40 / viewTransform.scale,
                centerY + lineHeight,
              );
            }
          }
        } else if (ann.type === "Text") {
          // Draw text annotation with better visibility
          const fontSize = 18 / viewTransform.scale;
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.fillStyle = baseColor;
          // Draw text shadow/outline for better visibility
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3 / viewTransform.scale;
          ctx.strokeText(ann.text || "Text", ann.points[0].x, ann.points[0].y);
          ctx.fillText(ann.text || "Text", ann.points[0].x, ann.points[0].y);
        } else if (ann.type === "HU") {
          // Draw HU point measurement
          const fontSize = 14 / viewTransform.scale;
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;

          // Draw crosshair at point
          const crossSize = 8 / viewTransform.scale;
          ctx.strokeStyle = "#ffff00";
          ctx.lineWidth = 2 / viewTransform.scale;
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x - crossSize, ann.points[0].y);
          ctx.lineTo(ann.points[0].x + crossSize, ann.points[0].y);
          ctx.moveTo(ann.points[0].x, ann.points[0].y - crossSize);
          ctx.lineTo(ann.points[0].x, ann.points[0].y + crossSize);
          ctx.stroke();

          // Draw HU value with background
          const huText = `${ann.index ?? annIndex + 1}: ${ann.huValue} HU`;
          ctx.fillStyle = "#ffff00";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 3 / viewTransform.scale;
          ctx.strokeText(
            huText,
            ann.points[0].x + 12 / viewTransform.scale,
            ann.points[0].y + 5 / viewTransform.scale,
          );
          ctx.fillText(
            huText,
            ann.points[0].x + 12 / viewTransform.scale,
            ann.points[0].y + 5 / viewTransform.scale,
          );
        } else if (ann.type === "Angle") {
          if (ann.points.length >= 2) {
            // Draw first arm
            ctx.moveTo(ann.points[0].x, ann.points[0].y);
            ctx.lineTo(ann.points[1].x, ann.points[1].y);
            ctx.stroke();

            if (ann.points.length === 3) {
              // Draw second arm
              ctx.beginPath();
              ctx.moveTo(ann.points[1].x, ann.points[1].y);
              ctx.lineTo(ann.points[2].x, ann.points[2].y);
              ctx.stroke();

              // Draw arc
              const angle = calculateAngle(
                ann.points[0],
                ann.points[1],
                ann.points[2],
              );
              const vec1 = {
                x: ann.points[0].x - ann.points[1].x,
                y: ann.points[0].y - ann.points[1].y,
              };
              const vec2 = {
                x: ann.points[2].x - ann.points[1].x,
                y: ann.points[2].y - ann.points[1].y,
              };
              const startAngle = Math.atan2(vec1.y, vec1.x);
              const endAngle = Math.atan2(vec2.y, vec2.x);
              const arcRadius = 25 / viewTransform.scale;

              ctx.beginPath();
              ctx.arc(
                ann.points[1].x,
                ann.points[1].y,
                arcRadius,
                startAngle,
                endAngle,
              );
              ctx.stroke();

              // Display angle
              const midAngle = (startAngle + endAngle) / 2;
              const labelX =
                ann.points[1].x +
                (arcRadius + 15 / viewTransform.scale) * Math.cos(midAngle);
              const labelY =
                ann.points[1].y +
                (arcRadius + 15 / viewTransform.scale) * Math.sin(midAngle);
              ctx.fillText(
                `${ann.index ?? annIndex + 1}: ${angle.toFixed(1)}°`,
                labelX,
                labelY,
              );
            }
          }
        } else if (ann.type === "CobbsAngle") {
          if (ann.points.length >= 2) {
            // Draw first line
            ctx.moveTo(ann.points[0].x, ann.points[0].y);
            ctx.lineTo(ann.points[1].x, ann.points[1].y);
            ctx.stroke();

            if (ann.points.length >= 4) {
              // Draw second line
              ctx.beginPath();
              ctx.moveTo(ann.points[2].x, ann.points[2].y);
              ctx.lineTo(ann.points[3].x, ann.points[3].y);
              ctx.stroke();

              // Calculate and display Cobb's angle
              const cobbAngle = calculateCobbsAngle(
                ann.points[0],
                ann.points[1],
                ann.points[2],
                ann.points[3],
              );

              // Display near the midpoint of the second line
              const midX = (ann.points[2].x + ann.points[3].x) / 2;
              const midY = (ann.points[2].y + ann.points[3].y) / 2;
              ctx.fillStyle = "#ffff00";
              ctx.fillText(
                `${ann.index ?? annIndex + 1}: Cobb: ${cobbAngle.toFixed(1)}°`,
                midX + 10 / viewTransform.scale,
                midY,
              );
            }
          }
        }

        // Draw control handles for selected annotation
        if (isSelected) {
          const handleRadius = 5 / viewTransform.scale;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2 / viewTransform.scale;

          ann.points.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, handleRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          });
        }
      });
    },
    [
      annotations,
      selectedAnnotationId,
      viewTransform.scale,
      sortedInstances,
      currentImageIndex,
    ],
  );

  // Rendering logic
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentBitmap.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.translate(viewTransform.x, viewTransform.y);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    ctx.rotate((viewTransform.rotation * Math.PI) / 180);

    const scaleX = viewTransform.flipH ? -1 : 1;
    const scaleY = viewTransform.flipV ? -1 : 1;
    ctx.scale(scaleX, scaleY);

    if (viewTransform.invert) {
      ctx.filter = "invert(1)";
    }

    const img = currentBitmap.current;
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.filter = "none";

    renderAnnotations(ctx);
    ctx.restore();
  }, [viewTransform, renderAnnotations]);

  // Redraw when transform changes or on resize
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    window.addEventListener("resize", renderCanvas);
    return () => window.removeEventListener("resize", renderCanvas);
  }, [renderCanvas]);

  // Keyboard handler for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedAnnotationId
      ) {
        e.preventDefault();
        deleteSelectedAnnotation();
        renderCanvas();
      }

      // Escape to deselect
      if (e.key === "Escape") {
        setSelectedAnnotationId(null);
        angleClickCount.current = 0;
        currentAnnotation.current = null;
        renderCanvas();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedAnnotationId,
    deleteSelectedAnnotation,
    setSelectedAnnotationId,
    renderCanvas,
  ]);

  // Pre-fetch logic using global cache
  useEffect(() => {
    if (sortedInstances.length <= 1) return;

    if (!prefetchStarted.current && currentImageIndex > 0) {
      prefetchStarted.current = true;

      const queue = sortedInstances.filter(
        (inst) => !imageCache.get(inst.instance_uid),
      );
      if (queue.length === 0) return;

      setPrefetchProgress({ fetched: 0, total: queue.length });

      let queueIndex = 0;
      let currentFetched = 0;

      const processQueue = async () => {
        if (queueIndex >= queue.length) return;

        while (
          activeRequests.current < MAX_CONCURRENT_REQUESTS &&
          queueIndex < queue.length
        ) {
          const instance = queue[queueIndex++];
          activeRequests.current++;

          const url = `${API_BASE_URL}/api/v1/instances/${instance.instance_uid}/dicom`;

          fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error("Fetch failed");
              return res.arrayBuffer();
            })
            .then((buffer) => {
              imageCache.set(instance.instance_uid, buffer);
              currentFetched++;
              setPrefetchProgress({
                fetched: currentFetched,
                total: queue.length,
              });
            })
            .catch((err) =>
              console.error(
                `Failed to prefetch ${instance.instance_uid}:`,
                err,
              ),
            )
            .finally(() => {
              activeRequests.current--;
              if (currentFetched === queue.length) {
                setTimeout(() => setPrefetchProgress(null), 2000);
              }
              processQueue();
            });
        }
      };

      processQueue();
    }
  }, [currentImageIndex, sortedInstances, API_BASE_URL]);

  // Load and Render Image
  useEffect(() => {
    if (sortedInstances.length === 0) return;

    let mounted = true;
    const currentInstance = sortedInstances[currentImageIndex];

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use global cache - no auth token needed for plain fetch
        const cached = imageCache.get(currentInstance.instance_uid);
        let arrayBuffer: ArrayBuffer;

        if (cached) {
          arrayBuffer = cached;
        } else {
          const instanceUrl = `${API_BASE_URL}/api/v1/instances/${currentInstance.instance_uid}/dicom`;
          const response = await fetch(instanceUrl);
          if (!response.ok)
            throw new Error(`Fetch failed: ${response.statusText}`);
          arrayBuffer = await response.arrayBuffer();
          if (mounted) {
            imageCache.set(currentInstance.instance_uid, arrayBuffer);
          }
        }

        if (!mounted) return;

        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        const rows = dataSet.uint16("x00280010") || currentInstance.rows;
        const columns = dataSet.uint16("x00280011") || currentInstance.columns;
        const winCenter =
          dataSet.floatString("x00281050") ||
          currentInstance.window_center ||
          40;
        const winWidth =
          dataSet.floatString("x00281051") ||
          currentInstance.window_width ||
          400;
        const slope =
          dataSet.floatString("x00281053") ||
          currentInstance.rescale_slope ||
          1;
        const intercept =
          dataSet.floatString("x00281052") ||
          currentInstance.rescale_intercept ||
          0;
        const pixelRepresentation = dataSet.uint16("x00280103") ?? 0;
        const transferSyntax = dataSet.string("x00020010");
        const pixelDataElement = dataSet.elements.x7fe00010;

        if (!pixelDataElement) throw new Error("Pixel Data not found");

        let pixelData: Int16Array | Uint16Array;
        const safeLength =
          pixelDataElement.length > 0
            ? pixelDataElement.length
            : arrayBuffer.byteLength - pixelDataElement.dataOffset;
        const rawPixelData = new Uint8Array(
          arrayBuffer,
          pixelDataElement.dataOffset,
          safeLength,
        );

        const isJ2K =
          transferSyntax === "1.2.840.10008.1.2.4.90" ||
          transferSyntax === "1.2.840.10008.1.2.4.91";

        if (isJ2K) {
          let j2kStart = 0;
          for (let i = 0; i < 4000 && i < rawPixelData.length - 1; i++) {
            if (rawPixelData[i] === 0xff && rawPixelData[i + 1] === 0x4f) {
              j2kStart = i;
              break;
            }
          }
          const decoded = await decodeJ2K(rawPixelData.slice(j2kStart).buffer);
          let rawDecodedBytes = new Uint8Array(decoded.decodedBuffer);

          let temp = new Uint16Array(
            rawDecodedBytes.buffer,
            rawDecodedBytes.byteOffset,
            100,
          );
          if (Math.max(...Array.from(temp)) < 256) {
            const swapped = new Uint8Array(rawDecodedBytes.length);
            for (let i = 0; i < rawDecodedBytes.length; i += 2) {
              swapped[i] = rawDecodedBytes[i + 1];
              swapped[i + 1] = rawDecodedBytes[i];
            }
            rawDecodedBytes = swapped;
          }

          pixelData =
            pixelRepresentation === 1
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
        } else {
          const rawData = byteArray.buffer.slice(
            pixelDataElement.dataOffset,
            pixelDataElement.dataOffset + safeLength,
          );
          pixelData =
            pixelRepresentation === 1
              ? new Int16Array(rawData)
              : new Uint16Array(rawData);
        }

        if (!mounted) return;

        rawPixelDataRef.current = pixelData;
        dicomMetaRef.current = {
          rows,
          columns,
          slope,
          intercept,
          defaultWinCenter: winCenter,
          defaultWinWidth: winWidth,
        };

        const effectiveWinWidth = viewTransform.windowWidth ?? winWidth;
        const effectiveWinCenter = viewTransform.windowCenter ?? winCenter;

        const rgbaData = new Uint8ClampedArray(columns * rows * 4);
        const minValue = effectiveWinCenter - effectiveWinWidth / 2;
        for (let i = 0; i < pixelData.length; i++) {
          const val = pixelData[i] * slope + intercept;
          let display = ((val - minValue) / effectiveWinWidth) * 255;
          display = Math.max(0, Math.min(255, display));
          const idx = i * 4;
          rgbaData[idx] = rgbaData[idx + 1] = rgbaData[idx + 2] = display;
          rgbaData[idx + 3] = 255;
        }

        const imageData = new ImageData(rgbaData, columns, rows);
        currentBitmap.current = await createImageBitmap(imageData);

        if (mounted) {
          renderCanvas();
          setIsLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Render Error");
          setIsLoading(false);
        }
      }
    };

    loadImage();
    return () => {
      mounted = false;
    };
  }, [
    currentImageIndex,
    sortedInstances,
    renderCanvas,
    viewTransform.windowWidth,
    viewTransform.windowCenter,
    API_BASE_URL,
  ]);

  // Finalize annotation with HU stats
  const finalizeAnnotation = useCallback(
    (ann: Annotation): Annotation => {
      const currentInstance = sortedInstances[currentImageIndex];
      const pixelSpacing = currentInstance?.pixel_spacing;

      // Calculate HU stats for region-based annotations
      if (ann.type === "Ellipse" && ann.points.length === 2) {
        const pixels = getPixelsInEllipse(ann.points[0], ann.points[1]);
        ann.huStats = calculateHUStats(pixels, pixelSpacing);
      } else if (ann.type === "Rectangle" && ann.points.length === 2) {
        const pixels = getPixelsInRectangle(ann.points[0], ann.points[1]);
        ann.huStats = calculateHUStats(pixels, pixelSpacing);
      } else if (ann.type === "Freehand" && ann.points.length >= 3) {
        const pixels = getPixelsInFreehand(ann.points);
        const huStats = calculateHUStats(pixels, pixelSpacing);
        if (huStats) {
          huStats.perimeter = calculatePerimeter(ann.points, pixelSpacing);
          ann.huStats = huStats;
        }
      } else if (ann.type === "Angle" && ann.points.length === 3) {
        ann.angleDegrees = calculateAngle(
          ann.points[0],
          ann.points[1],
          ann.points[2],
        );
      } else if (ann.type === "CobbsAngle" && ann.points.length === 4) {
        ann.angleDegrees = calculateCobbsAngle(
          ann.points[0],
          ann.points[1],
          ann.points[2],
          ann.points[3],
        );
      } else if (ann.type === "Length" && ann.points.length === 2) {
        const dx = ann.points[1].x - ann.points[0].x;
        const dy = ann.points[1].y - ann.points[0].y;
        if (pixelSpacing && pixelSpacing.length === 2) {
          ann.distanceMm = Math.sqrt(
            Math.pow(dx * pixelSpacing[0], 2) +
            Math.pow(dy * pixelSpacing[1], 2),
          );
        }
      }

      return ann;
    },
    [
      sortedInstances,
      currentImageIndex,
      getPixelsInEllipse,
      getPixelsInRectangle,
      getPixelsInFreehand,
      calculateHUStats,
      calculatePerimeter,
    ],
  );

  // Interaction Handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToImage(e.clientX, e.clientY);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      accumulatedStackDelta.current = 0;

      // Handle Text tool immediately - don't check for hit testing
      if (activeTool === "Text") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedAnnotationId(null);
        setTextInputPosition(pos);
        setTextInputScreenPos({ x: e.clientX, y: e.clientY });
        setTextInputValue("");
        setTextInputVisible(true);
        isDragging.current = false;
        return;
      }

      // Handle HU tool - get HU value at clicked point
      if (activeTool === "HU") {
        e.preventDefault();
        const huValue = getHUAtPoint(pos);
        if (huValue !== null) {
          const newAnnotation: Annotation = {
            id: Math.random().toString(36).substr(2, 9),
            type: "HU",
            points: [pos],
            color: "#ffff00",
            huValue: huValue,
            index: annotations.length + 1,
          };
          setAnnotations((prev) => [...prev, newAnnotation]);
          saveToHistory();
        }
        isDragging.current = false;
        return;
      }

      // Check if clicking on an existing annotation (for non-Text tools)
      const threshold = 10 / viewTransform.scale;
      for (let i = annotations.length - 1; i >= 0; i--) {
        const { hit, handleIndex } = hitTestAnnotation(
          pos,
          annotations[i],
          threshold,
        );
        if (hit) {
          setSelectedAnnotationId(annotations[i].id);
          lastImagePos.current = pos;
          if (handleIndex !== null) {
            draggedHandleIndex.current = handleIndex;
            isModifyingAnnotation.current = true;
          } else {
            // No specific handle - drag the whole annotation (useful for Text and moving shapes)
            isDraggingWholeAnnotation.current = true;
            isModifyingAnnotation.current = true;
          }
          isDragging.current = true;
          return;
        }
      }

      // Deselect if clicking elsewhere (when not using an annotation tool)
      const annotationTools = [
        "Length",
        "Ellipse",
        "Rectangle",
        "Freehand",
        "Angle",
        "CobbsAngle",
      ];
      if (!annotationTools.includes(activeTool)) {
        setSelectedAnnotationId(null);
      }

      isDragging.current = true;

      // Handle annotation tools
      if (annotationTools.includes(activeTool)) {
        setSelectedAnnotationId(null);
        const id = Math.random().toString(36).substr(2, 9);

        if (activeTool === "Angle") {
          if (angleClickCount.current === 0) {
            // First click - start the angle
            currentAnnotation.current = {
              id,
              type: "Angle",
              points: [pos],
              color: "#00ff00",
            };
            angleClickCount.current = 1;
          } else if (angleClickCount.current === 1) {
            // Second click - vertex
            if (currentAnnotation.current) {
              currentAnnotation.current.points.push(pos);
              angleClickCount.current = 2;
            }
          }
          // Third point is added on mouseUp
        } else if (activeTool === "CobbsAngle") {
          if (angleClickCount.current === 0) {
            // First click - start first line
            currentAnnotation.current = {
              id,
              type: "CobbsAngle",
              points: [pos],
              color: "#ffff00",
            };
            angleClickCount.current = 1;
          } else if (angleClickCount.current === 2) {
            // Third click - start second line
            if (currentAnnotation.current) {
              currentAnnotation.current.points.push(pos);
              angleClickCount.current = 3;
            }
          }
          // Other points are added during drag/mouseUp
        } else {
          currentAnnotation.current = {
            id,
            type: activeTool as Annotation["type"],
            points: [pos],
            color: "#00ff00",
          };
        }
        renderCanvas();
      }
    },
    [
      activeTool,
      screenToImage,
      setAnnotations,
      saveToHistory,
      annotations,
      viewTransform.scale,
      hitTestAnnotation,
      setSelectedAnnotationId,
      renderCanvas,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      // Handle modifying selected annotation
      if (isModifyingAnnotation.current && selectedAnnotationId) {
        const pos = screenToImage(e.clientX, e.clientY);

        if (draggedHandleIndex.current !== null) {
          // Dragging a specific handle point
          setAnnotations((prev) =>
            prev.map((ann) => {
              if (ann.id === selectedAnnotationId) {
                const newPoints = [...ann.points];
                newPoints[draggedHandleIndex.current!] = pos;
                return { ...ann, points: newPoints };
              }
              return ann;
            }),
          );
        } else if (isDraggingWholeAnnotation.current) {
          // Dragging the whole annotation - move all points
          const dx = pos.x - lastImagePos.current.x;
          const dy = pos.y - lastImagePos.current.y;
          lastImagePos.current = pos;

          setAnnotations((prev) =>
            prev.map((ann) => {
              if (ann.id === selectedAnnotationId) {
                const newPoints = ann.points.map((p) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                }));
                return { ...ann, points: newPoints };
              }
              return ann;
            }),
          );
        }
        renderCanvas();
        return;
      }

      if (activeTool === "Pan") {
        setViewTransform((prev) => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
      } else if (activeTool === "Zoom") {
        setViewTransform((prev) => ({
          ...prev,
          scale: Math.max(0.1, prev.scale - deltaY * 0.01),
        }));
      } else if (activeTool === "Stack") {
        accumulatedStackDelta.current += deltaY;
        if (Math.abs(accumulatedStackDelta.current) >= 1) {
          const step =
            Math.sign(accumulatedStackDelta.current) *
            Math.floor(Math.abs(accumulatedStackDelta.current));
          setCurrentImageIndex((prev) =>
            Math.max(0, Math.min(prev + step, sortedInstances.length - 1)),
          );
          accumulatedStackDelta.current = 0;
        }
      } else if (activeTool === "Contrast") {
        if (dicomMetaRef.current) {
          const { defaultWinWidth, defaultWinCenter } = dicomMetaRef.current;
          setViewTransform((prev) => {
            const currentWidth = prev.windowWidth ?? defaultWinWidth;
            const currentCenter = prev.windowCenter ?? defaultWinCenter;
            const widthDelta = deltaX * 2;
            const centerDelta = deltaY * 2;
            return {
              ...prev,
              windowWidth: Math.max(1, currentWidth + widthDelta),
              windowCenter: currentCenter - centerDelta,
            };
          });
        }
      } else if (activeTool === "FreeRotate") {
        setViewTransform((prev) => ({
          ...prev,
          rotation: (prev.rotation + deltaX * 0.5 + 360) % 360,
        }));
      } else if (["Length", "Ellipse", "Rectangle"].includes(activeTool)) {
        if (currentAnnotation.current) {
          const pos = screenToImage(e.clientX, e.clientY);
          currentAnnotation.current.points[1] = pos;
          renderCanvas();
        }
      } else if (activeTool === "Freehand") {
        if (currentAnnotation.current) {
          const pos = screenToImage(e.clientX, e.clientY);
          currentAnnotation.current.points.push(pos);
          renderCanvas();
        }
      } else if (activeTool === "Angle") {
        if (currentAnnotation.current && angleClickCount.current === 2) {
          const pos = screenToImage(e.clientX, e.clientY);
          currentAnnotation.current.points[2] = pos;
          renderCanvas();
        }
      } else if (activeTool === "CobbsAngle") {
        if (currentAnnotation.current) {
          const pos = screenToImage(e.clientX, e.clientY);
          if (angleClickCount.current === 1) {
            // Drawing first line
            currentAnnotation.current.points[1] = pos;
          } else if (angleClickCount.current === 3) {
            // Drawing second line
            currentAnnotation.current.points[3] = pos;
          }
          renderCanvas();
        }
      }
    },
    [
      activeTool,
      setViewTransform,
      sortedInstances.length,
      screenToImage,
      renderCanvas,
      selectedAnnotationId,
      setAnnotations,
    ],
  );

  const handleMouseUp = useCallback(() => {
    // Handle modification completion
    if (isModifyingAnnotation.current && selectedAnnotationId) {
      // Recalculate HU stats and check bounds
      setAnnotations(
        (prev) =>
          prev
            .map((ann) => {
              if (ann.id === selectedAnnotationId) {
                // Check if dragged outside bounds
                if (isAnnotationOutsideBounds(ann)) {
                  return null as unknown as Annotation; // Will be filtered out
                }
                return finalizeAnnotation({ ...ann });
              }
              return ann;
            })
            .filter(Boolean) as Annotation[],
      );
      saveToHistory();
      isModifyingAnnotation.current = false;
      draggedHandleIndex.current = null;
      isDraggingWholeAnnotation.current = false;
      isDragging.current = false;
      renderCanvas();
      return;
    }

    // Handle angle tool completion
    if (activeTool === "Angle" && currentAnnotation.current) {
      if (
        angleClickCount.current === 2 &&
        currentAnnotation.current.points.length >= 3
      ) {
        // Angle complete
        const finalAnn = finalizeAnnotation({
          ...currentAnnotation.current,
          index: annotations.length + 1,
        });

        if (!isAnnotationOutsideBounds(finalAnn)) {
          setAnnotations((prev) => [...prev, finalAnn]);
          saveToHistory();
        }
        currentAnnotation.current = null;
        angleClickCount.current = 0;
      }
      isDragging.current = false;
      renderCanvas();
      return;
    }

    // Handle Cobb's angle tool completion
    if (activeTool === "CobbsAngle" && currentAnnotation.current) {
      if (
        angleClickCount.current === 1 &&
        currentAnnotation.current.points.length >= 2
      ) {
        // First line complete, wait for second
        angleClickCount.current = 2;
        isDragging.current = false;
        renderCanvas();
        return;
      }
      if (
        angleClickCount.current === 3 &&
        currentAnnotation.current.points.length >= 4
      ) {
        // Cobb's angle complete
        const finalAnn = finalizeAnnotation({
          ...currentAnnotation.current,
          index: annotations.length + 1,
        });

        if (!isAnnotationOutsideBounds(finalAnn)) {
          setAnnotations((prev) => [...prev, finalAnn]);
          saveToHistory();
        }
        currentAnnotation.current = null;
        angleClickCount.current = 0;
      }
      isDragging.current = false;
      renderCanvas();
      return;
    }

    // Handle regular annotation completion
    if (isDragging.current && currentAnnotation.current) {
      // Ensure we have at least 2 points for line-based tools
      if (
        ["Length", "Ellipse", "Rectangle"].includes(
          currentAnnotation.current.type,
        )
      ) {
        if (currentAnnotation.current.points.length < 2) {
          // User just clicked without dragging, cancel
          currentAnnotation.current = null;
          isDragging.current = false;
          renderCanvas();
          return;
        }
      }

      // Check if annotation is outside bounds
      if (isAnnotationOutsideBounds(currentAnnotation.current)) {
        currentAnnotation.current = null;
        isDragging.current = false;
        renderCanvas();
        return;
      }

      const finalAnn = finalizeAnnotation({
        ...currentAnnotation.current,
        index: annotations.length + 1,
      });

      setAnnotations((prev) => [...prev, finalAnn]);
      currentAnnotation.current = null;
      saveToHistory();
      renderCanvas();
    }
    isDragging.current = false;
  }, [
    setAnnotations,
    saveToHistory,
    renderCanvas,
    activeTool,
    annotations.length,
    finalizeAnnotation,
    isAnnotationOutsideBounds,
    selectedAnnotationId,
  ]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      if (sortedInstances.length <= 1) return;
      const direction = Math.sign(event.deltaY);
      const intensity = Math.max(
        4,
        Math.ceil(Math.abs(event.deltaY) / 100) * 4,
      );
      const step = direction * intensity;
      setCurrentImageIndex((prev) =>
        Math.max(0, Math.min(prev + step, sortedInstances.length - 1)),
      );
    },
    [sortedInstances.length],
  );

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Handle text input submission
  const handleTextInputSubmit = useCallback(() => {
    if (textInputValue.trim() && textInputPosition) {
      const newAnnotation: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        type: "Text",
        points: [textInputPosition],
        text: textInputValue.trim(),
        color: "#00ff00",
        index: annotations.length + 1,
      };
      setAnnotations((prev) => [...prev, newAnnotation]);
      saveToHistory();
    }
    setTextInputVisible(false);
    setTextInputValue("");
    setTextInputPosition(null);
    setTextInputScreenPos(null);
  }, [
    textInputValue,
    textInputPosition,
    annotations.length,
    setAnnotations,
    saveToHistory,
  ]);

  const handleTextInputCancel = useCallback(() => {
    setTextInputVisible(false);
    setTextInputValue("");
    setTextInputPosition(null);
    setTextInputScreenPos(null);
  }, []);

  // Get summary text for measurement list
  const getMeasurementSummary = useCallback((ann: Annotation): string => {
    switch (ann.type) {
      case "Length":
        if (ann.distanceMm !== undefined) {
          return `${ann.distanceMm.toFixed(1)} mm`;
        }
        return "Length";
      case "Angle":
      case "CobbsAngle":
        if (ann.angleDegrees !== undefined) {
          return `${ann.angleDegrees.toFixed(1)}°`;
        }
        return ann.type === "Angle" ? "Angle" : "Cobb";
      case "Ellipse":
      case "Rectangle":
      case "Freehand":
        if (ann.huStats) {
          return `Mean: ${ann.huStats.mean.toFixed(0)} HU`;
        }
        return ann.type;
      case "Text":
        return ann.text || "Text";
      default:
        return ann.type;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black flex items-center justify-center overflow-hidden cursor-crosshair ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} className="max-w-full max-h-full" />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-4 text-center">
          <p className="text-red-400 text-sm">Error: {error}</p>
        </div>
      )}

      {!error && sortedInstances.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg pointer-events-none text-white text-sm font-mono">
          Image {currentImageIndex + 1} / {sortedInstances.length}
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
        className="absolute bottom-4 right-4 p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-600 shadow-lg"
        title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
      >
        {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
      </button>

      {/* Measurement List - Bottom Left (above image info) */}
      {annotations.length > 0 && (
        <div className="absolute bottom-28 left-4 bg-black/70 p-2 rounded-lg border border-white/10 max-h-40 overflow-y-auto pointer-events-auto z-10">
          <div className="text-[10px] text-gray-400 mb-1 font-semibold">
            Measurements
          </div>
          {annotations.map((ann, idx) => (
            <div
              key={ann.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAnnotationId(ann.id);
              }}
              className={`text-[10px] py-0.5 px-1 rounded cursor-pointer whitespace-nowrap flex items-center justify-between gap-2 ${ann.id === selectedAnnotationId
                ? "bg-blue-500/30 text-blue-300"
                : "text-gray-300 hover:bg-white/10"
                }`}
            >
              <span>
                {ann.index ?? idx + 1} – {getMeasurementSummary(ann)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAnnotationById(ann.id);
                }}
                className="p-0.5 hover:bg-red-500/30 rounded text-gray-400 hover:text-red-400 transition-colors"
                title="Delete measurement"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inline Text Input - appears at click position */}
      {textInputVisible && textInputScreenPos && (
        <div
          style={{
            position: "absolute",
            left:
              textInputScreenPos.x -
              (containerRef.current?.getBoundingClientRect().left || 0),
            top:
              textInputScreenPos.y -
              (containerRef.current?.getBoundingClientRect().top || 0) -
              12,
            zIndex: 50,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={textInputRef}
            type="text"
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                handleTextInputSubmit();
              } else if (e.key === "Escape") {
                handleTextInputCancel();
              }
            }}
            className="bg-black/80 border border-green-500 rounded px-2 py-1 outline-none text-[#00ff00] font-bold text-sm min-w-[120px]"
            placeholder="Type, Enter to save"
          />
        </div>
      )}

      {/* Corner Overlays */}
      {showOverlays && (
        <div className="absolute inset-0 pointer-events-none p-4 text-[10px] md:text-sm font-mono text-gray-300">
          {/* Top Left: Patient Info */}
          {caseData?.patient && (
            <div className="absolute top-2 left-2 flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5 shadow-2xl">
              <span className="text-blue-400 font-bold uppercase tracking-widest text-base mb-0.5">
                {caseData.patient.name}
              </span>
              <div className="flex flex-col gap-0.5 opacity-90">
                <span>ID: {caseData.patient.patient_id}</span>
                <span>
                  DOB:{" "}
                  {caseData.patient.dob || caseData.patient.date_of_birth
                    ? formatDicomDate(
                      caseData.patient.dob || caseData.patient.date_of_birth,
                    )
                    : "N/A"}
                </span>
                <span>Sex: {caseData.patient.sex}</span>
              </div>
            </div>
          )}

          {/* Top Right: Study Info */}
          {caseData && (
            <div className="absolute top-2 right-2 text-right flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5 shadow-2xl">
              <span className="text-blue-400 font-bold uppercase tracking-widest text-base mb-0.5">
                {caseData.center_name ||
                  caseData.hospital_name ||
                  caseData.hospital_id}
              </span>
              <div className="flex flex-col gap-0.5 opacity-90">
                <div>
                  <span className="font-semibold">
                    {formatDicomDate(caseData.case_date)}
                  </span>
                  <span className="ml-3 font-semibold">
                    {formatDicomTime(caseData.case_time)}
                  </span>
                </div>
                <span className="text-gray-400">
                  Acc: {caseData.accession_number || "N/A"}
                </span>
              </div>
            </div>
          )}

          {/* Bottom Left: Image Info */}
          <div className="absolute bottom-4 left-4 flex flex-col bg-black/40 rounded backdrop-blur-sm border border-white/5 overflow-hidden">
            <div className="p-2 flex flex-col gap-0.5">
              <span className="text-yellow-500 font-bold">
                {sortedInstances[currentImageIndex]?.modality || "DICOM"}
              </span>
              <span className="opacity-80 flex items-center gap-2">
                Img: {currentImageIndex + 1} / {sortedInstances.length}
                {prefetchProgress && (
                  <span className="text-[10px] text-blue-400 font-medium animate-pulse ml-1">
                    (
                    {Math.round(
                      (prefetchProgress.fetched / prefetchProgress.total) * 100,
                    )}
                    % Cached)
                  </span>
                )}
              </span>
              {sortedInstances[currentImageIndex]?.slice_thickness && (
                <span className="opacity-80">
                  Thick: {sortedInstances[currentImageIndex].slice_thickness} mm
                </span>
              )}
            </div>
            {prefetchProgress && (
              <div className="w-full h-[2px] bg-white/5">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${(prefetchProgress.fetched / prefetchProgress.total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Bottom Right: Window/Level Info */}
          <div className="absolute bottom-16 right-4 text-right flex flex-col gap-0.5 bg-black/40 p-2 rounded">
            <span className="opacity-80">
              W:{" "}
              {viewTransform.windowWidth?.toFixed(0) ??
                sortedInstances[currentImageIndex]?.window_width ??
                "N/A"}{" "}
              L:{" "}
              {viewTransform.windowCenter?.toFixed(0) ??
                sortedInstances[currentImageIndex]?.window_center ??
                "N/A"}
            </span>
            <span className="opacity-80">
              Zoom: {(viewTransform.scale * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default DicomViewer;
