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

interface TemporaryMPRSeriesViewerProps {
  series: TemporaryMPRSeries;
  className?: string;
  scoutLines?: ScoutLine[];
  onImageIndexChange?: (index: number) => void;
  compact?: boolean;
  viewTransformOverride?: ViewTransform;
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
  isFullscreenOverride,
  onToggleFullscreenOverride,
}: TemporaryMPRSeriesViewerProps) {
  const {
    viewTransform: globalViewTransform,
    caseData,
    isFullscreen: globalIsFullscreen,
    toggleFullscreen: toggleGlobalFullscreen,
    setCurrentImageIndex,
  } = useViewerContext();
  const viewTransform = viewTransformOverride ?? globalViewTransform;
  const isFullscreen = isFullscreenOverride ?? globalIsFullscreen;
  const toggleFullscreen =
    onToggleFullscreenOverride ?? toggleGlobalFullscreen;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoutCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isDragging = useRef(false);
  const lastY = useRef(0);

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
    canvas.width = slice.width;
    canvas.height = slice.height;

    // Draw the pre-rendered ImageData
    ctx.putImageData(slice.imageData, 0, 0);

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
  }, [series, currentIndex]);

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
  }, [scoutLines, currentIndex, series]);

  // Handle mouse interactions for scrolling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastY.current = e.clientY;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;

      const deltaY = e.clientY - lastY.current;
      lastY.current = e.clientY;

      if (Math.abs(deltaY) >= 2) {
        const step = deltaY > 0 ? 1 : -1;
        setCurrentIndex((prev) =>
          Math.max(0, Math.min(series.sliceCount - 1, prev + step)),
        );
      }
    },
    [series.sliceCount],
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
      const step = e.deltaY > 0 ? 1 : -1;
      setCurrentIndex((prev) =>
        Math.max(0, Math.min(series.sliceCount - 1, prev + step)),
      );
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [series.sliceCount]);

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
          className="cursor-ns-resize"
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
              {/* Compact mode: plane label top-left, slice counter bottom-left */}
              <div className="absolute top-0 left-0 font-bold text-sm uppercase tracking-wide">
                {series.mprMode}
              </div>
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
