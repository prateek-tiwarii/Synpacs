/**
 * TemporaryMPRSeriesViewer Component
 *
 * Displays pre-generated MPR slices from a temporary series.
 * These slices are stored in memory and can be scrolled through.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useViewerContext, type TemporaryMPRSeries } from "../ViewerLayout";
import { Maximize, Minimize } from "lucide-react";

interface TemporaryMPRSeriesViewerProps {
  series: TemporaryMPRSeries;
  className?: string;
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
}: TemporaryMPRSeriesViewerProps) {
  const {
    viewTransform,
    caseData,
    isFullscreen,
    toggleFullscreen,
    setCurrentImageIndex,
  } = useViewerContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isDragging = useRef(false);
  const lastY = useRef(0);

  // Sync current index with global context
  useEffect(() => {
    setCurrentImageIndex(currentIndex);
  }, [currentIndex, setCurrentImageIndex]);

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
    const containerRect = container.getBoundingClientRect();
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = slice.width / slice.height;

    if (imageAspect > containerAspect) {
      canvas.style.width = "100%";
      canvas.style.height = "auto";
    } else {
      canvas.style.width = "auto";
      canvas.style.height = "100%";
    }
  }, [series, currentIndex]);

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
          className="max-w-full max-h-full object-contain cursor-ns-resize"
          style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale}) rotate(${viewTransform.rotation}deg) scaleX(${viewTransform.flipH ? -1 : 1}) scaleY(${viewTransform.flipV ? -1 : 1})`,
            filter: viewTransform.invert ? "invert(1)" : "none",
          }}
        />

        {/* Patient Details Overlay - Top Left */}
        {caseData?.patient && (
          <div className="absolute top-2 left-2 bg-black/60 p-2.5 rounded-lg border border-white/5 shadow-2xl pointer-events-none select-none">
            <span className="text-blue-400 font-bold uppercase tracking-widest text-base mb-0.5 block">
              {caseData.patient.name}
            </span>
            <div className="flex flex-col gap-0.5 opacity-90 text-xs text-gray-300">
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
              <div className="text-purple-400 font-medium mt-1">
                {series.mprMode} MPR
              </div>
            </div>
          </div>
        )}

        {/* Image Info - Top Right */}
        <div className="absolute top-2 right-2 bg-black/70 px-3 py-2 rounded text-xs text-gray-300 space-y-0.5 pointer-events-none select-none">
          <div className="text-purple-400 font-medium">
            Generated MPR Series
          </div>
          <div>Slices: {series.sliceCount}</div>
          <div>
            W/L: {series.windowWidth.toFixed(0)} /{" "}
            {series.windowCenter.toFixed(0)}
          </div>
        </div>

        {/* Slice Counter - Bottom Left */}
        <div className="absolute bottom-2 left-2 bg-black/70 px-3 py-2 rounded text-sm text-white font-medium pointer-events-none select-none">
          {currentIndex + 1} / {series.sliceCount}
        </div>

        {/* Fullscreen Button - Bottom Right */}
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
      </div>
    </div>
  );
}

export default TemporaryMPRSeriesViewer;
