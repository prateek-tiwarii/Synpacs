/**
 * VRTViewer — 3D Volume Rendering component using WebGL2 raycasting.
 *
 * Renders a 3D volume with trackball rotation, zoom, and pan.
 * Includes a toolbar overlay for preset selection, opacity, and exit.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useViewerContext } from "../ViewerLayout";
import { Maximize, Minimize, ChevronDown } from "lucide-react";
import type { VolumeData } from "@/lib/mpr/volumeBuilder";
import {
  isWebGL2Available,
  initRenderer,
  updateTransferFunction,
  render as glRender,
  resize as glResize,
  dispose as glDispose,
  type VRTRendererState,
  createDefaultCamera,
  applyRotation,
  applyZoom,
  applyPan,
  getViewMatrix,
  getProjectionMatrix,
  invertMatrix4,
  getVolumeCenter,
  type VRTCameraState,
  VRT_PRESETS,
  generateTransferFunctionTexture,
} from "@/lib/vrt";

interface VRTViewerProps {
  volume: VolumeData;
  onExit: () => void;
  className?: string;
  hideTools?: boolean;
}

// Helper to format DICOM date
const formatDicomDate = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}/${month}/${year}`;
};

export function VRTViewer({
  volume,
  onExit,
  className = "",
  hideTools = false,
}: VRTViewerProps) {
  const { caseData, isFullscreen, toggleFullscreen } = useViewerContext();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<VRTRendererState | null>(null);
  const cameraRef = useRef<VRTCameraState>(createDefaultCamera(volume));
  const renderRequestRef = useRef<number>(0);
  const volumeCenterRef = useRef(getVolumeCenter(volume));

  const [presetKey, setPresetKey] = useState("CT-Bone");
  const [opacityScale, setOpacityScale] = useState(1.5);
  const [interacting, setInteracting] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Mouse state
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Step size: coarser during interaction for performance
  const stepSize = interacting ? 0.008 : 0.003;

  // ─── Initialize WebGL renderer ───
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (!isWebGL2Available()) {
      setWebglError("WebGL2 is not supported in your browser. Please use a modern browser for 3D rendering.");
      return;
    }

    try {
      const tfData = generateTransferFunctionTexture(VRT_PRESETS[presetKey]);
      const rect = container.getBoundingClientRect();
      canvas.width = Math.round(rect.width * window.devicePixelRatio);
      canvas.height = Math.round(rect.height * window.devicePixelRatio);

      const renderer = initRenderer(canvas, volume, tfData);
      rendererRef.current = renderer;

      // Initial render
      requestRender();
    } catch (err) {
      console.error("VRT init failed:", err);
      setWebglError(err instanceof Error ? err.message : "Failed to initialize 3D renderer");
    }

    return () => {
      cancelAnimationFrame(renderRequestRef.current);
      if (rendererRef.current) {
        glDispose(rendererRef.current);
        rendererRef.current = null;
      }
    };
  }, [volume]); // Only re-init if volume changes

  // ─── Update transfer function when preset or opacity changes ───
  useEffect(() => {
    if (!rendererRef.current) return;
    const tfData = generateTransferFunctionTexture(VRT_PRESETS[presetKey]);
    updateTransferFunction(rendererRef.current, tfData);
    requestRender();
  }, [presetKey]);

  // ─── Re-render when opacity or step size changes ───
  useEffect(() => {
    requestRender();
  }, [opacityScale, interacting]);

  // ─── Render function ───
  const requestRender = useCallback(() => {
    cancelAnimationFrame(renderRequestRef.current);
    renderRequestRef.current = requestAnimationFrame(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const camera = cameraRef.current;
      const center = volumeCenterRef.current;
      const canvas = renderer.gl.canvas as HTMLCanvasElement;
      const aspect = canvas.width / canvas.height || 1;

      const viewMatrix = getViewMatrix(camera, center);
      const projMatrix = getProjectionMatrix(camera, aspect);
      const invView = invertMatrix4(viewMatrix);
      const invProj = invertMatrix4(projMatrix);

      glRender(renderer, invView, invProj, stepSize, opacityScale);
    });
  }, [stepSize, opacityScale]);

  // ─── Resize handling ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (rendererRef.current && width > 0 && height > 0) {
          glResize(rendererRef.current, width, height, window.devicePixelRatio);
          requestRender();
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [requestRender]);

  // ─── Mouse interaction handlers ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    isPanning.current = e.shiftKey || e.button === 2;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setInteracting(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current) return;

      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      const canvas = canvasRef.current;
      if (!canvas) return;

      if (isPanning.current || e.shiftKey) {
        cameraRef.current = applyPan(cameraRef.current, dx, dy);
      } else {
        cameraRef.current = applyRotation(
          cameraRef.current,
          dx,
          dy,
          canvas.clientWidth,
          canvas.clientHeight,
        );
      }

      requestRender();
    },
    [requestRender],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    isPanning.current = false;
    setInteracting(false);
  }, []);

  // ─── Wheel zoom (native listener to prevent passive warning) ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraRef.current = applyZoom(cameraRef.current, e.deltaY);
      requestRender();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [requestRender]);

  // ─── Context menu prevention ───
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  if (webglError) {
    return (
      <div className={`flex-1 flex flex-col bg-black items-center justify-center ${className}`}>
        <p className="text-red-400 text-sm mb-2">3D Rendering Error</p>
        <p className="text-gray-500 text-xs text-center max-w-md">{webglError}</p>
        <button
          onClick={onExit}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
        >
          Exit 3D MPR
        </button>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col bg-black ${className}`}>
      {/* 3D controls toolbar (hidden in focused 3D MPR mode) */}
      {hideTools ? (
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={onExit}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors font-medium"
          >
            Exit 3D MPR
          </button>
        </div>
      ) : (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700 px-3 py-1.5">
          {/* Preset selector */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-1 text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              {VRT_PRESETS[presetKey].name}
              <ChevronDown size={12} />
            </button>
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px] z-30">
                {Object.entries(VRT_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setPresetKey(key);
                      setShowPresets(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      key === presetKey
                        ? "bg-purple-600 text-white"
                        : "text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Opacity slider */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">Opacity</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={opacityScale}
              onChange={(e) => setOpacityScale(parseFloat(e.target.value))}
              className="w-20 h-1 accent-purple-500"
            />
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-600" />

          {/* Exit button */}
          <button
            onClick={onExit}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors font-medium"
          >
            Exit 3D MPR
          </button>
        </div>
      )}

      {/* WebGL Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
        />

        {/* Corner Overlays */}
        <div className="absolute inset-4 pointer-events-none select-none text-[11px] md:text-xs font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
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
              <span className="font-medium mt-1 text-purple-400">
                3D Volume Rendering
              </span>
            </div>
          )}

          {/* Volume Info - Top Right */}
          <div className="absolute top-0 right-0 text-right flex flex-col gap-0.5">
            <span className="font-bold">3D VRT</span>
            <span>
              {volume.dimensions[0]} x {volume.dimensions[1]} x{" "}
              {volume.dimensions[2]}
            </span>
            <span>Preset: {VRT_PRESETS[presetKey].name}</span>
          </div>

          {/* Controls hint - Bottom Left */}
          <div className="absolute bottom-0 left-0 text-gray-500 text-[10px]">
            <span>Drag: Rotate</span>
            <span className="mx-2">|</span>
            <span>Shift+Drag: Pan</span>
            <span className="mx-2">|</span>
            <span>Scroll: Zoom</span>
          </div>
        </div>

        {/* Fullscreen Button - Bottom Right */}
        {!hideTools && (
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-2 right-2 bg-black/70 hover:bg-gray-800 p-2 rounded transition-colors z-10"
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

export default VRTViewer;
